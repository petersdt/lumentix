import { PartialType } from '@nestjs/mapped-types';
import { CreateSponsorTierDto } from './create-sponsor-tier.dto';

export class UpdateSponsorTierDto extends PartialType(CreateSponsorTierDto) {}
