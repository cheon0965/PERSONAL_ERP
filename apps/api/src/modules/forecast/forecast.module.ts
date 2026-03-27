import { Module } from '@nestjs/common';
import { ForecastController } from './forecast.controller';
import { ForecastReadRepository } from './forecast-read.repository';
import { ForecastReadService } from './forecast-read.service';

@Module({
  controllers: [ForecastController],
  providers: [ForecastReadService, ForecastReadRepository]
})
export class ForecastModule {}
