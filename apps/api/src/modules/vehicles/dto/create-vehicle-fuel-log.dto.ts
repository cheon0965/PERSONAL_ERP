import { ApiProperty } from '@nestjs/swagger';
import type { CreateVehicleFuelLogRequest } from '@personal-erp/contracts';
import { IsBoolean, IsDateString, IsInt, IsNumber, Min } from 'class-validator';

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

  @ApiProperty()
  @IsInt()
  @Min(0)
  amountWon!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  unitPriceWon!: number;

  @ApiProperty()
  @IsBoolean()
  isFullTank!: boolean;
}
