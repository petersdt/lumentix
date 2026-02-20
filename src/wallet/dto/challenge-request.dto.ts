import { IsString } from 'class-validator';

export class ChallengeRequestDto {
  @IsString()
  publicKey: string;
}
