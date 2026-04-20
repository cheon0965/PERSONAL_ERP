import { ApiProperty } from '@nestjs/swagger';
import type { BulkCollectImportedRowsRequest } from '@personal-erp/contracts';
import { TransactionType } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString
} from 'class-validator';

export class BulkCollectImportedRowsRequestDto
  implements BulkCollectImportedRowsRequest
{
  @ApiProperty({
    type: [String],
    required: false,
    description: '선택한 업로드 행 ID 목록입니다. 비우면 배치의 등록 가능 행 전체를 처리합니다.'
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  rowIds?: string[];

  @ApiProperty({
    enum: TransactionType,
    required: false,
    description:
      '거래 유형을 고정하고 싶을 때만 지정합니다. 비우면 파싱된 입출금 방향으로 자동 결정합니다.'
  })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiProperty()
  @IsString()
  fundingAccountId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  memo?: string;
}
