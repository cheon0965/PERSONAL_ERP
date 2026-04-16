import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional
} from 'class-validator';
import { TenantMembershipRole } from '@prisma/client';

export class UpdateNavigationMenuItemDto {
  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(TenantMembershipRole, { each: true })
  allowedRoles?: TenantMembershipRole[];
}
