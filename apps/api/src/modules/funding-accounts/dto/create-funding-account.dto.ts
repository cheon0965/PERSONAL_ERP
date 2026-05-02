import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { CreateFundingAccountRequest } from '@personal-erp/contracts';
import { AccountType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateFundingAccountDto implements CreateFundingAccountRequest {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ enum: AccountType })
  @IsEnum(AccountType)
  type!: AccountType;

  @ApiPropertyOptional({
    description:
      '운영 중 등록하는 자금수단의 기초금액 (원). 기초전표가 자동 생성됩니다.'
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  initialBalanceWon?: number;
}
