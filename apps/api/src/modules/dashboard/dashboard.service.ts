import { Injectable } from '@nestjs/common';
import type { DashboardSummary } from '@personal-erp/contracts';
import { buildDashboardSummary } from './dashboard.calculator';
import { DashboardRepository } from './dashboard.repository';

@Injectable()
export class DashboardService {
  constructor(private readonly dashboardRepository: DashboardRepository) {}

  async getSummary(userId: string): Promise<DashboardSummary> {
    const source = await this.dashboardRepository.getSummarySource(userId);
    return buildDashboardSummary(source);
  }
}
