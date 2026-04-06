'use client';

import { ConfirmActionDialog } from '@/shared/ui/confirm-action-dialog';
import {
  readFundingAccountTransitionConfirmColor,
  readFundingAccountTransitionConfirmLabel,
  readFundingAccountTransitionDescription,
  readFundingAccountTransitionTitle,
  type FundingAccountStatusActionTarget
} from './reference-data.shared';

export function FundingAccountStatusDialog({
  target,
  busy,
  onClose,
  onConfirm
}: {
  target: FundingAccountStatusActionTarget;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmActionDialog
      open={target !== null}
      title={readFundingAccountTransitionTitle(target)}
      description={readFundingAccountTransitionDescription(target)}
      confirmLabel={readFundingAccountTransitionConfirmLabel(target)}
      pendingLabel={busy ? '저장 중...' : undefined}
      confirmColor={readFundingAccountTransitionConfirmColor(target)}
      busy={busy}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
