import { ApiProperty } from '@nestjs/swagger';
import type { AcceptInvitationRequest } from '@personal-erp/contracts';
import { IsString, MinLength } from 'class-validator';

export class AcceptInvitationDto implements AcceptInvitationRequest {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  token!: string;
}
