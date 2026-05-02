import { ApiProperty } from '@nestjs/swagger';
import type {
  TenantStatus,
  UpdateAdminTenantStatusRequest
} from '@personal-erp/contracts';
import { IsIn } from 'class-validator';

const TENANT_STATUSES = ['TRIAL', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'] as const;

export class UpdateAdminTenantStatusDto implements UpdateAdminTenantStatusRequest {
  @ApiProperty({ enum: TENANT_STATUSES })
  @IsIn(TENANT_STATUSES)
  status!: TenantStatus;
}
