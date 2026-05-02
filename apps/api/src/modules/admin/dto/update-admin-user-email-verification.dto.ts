import { ApiProperty } from '@nestjs/swagger';
import type { UpdateAdminUserEmailVerificationRequest } from '@personal-erp/contracts';
import { IsIn } from 'class-validator';

export class UpdateAdminUserEmailVerificationDto implements UpdateAdminUserEmailVerificationRequest {
  @ApiProperty({ enum: [true] })
  @IsIn([true])
  emailVerified!: true;
}
