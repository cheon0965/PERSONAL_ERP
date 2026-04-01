import { ApiProperty } from '@nestjs/swagger';
import type { OpenAccountingPeriodRequest } from '@personal-erp/contracts';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength
} from 'class-validator';

export class OpenAccountingPeriodRequestDto implements OpenAccountingPeriodRequest {
  @ApiProperty({ example: '2026-03' })
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'month는 YYYY-MM 형식이어야 합니다.'
  })
  month!: string;

  @ApiProperty({
    required: false,
    example: true,
    description: '첫 월 운영 시작 시 오프닝 잔액 스냅샷을 함께 생성할지 여부'
  })
  @IsOptional()
  @IsBoolean()
  initializeOpeningBalance?: boolean;

  @ApiProperty({
    required: false,
    example: '2026년 3월 운영 시작',
    description: '월 운영 시작 사유 또는 메모'
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
