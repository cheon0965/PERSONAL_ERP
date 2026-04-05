import { ApiProperty } from '@nestjs/swagger';
import type { CreateCategoryRequest } from '@personal-erp/contracts';
import { CategoryKind } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';

export class CreateCategoryDto implements CreateCategoryRequest {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ enum: CategoryKind })
  @IsEnum(CategoryKind)
  kind!: CategoryKind;
}
