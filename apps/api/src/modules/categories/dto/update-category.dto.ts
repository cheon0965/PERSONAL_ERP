import { ApiProperty } from '@nestjs/swagger';
import type { UpdateCategoryRequest } from '@personal-erp/contracts';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateCategoryDto implements UpdateCategoryRequest {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
