import { Module } from '@nestjs/common';
import { ForecastController } from './forecast.controller';
import { ForecastReadRepository } from './repositories/forecast-read.repository';
import { ForecastReadService } from './services/forecast-read.service';

@Module({
  controllers: [ForecastController],
  providers: [ForecastReadService, ForecastReadRepository]
})
export class ForecastModule {}
