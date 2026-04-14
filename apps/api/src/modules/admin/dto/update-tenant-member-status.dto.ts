import { ApiProperty } from '@nestjs/swagger';
import type { UpdateTenantMemberStatusRequest } from '@personal-erp/contracts';
import { IsIn } from 'class-validator';

export class UpdateTenantMemberStatusDto implements UpdateTenantMemberStatusRequest {
  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED', 'REMOVED'] })
  @IsIn(['ACTIVE', 'SUSPENDED', 'REMOVED'])
  status!: 'ACTIVE' | 'SUSPENDED' | 'REMOVED';
}
