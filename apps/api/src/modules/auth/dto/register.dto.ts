import { ApiProperty } from '@nestjs/swagger';
import type { RegisterRequest } from '@personal-erp/contracts';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsString,
  MaxLength,
  MinLength
} from 'class-validator';

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

  @ApiProperty({
    example: true,
    description: 'PERSONAL ERP 이용약관 필수 동의 여부'
  })
  @IsBoolean()
  @Equals(true, { message: '이용약관에 동의해 주세요.' })
  termsAccepted!: boolean;

  @ApiProperty({
    example: true,
    description: '개인정보 수집·이용 필수 동의 여부'
  })
  @IsBoolean()
  @Equals(true, { message: '개인정보 수집·이용에 동의해 주세요.' })
  privacyConsentAccepted!: boolean;
}
