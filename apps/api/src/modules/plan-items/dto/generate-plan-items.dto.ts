import { ApiProperty } from '@nestjs/swagger';
import type { GeneratePlanItemsRequest } from '@personal-erp/contracts';
import { IsString } from 'class-validator';

export class GeneratePlanItemsRequestDto implements GeneratePlanItemsRequest {
  @ApiProperty()
  @IsString()
  periodId!: string;
}
