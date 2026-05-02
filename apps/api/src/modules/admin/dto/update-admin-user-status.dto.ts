import { ApiProperty } from '@nestjs/swagger';
import type {
  UpdateAdminUserStatusRequest,
  UserStatus
} from '@personal-erp/contracts';
import { IsIn, IsOptional, IsString } from 'class-validator';

const USER_STATUSES = ['ACTIVE', 'LOCKED', 'DISABLED'] as const;

export class UpdateAdminUserStatusDto implements UpdateAdminUserStatusRequest {
  @ApiProperty({ enum: USER_STATUSES })
  @IsIn(USER_STATUSES)
  status!: UserStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
