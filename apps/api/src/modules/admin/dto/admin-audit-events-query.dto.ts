import { ApiProperty } from '@nestjs/swagger';
import type { AdminAuditEventQuery } from '@personal-erp/contracts';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class AdminAuditEventsQueryDto implements AdminAuditEventQuery {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  eventCategory?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiProperty({ required: false, enum: ['SUCCESS', 'DENIED', 'FAILED'] })
  @IsOptional()
  @IsIn(['SUCCESS', 'DENIED', 'FAILED'])
  result?: 'SUCCESS' | 'DENIED' | 'FAILED';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  actorMembershipId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  requestId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
