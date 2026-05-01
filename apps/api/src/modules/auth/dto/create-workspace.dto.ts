import { ApiProperty } from '@nestjs/swagger';
import type { CreateWorkspaceRequest } from '@personal-erp/contracts';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength
} from 'class-validator';

export class CreateWorkspaceDto implements CreateWorkspaceRequest {
  @ApiProperty({ example: '두 번째 사업장' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  tenantName!: string;

  @ApiProperty({ example: 'second-workspace' })
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  @Matches(/^[a-z0-9-]+$/)
  tenantSlug!: string;

  @ApiProperty({ example: '기본 장부' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  ledgerName!: string;

  @ApiProperty({ example: 'KRW' })
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  baseCurrency!: string;

  @ApiProperty({ example: 'Asia/Seoul' })
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  timezone!: string;

  @ApiProperty({ example: '2026-05', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  openedFromYearMonth?: string;
}
