import { ApiProperty } from '@nestjs/swagger';
import type { CreateFundingAccountRequest } from '@personal-erp/contracts';
import { AccountType } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';

export class CreateFundingAccountDto implements CreateFundingAccountRequest {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ enum: AccountType })
  @IsEnum(AccountType)
  type!: AccountType;
}
