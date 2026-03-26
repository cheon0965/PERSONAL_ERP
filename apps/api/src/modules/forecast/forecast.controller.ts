import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { ForecastService } from './forecast.service';

@ApiTags('forecast')
@ApiBearerAuth()
@Controller('forecast')
export class ForecastController {
  constructor(private readonly forecastService: ForecastService) {}

  @Get('monthly')
  @ApiQuery({ name: 'month', required: false, example: '2026-03' })
  getMonthly(@CurrentUser() user: AuthenticatedUser, @Query('month') month?: string) {
    return this.forecastService.getMonthlyForecast(user.id, month ?? '2026-03');
  }
}
