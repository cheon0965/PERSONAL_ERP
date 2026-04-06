'use client';

import type { CategoryItem } from '@personal-erp/contracts';
import { ConfirmActionDialog } from '@/shared/ui/confirm-action-dialog';
import {
  readCategoryToggleConfirmLabel,
  readCategoryToggleDescription,
  readCategoryToggleTitle
} from './reference-data.shared';

export function CategoryToggleDialog({
  target,
  busy,
  onClose,
  onConfirm
}: {
  target: CategoryItem | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmActionDialog
      open={target !== null}
      title={readCategoryToggleTitle(target)}
      description={readCategoryToggleDescription(target)}
      confirmLabel={readCategoryToggleConfirmLabel(target)}
      pendingLabel={busy ? '저장 중...' : undefined}
      confirmColor={target?.isActive ? 'warning' : 'primary'}
      busy={busy}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
