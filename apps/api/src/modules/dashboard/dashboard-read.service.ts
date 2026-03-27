import { Injectable } from '@nestjs/common';
import type { DashboardSummary } from '@personal-erp/contracts';
import { projectDashboardSummary } from './dashboard-summary.projection';
import { DashboardReadRepository } from './dashboard-read.repository';

@Injectable()
export class DashboardReadService {
  constructor(private readonly dashboardReadRepository: DashboardReadRepository) {}

  async getSummary(userId: string): Promise<DashboardSummary> {
    const readModel = await this.dashboardReadRepository.getDashboardSummaryReadModel(userId);
    return projectDashboardSummary(readModel);
  }
}
