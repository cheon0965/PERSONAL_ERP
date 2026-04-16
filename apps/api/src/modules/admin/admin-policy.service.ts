import { Injectable } from '@nestjs/common';
import type { AdminPolicySummary } from '@personal-erp/contracts';
import type { RequiredWorkspaceContext } from '../../common/auth/required-workspace.util';
import { NavigationService } from '../navigation/public';

@Injectable()
export class AdminPolicyService {
  constructor(private readonly navigationService: NavigationService) {}

  getSummary(workspace: RequiredWorkspaceContext): Promise<AdminPolicySummary> {
    return this.navigationService.getPolicySummary(workspace);
  }
}
