import { ApiProperty } from '@nestjs/swagger';
import type {
  CreateOperationsExportRequest,
  OperationsExportScope
} from '@personal-erp/contracts';
import { IsIn, IsOptional, IsString } from 'class-validator';

export const operationsExportScopes: OperationsExportScope[] = [
  'REFERENCE_DATA',
  'COLLECTED_TRANSACTIONS',
  'JOURNAL_ENTRIES',
  'FINANCIAL_STATEMENTS'
];

export class CreateOperationsExportDto implements CreateOperationsExportRequest {
  @ApiProperty({ enum: operationsExportScopes })
  @IsIn(operationsExportScopes)
  scope!: OperationsExportScope;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  periodId?: string | null;
}
