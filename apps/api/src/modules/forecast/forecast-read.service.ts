import { Injectable } from '@nestjs/common';
import type {
  AuthenticatedUser,
  ForecastResponse
} from '@personal-erp/contracts';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { projectMonthlyForecast } from './monthly-forecast.projection';
import { ForecastReadRepository } from './forecast-read.repository';

@Injectable()
export class ForecastReadService {
  constructor(
    private readonly forecastReadRepository: ForecastReadRepository
  ) {}

  async getMonthlyForecast(input: {
    user: AuthenticatedUser;
    periodId?: string;
    monthLabel?: string;
  }): Promise<ForecastResponse | null> {
    const workspace = requireCurrentWorkspace(input.user);
    const readModel =
      await this.forecastReadRepository.getMonthlyForecastReadModel({
        userId: input.user.id,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        periodId: input.periodId,
        monthLabel: input.monthLabel
      });
    if (!readModel) {
      return null;
    }

    return projectMonthlyForecast(readModel);
  }
}
