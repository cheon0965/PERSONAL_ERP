import { ApiProperty } from '@nestjs/swagger';
import type { CloseAccountingPeriodRequest } from '@personal-erp/contracts';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CloseAccountingPeriodRequestDto implements CloseAccountingPeriodRequest {
  @ApiProperty({
    required: false,
    example: '2026년 3월 마감을 확정합니다.',
    description: '월 마감 사유 또는 운영 메모'
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
