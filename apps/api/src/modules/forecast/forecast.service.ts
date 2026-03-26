import { Injectable } from '@nestjs/common';
import type { ForecastResponse } from '@personal-erp/contracts';
import { buildMonthlyForecast } from './forecast.calculator';
import { ForecastRepository } from './forecast.repository';

@Injectable()
export class ForecastService {
  constructor(private readonly forecastRepository: ForecastRepository) {}

  async getMonthlyForecast(userId: string, month: string): Promise<ForecastResponse> {
    const source = await this.forecastRepository.getForecastSource(userId);
    return buildMonthlyForecast(month, source);
  }
}
