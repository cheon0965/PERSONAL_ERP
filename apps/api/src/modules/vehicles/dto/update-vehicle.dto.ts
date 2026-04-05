import { ApiProperty } from '@nestjs/swagger';
import type { UpdateVehicleRequest } from '@personal-erp/contracts';
import { FuelType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min
} from 'class-validator';

export class UpdateVehicleDto implements UpdateVehicleRequest {
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

  @ApiProperty()
  @IsInt()
  @Min(0)
  monthlyExpenseWon!: number;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  estimatedFuelEfficiencyKmPerLiter?: number | null;
}
