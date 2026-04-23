import { ApiProperty } from '@nestjs/swagger';
import type { UpdateLiabilityRepaymentScheduleRequest } from '@personal-erp/contracts';
import { LiabilityRepaymentScheduleStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateLiabilityRepaymentScheduleDto } from './create-liability-repayment-schedule.dto';

export class UpdateLiabilityRepaymentScheduleDto
  extends CreateLiabilityRepaymentScheduleDto
  implements UpdateLiabilityRepaymentScheduleRequest
{
  @ApiProperty({ enum: LiabilityRepaymentScheduleStatus, required: false })
  @IsOptional()
  @IsEnum(LiabilityRepaymentScheduleStatus)
  status?: LiabilityRepaymentScheduleStatus;
}
