import { ApiProperty } from '@nestjs/swagger';
import type { UpdateVehicleFuelLogRequest } from '@personal-erp/contracts';
import { IsBoolean, IsDateString, IsInt, IsNumber, Min } from 'class-validator';
import { moneyWonApiProperty } from '../../../common/money/swagger-money';

export class UpdateVehicleFuelLogDto implements UpdateVehicleFuelLogRequest {
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
}
