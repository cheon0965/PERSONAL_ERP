import { ApiProperty } from '@nestjs/swagger';
import type { UpdateTenantMemberRoleRequest } from '@personal-erp/contracts';
import { TenantMembershipRole } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateTenantMemberRoleDto implements UpdateTenantMemberRoleRequest {
  @ApiProperty({ enum: TenantMembershipRole })
  @IsEnum(TenantMembershipRole)
  role!: TenantMembershipRole;
}
