import { ApiProperty } from '@nestjs/swagger';
import type {
  BulkCollectImportedRowsRequest,
  BulkCollectImportedRowsTypeOption
} from '@personal-erp/contracts';
import { Type } from 'class-transformer';
import { TransactionType } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested
} from 'class-validator';

class BulkCollectImportedRowsTypeOptionDto implements BulkCollectImportedRowsTypeOption {
  @ApiProperty({
    enum: TransactionType,
    description: '이 설정을 적용할 수집 거래 유형입니다.'
  })
  @IsEnum(TransactionType)
  type!: TransactionType;

  @ApiProperty({
    required: false,
    description: '해당 거래 유형 행에 적용할 카테고리 ID입니다.'
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({
    required: false,
    description: '해당 거래 유형 행에 적용할 메모입니다.'
  })
  @IsOptional()
  @IsString()
  memo?: string;
}

export class BulkCollectImportedRowsRequestDto implements BulkCollectImportedRowsRequest {
  @ApiProperty({
    type: [String],
    required: false,
    description:
      '선택한 업로드 행 ID 목록입니다. 비우면 배치의 등록 가능 행 전체를 처리합니다.'
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

  @ApiProperty({
    required: false,
    type: () => [BulkCollectImportedRowsTypeOptionDto],
    description:
      '거래 유형별 적용값입니다. 지정된 유형 행에는 일괄 카테고리/메모보다 우선 적용합니다.'
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkCollectImportedRowsTypeOptionDto)
  typeOptions?: BulkCollectImportedRowsTypeOptionDto[];
}
