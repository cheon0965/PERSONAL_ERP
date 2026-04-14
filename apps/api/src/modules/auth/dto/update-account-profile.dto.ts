import { ApiProperty } from '@nestjs/swagger';
import type { UpdateAccountProfileRequest } from '@personal-erp/contracts';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateAccountProfileDto implements UpdateAccountProfileRequest {
  @ApiProperty({ example: '홍길동' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;
}
