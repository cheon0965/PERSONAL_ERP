import { ApiProperty } from '@nestjs/swagger';
import type {
  AdminSecurityThreatCategory,
  AdminSecurityThreatEventQuery,
  AdminSecurityThreatSeverity
} from '@personal-erp/contracts';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const SECURITY_THREAT_SEVERITIES = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
] as const;

const SECURITY_THREAT_CATEGORIES = [
  'AUTHENTICATION',
  'REGISTRATION',
  'SESSION',
  'EMAIL_VERIFICATION',
  'ACCESS_CONTROL',
  'BROWSER_ORIGIN',
  'EMAIL_DELIVERY',
  'SYSTEM'
] as const;

export class AdminSecurityThreatEventsQueryDto
  implements AdminSecurityThreatEventQuery
{
  @ApiProperty({ required: false, enum: SECURITY_THREAT_SEVERITIES })
  @IsOptional()
  @IsIn(SECURITY_THREAT_SEVERITIES)
  severity?: AdminSecurityThreatSeverity;

  @ApiProperty({ required: false, enum: SECURITY_THREAT_CATEGORIES })
  @IsOptional()
  @IsIn(SECURITY_THREAT_CATEGORIES)
  eventCategory?: AdminSecurityThreatCategory;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  eventName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  requestId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  clientIpHash?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  userId?: string;

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
