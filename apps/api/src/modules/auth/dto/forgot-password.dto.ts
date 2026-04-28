import { ApiProperty } from '@nestjs/swagger';
import type { ForgotPasswordRequest } from '@personal-erp/contracts';
import { IsEmail, MaxLength } from 'class-validator';

export class ForgotPasswordDto implements ForgotPasswordRequest {
  @ApiProperty({ example: 'owner@example.com' })
  @IsEmail()
  @MaxLength(191)
  email!: string;
}
