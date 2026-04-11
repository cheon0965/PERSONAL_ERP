import { ApiProperty } from '@nestjs/swagger';
import type { CreateInsurancePolicyRequest } from '@personal-erp/contracts';
import { InsuranceCycle } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength
} from 'class-validator';
import { moneyWonApiProperty } from '../../../common/money/swagger-money';

export class CreateInsurancePolicyDto implements CreateInsurancePolicyRequest {
  @ApiProperty()
  @IsString()
  provider!: string;

  @ApiProperty()
  @IsString()
  productName!: string;

  @ApiProperty(moneyWonApiProperty({ example: 85000, minimum: 1 }))
  @IsInt()
  @Min(1)
  monthlyPremiumWon!: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(31)
  paymentDay!: number;

  @ApiProperty({ enum: InsuranceCycle })
  @IsEnum(InsuranceCycle)
  cycle!: InsuranceCycle;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  fundingAccountId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  categoryId!: string;

  @ApiProperty()
  @IsDateString()
  recurringStartDate!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  renewalDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  maturityDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
