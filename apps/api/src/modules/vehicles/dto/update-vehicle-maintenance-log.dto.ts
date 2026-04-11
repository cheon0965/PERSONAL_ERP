import { ApiProperty } from '@nestjs/swagger';
import {
  type UpdateVehicleMaintenanceLogRequest,
  type VehicleMaintenanceCategory,
  vehicleMaintenanceCategoryValues
} from '@personal-erp/contracts/assets';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min
} from 'class-validator';
import { moneyWonApiProperty } from '../../../common/money/swagger-money';

export class UpdateVehicleMaintenanceLogDto implements UpdateVehicleMaintenanceLogRequest {
  @ApiProperty()
  @IsDateString()
  performedOn!: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  odometerKm!: number;

  @ApiProperty({ enum: vehicleMaintenanceCategoryValues })
  @IsIn(vehicleMaintenanceCategoryValues)
  category!: VehicleMaintenanceCategory;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  vendor?: string | null;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty(moneyWonApiProperty({ example: 120000, minimum: 0 }))
  @IsInt()
  @Min(0)
  amountWon!: number;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  memo?: string | null;
}
