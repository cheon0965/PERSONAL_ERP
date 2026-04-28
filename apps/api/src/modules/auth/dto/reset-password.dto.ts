import { ApiProperty } from '@nestjs/swagger';
import type { ResetPasswordRequest } from '@personal-erp/contracts';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto implements ResetPasswordRequest {
  @ApiProperty({ example: 'password-reset-token' })
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  token!: string;

  @ApiProperty({ example: 'NewSecure1234!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
