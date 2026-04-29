import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import type {
  AuthenticatedUser,
  FundingAccountOverviewResponse
} from '@personal-erp/contracts';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { FundingAccountStatusService } from './funding-account-status.service';

@ApiTags('funding-account-status')
@ApiBearerAuth()
@Controller('funding-account-status')
export class FundingAccountStatusController {
  constructor(
    private readonly fundingAccountStatusService: FundingAccountStatusService
  ) {}

  @Get('summary')
  @ApiQuery({ name: 'basis', required: false })
  @ApiQuery({ name: 'periodId', required: false })
  @ApiQuery({ name: 'fundingAccountId', required: false })
  getSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('basis') basis?: string,
    @Query('periodId') periodId?: string,
    @Query('fundingAccountId') fundingAccountId?: string
  ): Promise<FundingAccountOverviewResponse | null> {
    return this.fundingAccountStatusService.getSummary(user, {
      basis,
      periodId,
      fundingAccountId
    });
  }
}
