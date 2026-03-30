import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ParseUUIDPipe,
  ForbiddenException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { PaginationDto } from '../common/pagination/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // ----------------------------------------------------------------
  // Static routes MUST come before dynamic /:id routes
  // ----------------------------------------------------------------

  // Issue #126 – GET /payments/history
  @Get('history')
  async getHistory(
    @Req() req: AuthenticatedRequest,
    @Query() dto: PaginationDto,
  ) {
    return this.paymentsService.getHistory(req.user.id, dto);
  }

  // Issue #126 – GET /payments/pending
  @Get('pending')
  async getPending(
    @Req() req: AuthenticatedRequest,
    @Query() dto: PaginationDto,
  ) {
    return this.paymentsService.getPending(req.user.id, dto);
  }

  // Issue #129 – GET /payments/path
  @Get('path')
  async getPaymentPath(
    @Query('sourceAsset') sourceAsset: string,
    @Query('destAsset') destAsset: string,
    @Query('amount') amount: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.paymentsService.findPaymentPath(
      req.user.stellarPublicKey,
      sourceAsset,
      destAsset,
      amount,
    );
  }

  // ----------------------------------------------------------------
  // Dynamic routes
  // ----------------------------------------------------------------

  // Issue #126 – GET /payments/:id/status
  @Get(':id/status')
  async getStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const payment = await this.paymentsService.getPaymentById(id);
    if (payment.userId !== req.user.id) {
      throw new ForbiddenException('You do not have access to this payment');
    }
    return {
      id: payment.id,
      status: payment.status,
      expiresAt: payment.expiresAt,
    };
  }

  // Existing – POST /payments/intent
  @Post('intent')
  async createIntent(
    @Body() dto: CreatePaymentIntentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.paymentsService.createPaymentIntent(
      dto.eventId,
      req.user.id,
      dto.currency,        // Issue #128 – optional currency
      dto.usePathPayment,  // Issue #129 – optional path payment flag
      dto.sourceAsset,     // Issue #129 – source asset for path payment
    );
  }

  // Existing – POST /payments/confirm
  @Post('confirm')
  async confirmPayment(
    @Body() dto: ConfirmPaymentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.paymentsService.confirmPayment(dto, req.user.id);
  }
}