import { ApiProperty } from '@nestjs/swagger';
import type { GenerateFinancialStatementSnapshotsRequest } from '@personal-erp/contracts';
import { IsString } from 'class-validator';

export class GenerateFinancialStatementsRequestDto implements GenerateFinancialStatementSnapshotsRequest {
  @ApiProperty({
    example: 'period-2026-03',
    description: '공식 재무제표 스냅샷을 생성할 잠금 완료 기간 식별자'
  })
  @IsString()
  periodId!: string;
}
