import { ApiProperty } from '@nestjs/swagger';
import type { CreateLiabilityRepaymentScheduleRequest } from '@personal-erp/contracts';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min
} from 'class-validator';
import { moneyWonApiProperty } from '../../../common/money/swagger-money';

export class CreateLiabilityRepaymentScheduleDto
  implements CreateLiabilityRepaymentScheduleRequest
{
  @ApiProperty()
  @IsDateString()
  dueDate!: string;

  @ApiProperty(moneyWonApiProperty({ example: 1_000_000, minimum: 0 }))
  @IsInt()
  @Min(0)
  principalAmount!: number;

  @ApiProperty(moneyWonApiProperty({ example: 50_000, minimum: 0 }))
  @IsOptional()
  @IsInt()
  @Min(0)
  interestAmount?: number;

  @ApiProperty(moneyWonApiProperty({ example: 0, minimum: 0 }))
  @IsOptional()
  @IsInt()
  @Min(0)
  feeAmount?: number;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  memo?: string | null;
}
