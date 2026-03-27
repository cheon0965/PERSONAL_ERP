import { Injectable } from '@nestjs/common';
import type { ForecastResponse } from '@personal-erp/contracts';
import { projectMonthlyForecast } from './monthly-forecast.projection';
import { ForecastReadRepository } from './forecast-read.repository';

@Injectable()
export class ForecastReadService {
  constructor(private readonly forecastReadRepository: ForecastReadRepository) {}

  async getMonthlyForecast(userId: string, month: string): Promise<ForecastResponse> {
    const readModel = await this.forecastReadRepository.getMonthlyForecastReadModel(userId);
    return projectMonthlyForecast(month, readModel);
  }
}
