import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  type CreateVehicleMaintenanceLogRequest,
  type VehicleMaintenanceCategory,
  vehicleMaintenanceCategoryValues
} from '@personal-erp/contracts/assets';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested
} from 'class-validator';
import { moneyWonApiProperty } from '../../../common/money/swagger-money';
import { VehicleLogAccountingLinkDto } from './vehicle-log-accounting-link.dto';

export class CreateVehicleMaintenanceLogDto implements CreateVehicleMaintenanceLogRequest {
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

  @ApiProperty({
    required: false,
    nullable: true,
    type: VehicleLogAccountingLinkDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => VehicleLogAccountingLinkDto)
  accountingLink?: VehicleLogAccountingLinkDto | null;
}
