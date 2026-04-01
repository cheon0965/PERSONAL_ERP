import { ApiProperty } from '@nestjs/swagger';
import type { CollectImportedRowRequest } from '@personal-erp/contracts';
import { TransactionType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CollectImportedRowRequestDto implements CollectImportedRowRequest {
  @ApiProperty({ enum: TransactionType })
  @IsEnum(TransactionType)
  type!: TransactionType;

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
