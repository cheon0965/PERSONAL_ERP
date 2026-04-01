import { ApiProperty } from '@nestjs/swagger';
import type { ReopenAccountingPeriodRequest } from '@personal-erp/contracts';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ReopenAccountingPeriodRequestDto implements ReopenAccountingPeriodRequest {
  @ApiProperty({
    example: '차기 이월 전 재검토가 필요해 재오픈합니다.',
    description: '재오픈 사유'
  })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  reason!: string;
}
