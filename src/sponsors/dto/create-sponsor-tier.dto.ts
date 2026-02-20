import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateSponsorTierDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @Min(0.01, { message: 'Tier price must be positive' })
  price: number;

  @IsString()
  @IsOptional()
  benefits?: string;

  @IsNumber()
  @Min(1, { message: 'maxSponsors must be greater than 0' })
  maxSponsors: number;
}
