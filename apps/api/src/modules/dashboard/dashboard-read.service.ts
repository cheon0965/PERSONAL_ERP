import { Injectable } from '@nestjs/common';
import type {
  AuthenticatedUser,
  DashboardSummary
} from '@personal-erp/contracts';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { projectDashboardSummary } from './dashboard-summary.projection';
import { DashboardReadRepository } from './dashboard-read.repository';

@Injectable()
export class DashboardReadService {
  constructor(
    private readonly dashboardReadRepository: DashboardReadRepository
  ) {}

  async getSummary(
    user: AuthenticatedUser,
    periodId?: string
  ): Promise<DashboardSummary | null> {
    const workspace = requireCurrentWorkspace(user);
    const readModel =
      await this.dashboardReadRepository.getDashboardSummaryReadModel({
        userId: user.id,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        periodId
      });
    if (!readModel) {
      return null;
    }

    return projectDashboardSummary(readModel);
  }
}
