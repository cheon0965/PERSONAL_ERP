import { ApiProperty } from '@nestjs/swagger';
import type { CreateVehicleRequest } from '@personal-erp/contracts';
import { FuelType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min
} from 'class-validator';

export class CreateVehicleDto implements CreateVehicleRequest {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  manufacturer?: string | null;

  @ApiProperty({ enum: FuelType })
  @IsEnum(FuelType)
  fuelType!: FuelType;

  @ApiProperty()
  @IsInt()
  @Min(0)
  initialOdometerKm!: number;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  estimatedFuelEfficiencyKmPerLiter?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  defaultFundingAccountId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  defaultFuelCategoryId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  defaultMaintenanceCategoryId?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  operatingExpensePlanOptIn?: boolean;
}
