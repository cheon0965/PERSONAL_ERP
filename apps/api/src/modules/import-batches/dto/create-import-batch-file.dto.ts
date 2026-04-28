import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ImportSourceKind } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from 'class-validator';

export class CreateImportBatchFileRequestDto {
  @ApiProperty({
    enum: ImportSourceKind,
    example: ImportSourceKind.IM_BANK_PDF
  })
  @IsEnum(ImportSourceKind)
  sourceKind!: ImportSourceKind;

  @ApiProperty({
    example: 'acc-1',
    description: '파일 배치와 연결할 활성 계좌/카드 자금수단 ID입니다.'
  })
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  fundingAccountId!: string;

  @ApiPropertyOptional({
    example: '990101',
    description:
      '우리은행 보안메일 HTML 복호화를 위한 비밀번호(주민등록번호 앞 6자리)입니다. WOORI_BANK_HTML 소스일 때만 필수입니다.'
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  password?: string;
}

