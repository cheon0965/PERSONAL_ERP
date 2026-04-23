import { ApiProperty } from '@nestjs/swagger';
import type { SwitchWorkspaceRequest } from '@personal-erp/contracts';
import { IsOptional, IsString } from 'class-validator';

export class SwitchWorkspaceDto implements SwitchWorkspaceRequest {
  @ApiProperty()
  @IsString()
  tenantId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  ledgerId?: string;
}
