import { ApiProperty } from '@nestjs/swagger';
import type { PreviewOpeningBalanceRequest } from '@personal-erp/contracts';
import { Type } from 'class-transformer';
import { IsArray, ArrayMinSize, ValidateNested } from 'class-validator';
import { OpenAccountingPeriodOpeningBalanceLineDto } from './open-accounting-period.dto';

export class PreviewOpeningBalanceRequestDto implements PreviewOpeningBalanceRequest {
  @ApiProperty({
    type: [OpenAccountingPeriodOpeningBalanceLineDto],
    description: '저장 없이 검증하고 합계를 계산할 기초 잔액 라인 목록'
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OpenAccountingPeriodOpeningBalanceLineDto)
  openingBalanceLines!: OpenAccountingPeriodOpeningBalanceLineDto[];
}
