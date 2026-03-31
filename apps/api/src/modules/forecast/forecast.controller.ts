import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { ForecastReadService } from './forecast-read.service';

@ApiTags('forecast')
@ApiBearerAuth()
@Controller('forecast')
export class ForecastController {
  constructor(private readonly forecastReadService: ForecastReadService) {}

  @Get('monthly')
  @ApiQuery({ name: 'periodId', required: false })
  @ApiQuery({ name: 'month', required: false, example: '2026-03' })
  getMonthly(
    @CurrentUser() user: AuthenticatedUser,
    @Query('periodId') periodId?: string,
    @Query('month') month?: string
  ) {
    return this.forecastReadService.getMonthlyForecast({
      user,
      periodId,
      monthLabel: month
    });
  }
}
