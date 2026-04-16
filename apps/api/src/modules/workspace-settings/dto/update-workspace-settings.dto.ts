import { ApiProperty } from '@nestjs/swagger';
import type { UpdateWorkspaceSettingsRequest } from '@personal-erp/contracts';
import { TenantStatus } from '@prisma/client';
import {
  IsEnum,
  IsString,
  Matches,
  MaxLength,
  MinLength
} from 'class-validator';

export class UpdateWorkspaceSettingsDto implements UpdateWorkspaceSettingsRequest {
  @ApiProperty({ example: 'PERSONAL_ERP Demo Workspace' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  tenantName!: string;

  @ApiProperty({ example: 'demo-tenant' })
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  @Matches(/^[a-z0-9-]+$/)
  tenantSlug!: string;

  @ApiProperty({ enum: TenantStatus })
  @IsEnum(TenantStatus)
  tenantStatus!: TenantStatus;

  @ApiProperty({ example: '사업 장부' })
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
}
