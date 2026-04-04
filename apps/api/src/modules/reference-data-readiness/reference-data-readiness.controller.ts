import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  AuthenticatedUser,
  ReferenceDataReadinessSummary
} from '@personal-erp/contracts';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { ReferenceDataReadinessService } from './reference-data-readiness.service';

@ApiTags('reference-data')
@ApiBearerAuth()
@Controller('reference-data')
export class ReferenceDataReadinessController {
  constructor(
    private readonly referenceDataReadinessService: ReferenceDataReadinessService
  ) {}

  @Get('readiness')
  getReadiness(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<ReferenceDataReadinessSummary> {
    return this.referenceDataReadinessService.getSummary(user);
  }
}
