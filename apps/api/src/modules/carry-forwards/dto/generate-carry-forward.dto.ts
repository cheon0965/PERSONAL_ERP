import type { GenerateCarryForwardRequest } from '@personal-erp/contracts';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from 'class-validator';

export class GenerateCarryForwardRequestDto implements GenerateCarryForwardRequest {
  @IsString()
  @MinLength(1)
  fromPeriodId!: string;

  @IsOptional()
  @IsBoolean()
  replaceExisting?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  replaceReason?: string;
}
