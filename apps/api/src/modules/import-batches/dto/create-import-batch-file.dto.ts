import { ApiProperty } from '@nestjs/swagger';
import { ImportSourceKind } from '@prisma/client';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateImportBatchFileRequestDto {
  @ApiProperty({
    enum: ImportSourceKind,
    example: ImportSourceKind.IM_BANK_PDF
  })
  @IsEnum(ImportSourceKind)
  sourceKind!: ImportSourceKind;

  @ApiProperty({
    example: 'acc-1',
    description: 'IM뱅크 PDF 배치와 연결할 활성 계좌/카드 자금수단 ID입니다.'
  })
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  fundingAccountId!: string;
}
