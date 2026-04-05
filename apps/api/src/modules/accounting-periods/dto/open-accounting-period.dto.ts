import { ApiProperty } from '@nestjs/swagger';
import type { OpenAccountingPeriodRequest } from '@personal-erp/contracts';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  Matches,
  MaxLength,
  ValidateNested
} from 'class-validator';

class OpenAccountingPeriodOpeningBalanceLineDto {
  @ApiProperty({
    example: 'as-1-1010',
    description: '오프닝 잔액 라인에 반영할 계정과목 ID'
  })
  @IsString()
  accountSubjectId!: string;

  @ApiProperty({
    required: false,
    example: 'acc-1',
    description: '필요 시 연결할 자금수단 ID'
  })
  @IsOptional()
  @IsString()
  fundingAccountId?: string | null;

  @ApiProperty({
    example: 3000000,
    description: '자연잔액 기준 오프닝 금액(원 단위 정수)'
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  balanceAmount!: number;
}

export class OpenAccountingPeriodRequestDto implements OpenAccountingPeriodRequest {
  @ApiProperty({ example: '2026-03' })
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'month는 YYYY-MM 형식이어야 합니다.'
  })
  month!: string;

  @ApiProperty({
    required: false,
    example: true,
    description: '첫 월 운영 시작 시 오프닝 잔액 스냅샷을 함께 생성할지 여부'
  })
  @IsOptional()
  @IsBoolean()
  initializeOpeningBalance?: boolean;

  @ApiProperty({
    required: false,
    type: [OpenAccountingPeriodOpeningBalanceLineDto],
    description:
      '첫 월 운영 시작 시 함께 저장할 오프닝 잔액 라인 목록'
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpenAccountingPeriodOpeningBalanceLineDto)
  openingBalanceLines?: OpenAccountingPeriodOpeningBalanceLineDto[];

  @ApiProperty({
    required: false,
    example: '2026년 3월 운영 시작',
    description: '월 운영 시작 사유 또는 메모'
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
