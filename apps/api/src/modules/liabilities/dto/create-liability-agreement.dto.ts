import { ApiProperty } from '@nestjs/swagger';
import type { CreateLiabilityAgreementRequest } from '@personal-erp/contracts';
import {
  LiabilityAgreementStatus,
  LiabilityInterestRateType,
  LiabilityRepaymentMethod
} from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength
} from 'class-validator';
import { moneyWonApiProperty } from '../../../common/money/swagger-money';

export class CreateLiabilityAgreementDto
  implements CreateLiabilityAgreementRequest
{
  @ApiProperty()
  @IsString()
  @MinLength(1)
  lenderName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  productName!: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,4}$/)
  loanNumberLast4?: string | null;

  @ApiProperty(moneyWonApiProperty({ example: 30_000_000, minimum: 1 }))
  @IsInt()
  @Min(1)
  principalAmount!: number;

  @ApiProperty()
  @IsDateString()
  borrowedAt!: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsDateString()
  maturityDate?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  interestRate?: number | null;

  @ApiProperty({ enum: LiabilityInterestRateType })
  @IsEnum(LiabilityInterestRateType)
  interestRateType!: LiabilityInterestRateType;

  @ApiProperty({ enum: LiabilityRepaymentMethod })
  @IsEnum(LiabilityRepaymentMethod)
  repaymentMethod!: LiabilityRepaymentMethod;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  paymentDay?: number | null;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  defaultFundingAccountId!: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  liabilityAccountSubjectId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  interestExpenseCategoryId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  feeExpenseCategoryId?: string | null;

  @ApiProperty({ enum: LiabilityAgreementStatus, required: false })
  @IsOptional()
  @IsEnum(LiabilityAgreementStatus)
  status?: LiabilityAgreementStatus;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  memo?: string | null;
}
