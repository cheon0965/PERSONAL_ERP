import { ApiProperty } from '@nestjs/swagger';
import type { CollectImportedRowRequest } from '@personal-erp/contracts';
import { TransactionType } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

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
  @IsBoolean()
  confirmPotentialDuplicate?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  memo?: string;
}
