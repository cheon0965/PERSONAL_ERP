import { ApiProperty } from '@nestjs/swagger';
import type { UpdateFundingAccountRequest } from '@personal-erp/contracts';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateFundingAccountDto implements UpdateFundingAccountRequest {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({
    required: false,
    enum: ['ACTIVE', 'INACTIVE', 'CLOSED']
  })
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'CLOSED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'CLOSED';
}
