import { ApiProperty } from '@nestjs/swagger';
import type { UpdateAdminSupportContextRequest } from '@personal-erp/contracts';
import { IsOptional, IsString } from 'class-validator';

export class UpdateAdminSupportContextDto implements UpdateAdminSupportContextRequest {
  @ApiProperty()
  @IsString()
  tenantId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  ledgerId?: string;
}
