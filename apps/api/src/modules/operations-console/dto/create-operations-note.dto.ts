import { ApiProperty } from '@nestjs/swagger';
import type {
  CreateOperationsNoteRequest,
  OperationsNoteKind
} from '@personal-erp/contracts';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from 'class-validator';

export const operationsNoteKinds: OperationsNoteKind[] = [
  'GENERAL',
  'MONTH_END',
  'EXCEPTION',
  'ALERT',
  'FOLLOW_UP'
];

export class CreateOperationsNoteDto implements CreateOperationsNoteRequest {
  @ApiProperty({ enum: operationsNoteKinds })
  @IsIn(operationsNoteKinds)
  kind!: OperationsNoteKind;

  @ApiProperty({ example: '3월 마감 인수인계' })
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  title!: string;

  @ApiProperty({ example: '카드 업로드 2건은 다음 근무자가 확인해야 합니다.' })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;

  @ApiProperty({
    required: false,
    nullable: true,
    example: '/operations/alerts'
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  relatedHref?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  periodId?: string | null;
}
