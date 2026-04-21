import type { CancelCarryForwardRequest } from '@personal-erp/contracts';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelCarryForwardRequestDto implements CancelCarryForwardRequest {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
