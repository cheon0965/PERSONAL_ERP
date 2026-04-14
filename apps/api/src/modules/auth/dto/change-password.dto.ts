import { ApiProperty } from '@nestjs/swagger';
import type { ChangePasswordRequest } from '@personal-erp/contracts';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto implements ChangePasswordRequest {
  @ApiProperty({ example: 'Demo1234!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty({ example: 'NextDemo1234!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  nextPassword!: string;
}
