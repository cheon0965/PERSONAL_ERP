import { ApiProperty } from '@nestjs/swagger';
import type { VehicleLogAccountingLinkRequest } from '@personal-erp/contracts';
import { IsOptional, IsString } from 'class-validator';

export class VehicleLogAccountingLinkDto
  implements VehicleLogAccountingLinkRequest
{
  @ApiProperty()
  @IsString()
  fundingAccountId!: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  categoryId?: string | null;
}
