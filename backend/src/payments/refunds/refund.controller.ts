import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { RefundService } from './refund.service';
import { RefundResultDto } from './dto/refund-result.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/decorators/roles.decorator';

@Controller('refunds')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RefundController {
  constructor(private readonly refundService: RefundService) {}

  /**
   * POST /refunds/event/:eventId
   * Admin-only — triggers refunds for all confirmed payments on a cancelled event.
   */
  @Post('event/:eventId')
  @Roles(Role.ADMIN)
  async refundEvent(
    @Param('eventId') eventId: string,
  ): Promise<RefundResultDto[]> {
    return this.refundService.refundEvent(eventId);
  }
}
