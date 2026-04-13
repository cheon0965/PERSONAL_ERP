import { ApiProperty } from '@nestjs/swagger';
import type { VerifyEmailRequest } from '@personal-erp/contracts';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class VerifyEmailDto implements VerifyEmailRequest {
  @ApiProperty({ example: 'email-verification-token' })
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  token!: string;
}
