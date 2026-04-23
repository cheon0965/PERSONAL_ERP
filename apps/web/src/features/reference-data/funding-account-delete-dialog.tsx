'use client';

import { ConfirmActionDialog } from '@/shared/ui/confirm-action-dialog';
import {
  readFundingAccountDeleteDescription,
  type FundingAccountDeleteTarget
} from './reference-data.shared';

export function FundingAccountDeleteDialog({
  target,
  busy,
  onClose,
  onConfirm
}: {
  target: FundingAccountDeleteTarget;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmActionDialog
      open={target !== null}
      title="자금수단 삭제"
      description={readFundingAccountDeleteDescription(target)}
      confirmLabel="삭제"
      pendingLabel={busy ? '삭제 중...' : undefined}
      confirmColor="error"
      busy={busy}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
