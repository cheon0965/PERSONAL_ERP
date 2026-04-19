import { ApiProperty } from '@nestjs/swagger';
import type { UpdateAdminUserSystemAdminRequest } from '@personal-erp/contracts';
import { IsBoolean } from 'class-validator';

export class UpdateAdminUserSystemAdminDto
  implements UpdateAdminUserSystemAdminRequest
{
  @ApiProperty()
  @IsBoolean()
  isSystemAdmin!: boolean;
}
