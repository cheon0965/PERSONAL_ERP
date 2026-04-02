import { ApiProperty } from '@nestjs/swagger';
import type { UpdateRecurringRuleRequest } from '@personal-erp/contracts';
import { RecurrenceFrequency } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min
} from 'class-validator';

export class UpdateRecurringRuleDto implements UpdateRecurringRuleRequest {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty()
  @IsString()
  fundingAccountId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  amountWon!: number;

  @ApiProperty({ enum: RecurrenceFrequency })
  @IsEnum(RecurrenceFrequency)
  frequency!: RecurrenceFrequency;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dayOfMonth?: number;

  @ApiProperty()
  @IsDateString()
  startDate!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}