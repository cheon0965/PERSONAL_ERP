import { ApiProperty } from '@nestjs/swagger';
import type { LoginRequest } from '@personal-erp/contracts';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto implements LoginRequest {
  @ApiProperty({ example: 'demo@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Demo1234!' })
  @IsString()
  @MinLength(8)
  password!: string;
}
