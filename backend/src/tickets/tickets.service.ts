import * as qrcode from 'qrcode';
import { TicketSigningService } from './ticket-signing.service';
import { IssueTicketResponseDto } from './dto/issue-ticket-response.dto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TicketEntity } from './entities/ticket.entity';
import { PaymentsService } from '../payments/payments.service';
import { PaymentStatus } from '../payments/entities/payment.entity';
import { StellarService } from '../stellar/stellar.service';
import { NotificationService } from '../notifications/notification.service';
import { Event } from '../events/entities/event.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(TicketEntity)
    private readonly ticketRepo: Repository<TicketEntity>,
    private readonly paymentsService: PaymentsService,
    private readonly stellarService: StellarService,
    private readonly configService: ConfigService,
    private readonly ticketSigningService: TicketSigningService,
    private readonly notificationService: NotificationService,
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async issueTicket(paymentId: string): Promise<IssueTicketResponseDto> {
    const payment = await this.paymentsService.getPaymentById(paymentId);

    if (payment.status !== PaymentStatus.CONFIRMED) {
      throw new BadRequestException('Payment not confirmed');
    }

    if (!payment.transactionHash) {
      throw new BadRequestException('Payment has no transaction hash');
    }

    const existing = await this.ticketRepo.findOne({
      where: { transactionHash: payment.transactionHash },
    });
    if (existing) {
      const signature = this.ticketSigningService.sign(existing.id);
      const qrPayload = JSON.stringify({ ticketId: existing.id, signature });
      const qrCodeDataUrl = await qrcode.toDataURL(qrPayload);
      return { ticket: existing, signature, qrCodeDataUrl };
    }

    const tx = await this.stellarService.getTransaction(
      payment.transactionHash,
    );

    const memoValue: string | undefined =
      typeof tx.memo === 'string' ? tx.memo : undefined;

    if (!memoValue) {
      throw new BadRequestException(
        'Transaction is missing memo. Cannot verify payment reference.',
      );
    }

    if (memoValue !== payment.id) {
      throw new BadRequestException(
        `Transaction memo does not match paymentId. Expected "${payment.id}", got "${memoValue}".`,
      );
    }

    const ticket = this.ticketRepo.create({
      eventId: payment.eventId,
      ownerId: payment.userId,
      assetCode: payment.currency,
      transactionHash: payment.transactionHash,
      status: 'valid',
    });

    // Persist first to obtain the auto-generated UUID, then sign it
    const saved = await this.ticketRepo.save(ticket);
    const signature = this.ticketSigningService.sign(saved.id);
    const qrPayload = JSON.stringify({ ticketId: saved.id, signature });
    const qrCodeDataUrl = await qrcode.toDataURL(qrPayload);

    // Fetch user email and event name
    const user = await this.userRepo.findOne({ where: { id: payment.userId } });
    const event = await this.eventRepo.findOne({
      where: { id: payment.eventId },
    });
    if (user && event) {
      await this.notificationService.queueTicketEmail({
        email: user.email,
        ticketId: saved.id,
        eventName: event.title,
      });
    }

    return { ticket: saved, signature, qrCodeDataUrl };
  }

  async transferTicket(
    ticketId: string,
    callerOwnerId: string,
    newOwnerId: string,
  ): Promise<TicketEntity> {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    if (ticket.ownerId !== callerOwnerId) {
      throw new ForbiddenException('Not ticket owner');
    }

    if (ticket.status !== 'valid') {
      throw new BadRequestException('Ticket not transferable');
    }

    ticket.ownerId = newOwnerId;
    return this.ticketRepo.save(ticket);
  }

  async verifyTicket(
    ticketId: string,
    signature: string,
  ): Promise<TicketEntity> {
    // 1. Cryptographic signature check — must come before any DB lookup
    //    to avoid leaking ticket existence to unauthenticated callers.
    if (!this.ticketSigningService.verify(ticketId, signature)) {
      throw new UnauthorizedException('Invalid ticket signature');
    }

    // 2. Ticket existence check
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // 3. Status guard
    if (ticket.status === 'used') {
      throw new BadRequestException('Ticket has already been used');
    }
    if (ticket.status !== 'valid') {
      throw new BadRequestException('Ticket is no longer valid');
    }

    // 4. Mark as used — atomic save prevents double-scan in practice;
    //    a DB-level unique partial index on (id, status='used') is recommended
    //    for high-throughput gate scenarios.
    ticket.status = 'used';
    return this.ticketRepo.save(ticket);
  }

  // Private helpers removed; now handled by TicketSigningService
}
