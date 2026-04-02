import { ApiProperty } from '@nestjs/swagger';
import type { UpdateCollectedTransactionRequest } from '@personal-erp/contracts';
import { TransactionType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min
} from 'class-validator';

export class UpdateCollectedTransactionRequestDto
  implements UpdateCollectedTransactionRequest
{
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty({ enum: TransactionType })
  @IsEnum(TransactionType)
  type!: TransactionType;

  @ApiProperty({ example: 125000 })
  @IsInt()
  @Min(1)
  amountWon!: number;

  @ApiProperty({ example: '2026-03-19' })
  @IsDateString()
  businessDate!: string;

  @ApiProperty()
  @IsString()
  fundingAccountId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  memo?: string;
}