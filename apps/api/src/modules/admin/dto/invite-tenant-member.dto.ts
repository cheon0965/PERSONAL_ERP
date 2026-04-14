import { ApiProperty } from '@nestjs/swagger';
import type { InviteTenantMemberRequest } from '@personal-erp/contracts';
import { TenantMembershipRole } from '@prisma/client';
import { IsEmail, IsEnum } from 'class-validator';

export class InviteTenantMemberDto implements InviteTenantMemberRequest {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: TenantMembershipRole })
  @IsEnum(TenantMembershipRole)
  role!: TenantMembershipRole;
}
