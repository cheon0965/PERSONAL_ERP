import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import type { CreateVehicleFuelLogRequest } from '@personal-erp/contracts';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested
} from 'class-validator';
import { moneyWonApiProperty } from '../../../common/money/swagger-money';
import { VehicleLogAccountingLinkDto } from './vehicle-log-accounting-link.dto';

export class CreateVehicleFuelLogDto implements CreateVehicleFuelLogRequest {
  @ApiProperty()
  @IsDateString()
  filledOn!: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  odometerKm!: number;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  liters!: number;

  @ApiProperty(moneyWonApiProperty({ example: 84000, minimum: 0 }))
  @IsInt()
  @Min(0)
  amountWon!: number;

  @ApiProperty(moneyWonApiProperty({ example: 1700, minimum: 0 }))
  @IsInt()
  @Min(0)
  unitPriceWon!: number;

  @ApiProperty()
  @IsBoolean()
  isFullTank!: boolean;

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
