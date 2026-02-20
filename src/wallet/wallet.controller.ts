import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { ChallengeRequestDto } from './dto/challenge-request.dto';
import { VerifySignatureDto } from './dto/verify-signature.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from 'src/common/interfaces/authenticated-request.interface';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  /**
   * POST /wallet/challenge
   * Public endpoint — returns a nonce-based message to sign.
   */
  @Post('challenge')
  async requestChallenge(
    @Body() dto: ChallengeRequestDto,
  ): Promise<{ message: string }> {
    return this.walletService.requestChallenge(dto.publicKey);
  }

  /**
   * POST /wallet/verify
   * Protected — requires authenticated user.
   */

  @UseGuards(JwtAuthGuard)
  @Post('verify')
  async verify(
    @Req() req: AuthenticatedRequest,
    @Body() dto: VerifySignatureDto,
  ) {
    const { id: userId } = req.user;
    return this.walletService.verifyAndLink(
      userId,
      dto.publicKey,
      dto.signature,
    );
  }
}
