import { ApiProperty } from '@nestjs/swagger';
import type {
  CorrectJournalEntryLineInput,
  CorrectJournalEntryRequest
} from '@personal-erp/contracts';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested
} from 'class-validator';
import { moneyWonApiProperty } from '../../../common/money/swagger-money';

class CorrectJournalEntryLineInputDto implements CorrectJournalEntryLineInput {
  @ApiProperty({ example: 'as-1-5100' })
  @IsString()
  accountSubjectId!: string;

  @ApiProperty({ required: false, example: 'acc-1' })
  @IsOptional()
  @IsString()
  fundingAccountId?: string;

  @ApiProperty(moneyWonApiProperty({ example: 84000, minimum: 0 }))
  @IsInt()
  @Min(0)
  debitAmount!: number;

  @ApiProperty(moneyWonApiProperty({ example: 0, minimum: 0 }))
  @IsInt()
  @Min(0)
  creditAmount!: number;

  @ApiProperty({ required: false, example: 'Adjusted fuel expense' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;
}

export class CorrectJournalEntryRequestDto implements CorrectJournalEntryRequest {
  @ApiProperty({ example: '2026-04-04' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'entryDate must follow the YYYY-MM-DD format.'
  })
  entryDate!: string;

  @ApiProperty({
    example: 'Adjust the posted amount after invoice verification.',
    description: 'Reason recorded on the correction journal entry.'
  })
  @IsString()
  @MaxLength(300)
  reason!: string;

  @ApiProperty({ type: () => [CorrectJournalEntryLineInputDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CorrectJournalEntryLineInputDto)
  lines!: CorrectJournalEntryLineInputDto[];
}
