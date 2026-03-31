import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { DashboardReadService } from './dashboard-read.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardReadService: DashboardReadService) {}

  @Get('summary')
  @ApiQuery({ name: 'periodId', required: false })
  getSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('periodId') periodId?: string
  ) {
    return this.dashboardReadService.getSummary(user, periodId);
  }
}
