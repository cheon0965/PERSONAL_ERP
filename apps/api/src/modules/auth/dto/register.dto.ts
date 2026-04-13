import { ApiProperty } from '@nestjs/swagger';
import type { RegisterRequest } from '@personal-erp/contracts';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto implements RegisterRequest {
  @ApiProperty({ example: 'owner@example.com' })
  @IsEmail()
  @MaxLength(191)
  email!: string;

  @ApiProperty({ example: 'Demo1234!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ example: '홍길동' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;
}
