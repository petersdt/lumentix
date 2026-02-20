import { IsString } from 'class-validator';

export class VerifySignatureDto {
  @IsString()
  publicKey: string;

  @IsString()
  signature: string;
}
