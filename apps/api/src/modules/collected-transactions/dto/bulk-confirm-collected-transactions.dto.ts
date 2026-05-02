import { ApiProperty } from '@nestjs/swagger';
import type { BulkConfirmCollectedTransactionsRequest } from '@personal-erp/contracts';
import { ArrayMinSize, IsArray, IsOptional, IsString } from 'class-validator';

export class BulkConfirmCollectedTransactionsRequestDto implements BulkConfirmCollectedTransactionsRequest {
  @ApiProperty({
    type: [String],
    required: false,
    description:
      '선택한 수집 거래 ID 목록입니다. 비우면 현재 작업공간의 전표 준비 상태 거래 전체를 확정합니다.'
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  transactionIds?: string[];
}
