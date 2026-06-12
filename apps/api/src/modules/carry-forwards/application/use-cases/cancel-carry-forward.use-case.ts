import { ApplicationService } from '../../../../common/application/application-service.decorator';
import type {
  AuthenticatedUser,
  CancelCarryForwardRequest,
  CancelCarryForwardResponse
} from '@personal-erp/contracts';
import { requireCurrentWorkspace } from '../../../../common/auth/required-workspace.util';
import { assertWorkspaceActionAllowed } from '../../../../common/auth/workspace-action.policy';
import { readNextMonth } from '../../domain/carry-forward.policy';
import { CarryForwardCancellationPort } from '../ports/carry-forward-cancellation.port';

@ApplicationService()
export class CancelCarryForwardUseCase {
  constructor(
    private readonly cancellationPort: CarryForwardCancellationPort
  ) {}

  async execute(
    user: AuthenticatedUser,
    carryForwardRecordId: string,
    input: CancelCarryForwardRequest
  ): Promise<CancelCarryForwardResponse> {
    const workspace = requireCurrentWorkspace(user);
    assertCancelPermission(workspace.membershipRole);

    return this.cancellationPort.cancelInWorkspace({
      tenantId: workspace.tenantId,
      ledgerId: workspace.ledgerId,
      carryForwardRecordId,
      reason: input.reason
    });
  }

  async cancelExistingByFromPeriod(
    user: AuthenticatedUser,
    fromPeriodId: string,
    reason?: string
  ): Promise<CancelCarryForwardResponse> {
    const workspace = requireCurrentWorkspace(user);
    assertCancelPermission(workspace.membershipRole);

    return this.cancellationPort.cancelInWorkspace({
      tenantId: workspace.tenantId,
      ledgerId: workspace.ledgerId,
      fromPeriodId,
      reason
    });
  }
}

function assertCancelPermission(
  membershipRole: ReturnType<typeof requireCurrentWorkspace>['membershipRole']
) {
  return assertWorkspaceActionAllowed(membershipRole, 'carry_forward.cancel');
}

export function buildCarryForwardReplaceReason(year: number, month: number) {
  const { monthLabel } = readNextMonth(year, month);
  return `${monthLabel} 오프닝 기준 재생성을 위한 기존 차기 이월 취소`;
}
