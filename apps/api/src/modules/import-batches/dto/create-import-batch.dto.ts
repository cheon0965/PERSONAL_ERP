import { ApiProperty } from '@nestjs/swagger';
import type { CreateImportBatchRequest } from '@personal-erp/contracts';
import { ImportSourceKind } from '@prisma/client';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateImportBatchRequestDto implements CreateImportBatchRequest {
  @ApiProperty({ enum: ImportSourceKind })
  @IsEnum(ImportSourceKind)
  sourceKind!: ImportSourceKind;

  @ApiProperty({ example: 'march-bank.csv' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({
    example: 'date,title,amount\n2026-03-02,Coffee,4800',
    description:
      'thin-first 단계에서는 UTF-8 텍스트 본문으로 업로드 내용을 전달합니다.'
  })
  @IsString()
  @MinLength(1)
  content!: string;
}
