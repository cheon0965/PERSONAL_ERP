import type { GenerateCarryForwardRequest } from '@personal-erp/contracts';
import { IsString, MinLength } from 'class-validator';

export class GenerateCarryForwardRequestDto implements GenerateCarryForwardRequest {
  @IsString()
  @MinLength(1)
  fromPeriodId!: string;
}
