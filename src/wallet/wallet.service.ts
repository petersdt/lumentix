/* eslint-disable @typescript-eslint/require-await */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Keypair } from '@stellar/stellar-sdk';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { StellarService } from '../stellar/stellar.service';

// Nonce TTL: 5 minutes
const NONCE_TTL_MS = 5 * 60 * 1000;

interface NonceEntry {
  nonce: string;
  createdAt: number;
}

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  /**
   * In-memory nonce store: publicKey → NonceEntry
   * In production this should be Redis / a DB table.
   */
  private readonly nonceStore = new Map<string, NonceEntry>();

  constructor(
    private readonly usersService: UsersService,
    private readonly stellarService: StellarService,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1 — Issue challenge
  // ─────────────────────────────────────────────────────────────────────────

  async requestChallenge(publicKey: string): Promise<{ message: string }> {
    this.validatePublicKeyFormat(publicKey);

    const nonce = crypto.randomBytes(32).toString('hex');
    this.nonceStore.set(publicKey, { nonce, createdAt: Date.now() });

    const message = `Sign this message to link wallet: ${nonce}`;
    this.logger.log(`Challenge issued for ${publicKey}`);
    return { message };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 2 — Verify signature & link wallet
  // ─────────────────────────────────────────────────────────────────────────

  async verifyAndLink(
    userId: string,
    publicKey: string,
    signature: string,
  ): Promise<Omit<User, 'passwordHash'>> {
    this.validatePublicKeyFormat(publicKey);

    // 1. Retrieve & validate nonce
    const entry = this.nonceStore.get(publicKey);
    if (!entry) {
      throw new BadRequestException(
        'No active challenge found for this public key. Request a new challenge.',
      );
    }

    if (Date.now() - entry.createdAt > NONCE_TTL_MS) {
      this.nonceStore.delete(publicKey);
      throw new BadRequestException(
        'Challenge has expired. Request a new one.',
      );
    }

    // 2. Verify the signature cryptographically using Stellar SDK (via StellarService)
    const message = `Sign this message to link wallet: ${entry.nonce}`;
    const isValid = this.verifySignature(publicKey, message, signature);

    if (!isValid) {
      throw new UnauthorizedException('Invalid signature.');
    }

    // 3. Nonce is consumed — remove it to prevent replay attacks
    this.nonceStore.delete(publicKey);

    // 4. Enforce public key uniqueness across users
    const existingOwner = await this.usersRepository.findOne({
      where: { stellarPublicKey: publicKey },
    });

    if (existingOwner && existingOwner.id !== userId) {
      throw new ConflictException(
        'This Stellar public key is already linked to another account.',
      );
    }

    // 5. Optionally verify account exists on-chain via StellarService
    try {
      await this.stellarService.getAccount(publicKey);
    } catch {
      // Account may not yet be funded on testnet — log but do not block linking
      this.logger.warn(
        `Stellar account ${publicKey} not found on network (may be unfunded). Proceeding with link.`,
      );
    }

    // 6. Persist
    return this.usersService.updateWallet(userId, publicKey);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Verify a Stellar ed25519 signature.
   * Uses only the Stellar SDK Keypair — no direct Stellar SDK usage escapes this class.
   * All blockchain/network access uses StellarService.
   */
  private verifySignature(
    publicKey: string,
    message: string,
    signatureHex: string,
  ): boolean {
    try {
      const keypair = Keypair.fromPublicKey(publicKey);
      const messageBuffer = Buffer.from(message, 'utf8');
      const signatureBuffer = Buffer.from(signatureHex, 'hex');
      return keypair.verify(messageBuffer, signatureBuffer);
    } catch (err) {
      this.logger.warn(
        `Signature verification error: ${(err as Error).message}`,
      );
      return false;
    }
  }

  private validatePublicKeyFormat(publicKey: string): void {
    try {
      Keypair.fromPublicKey(publicKey);
    } catch {
      throw new BadRequestException('Invalid Stellar public key format.');
    }
  }
}
