import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SponsorTier } from './entities/sponsor-tier.entity';
import { EventsService } from '../events/events.service';
import { CreateSponsorTierDto } from './dto/create-sponsor-tier.dto';
import { UpdateSponsorTierDto } from './dto/update-sponsor-tier.dto';

@Injectable()
export class SponsorsService {
  constructor(
    @InjectRepository(SponsorTier)
    private readonly tierRepository: Repository<SponsorTier>,
    private readonly eventsService: EventsService,
  ) {}

  async createTier(
    eventId: string,
    dto: CreateSponsorTierDto,
    requesterId: string,
  ): Promise<SponsorTier> {
    await this.assertEventOrganizer(eventId, requesterId);

    const tier = this.tierRepository.create({ ...dto, eventId });
    return this.tierRepository.save(tier);
  }

  async updateTier(
    id: string,
    dto: UpdateSponsorTierDto,
    requesterId: string,
  ): Promise<SponsorTier> {
    const tier = await this.getTierById(id);
    await this.assertEventOrganizer(tier.eventId, requesterId);

    Object.assign(tier, dto);
    return this.tierRepository.save(tier);
  }

  async deleteTier(id: string, requesterId: string): Promise<void> {
    const tier = await this.getTierById(id);
    await this.assertEventOrganizer(tier.eventId, requesterId);
    await this.tierRepository.remove(tier);
  }

  async listTiers(eventId: string): Promise<SponsorTier[]> {
    return this.tierRepository.find({
      where: { eventId },
      order: { price: 'ASC' },
    });
  }

  async getTierById(id: string): Promise<SponsorTier> {
    const tier = await this.tierRepository.findOne({ where: { id } });
    if (!tier) {
      throw new NotFoundException(`Sponsor tier with id "${id}" not found`);
    }
    return tier;
  }

  private async assertEventOrganizer(
    eventId: string,
    requesterId: string,
  ): Promise<void> {
    const event = await this.eventsService.getEventById(eventId);
    if (event.organizerId !== requesterId) {
      throw new ForbiddenException(
        'Only the event organizer can manage sponsor tiers',
      );
    }
  }
}
