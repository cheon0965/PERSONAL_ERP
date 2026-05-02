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
      '암호화 원본을 서버에서 안전하게 복호화할 때만 사용하는 비밀번호입니다. 우리은행/우리카드 VestMail은 숫자 6자리, KB국민은행 PDF는 PDF 비밀번호를 입력합니다. 비밀번호는 저장하지 않습니다.'
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  password?: string;
}
