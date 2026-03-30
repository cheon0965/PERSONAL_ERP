import { ApiProperty } from '@nestjs/swagger';
import type { ReverseJournalEntryRequest } from '@personal-erp/contracts';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class ReverseJournalEntryRequestDto
  implements ReverseJournalEntryRequest
{
  @ApiProperty({ example: '2026-04-03' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'entryDate must follow the YYYY-MM-DD format.'
  })
  entryDate!: string;

  @ApiProperty({
    required: false,
    example: 'Reverse the March fuel entry.',
    description: 'Optional reason that becomes the reversal memo.'
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
