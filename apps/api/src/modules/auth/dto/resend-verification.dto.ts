import { ApiProperty } from '@nestjs/swagger';
import type { ResendVerificationRequest } from '@personal-erp/contracts';
import { IsEmail, MaxLength } from 'class-validator';

export class ResendVerificationDto implements ResendVerificationRequest {
  @ApiProperty({ example: 'owner@example.com' })
  @IsEmail()
  @MaxLength(191)
  email!: string;
}
