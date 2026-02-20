import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SponsorsService } from './sponsors.service';
import { CreateSponsorTierDto } from './dto/create-sponsor-tier.dto';
import { UpdateSponsorTierDto } from './dto/update-sponsor-tier.dto';
import { Roles, Role } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@Controller('events/:eventId/tiers')
@UseGuards(RolesGuard)
export class SponsorsController {
  constructor(private readonly sponsorsService: SponsorsService) {}

  @Post()
  @Roles(Role.ORGANIZER)
  create(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: CreateSponsorTierDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.sponsorsService.createTier(eventId, dto, req.user.id);
  }

  @Get()
  list(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.sponsorsService.listTiers(eventId);
  }

  @Put(':id')
  @Roles(Role.ORGANIZER)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSponsorTierDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.sponsorsService.updateTier(id, dto, req.user.id);
  }

  @Delete(':id')
  @Roles(Role.ORGANIZER)
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.sponsorsService.deleteTier(id, req.user.id);
  }
}
