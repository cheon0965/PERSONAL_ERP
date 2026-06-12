import { conflictError } from '../../../common/application/errors/app-error';

export type AccountingPeriodStatusValue =
  | 'OPEN'
  | 'IN_REVIEW'
  | 'CLOSING'
  | 'LOCKED';

const collectingAccountingPeriodStatuses = [
  'OPEN',
  'IN_REVIEW',
  'CLOSING'
] as const;

const allowedAccountingPeriodTransitions = new Map<
  AccountingPeriodStatusValue | null,
  readonly AccountingPeriodStatusValue[]
>([
  [null, ['OPEN']],
  ['OPEN', ['IN_REVIEW', 'CLOSING', 'LOCKED']],
  ['IN_REVIEW', ['OPEN', 'CLOSING', 'LOCKED']],
  ['CLOSING', ['OPEN', 'IN_REVIEW', 'LOCKED']],
  ['LOCKED', ['OPEN']]
]);

export function readCollectingAccountingPeriodStatuses() {
  return collectingAccountingPeriodStatuses;
}

export function assertAccountingPeriodCanRecordInitialOpen(): void {
  assertAccountingPeriodStatusTransition(null, 'OPEN');
}

export function assertAccountingPeriodCanBeClosed(
  currentStatus: AccountingPeriodStatusValue
): void {
  if (currentStatus === 'LOCKED') {
    throw conflictError('이미 잠긴 운영 기간입니다.');
  }

  assertAccountingPeriodStatusTransition(currentStatus, 'LOCKED');
}

export function assertAccountingPeriodCanBeReopened(
  currentStatus: AccountingPeriodStatusValue
): void {
  if (currentStatus !== 'LOCKED') {
    throw conflictError('잠금된 운영 기간만 재오픈할 수 있습니다.');
  }

  assertAccountingPeriodStatusTransition(currentStatus, 'OPEN');
}

export function assertAccountingPeriodCanBeReopenedWithoutDependents(input: {
  carryForwardRecordId: string | null;
  nextOpeningBalanceSourceKind: string | null;
}): void {
  if (input.carryForwardRecordId) {
    throw conflictError(
      '차기 이월이 이미 생성된 운영 기간은 재오픈할 수 없습니다.'
    );
  }

  if (input.nextOpeningBalanceSourceKind) {
    throw conflictError(
      '다음 운영 기간에 오프닝 잔액 스냅샷이 이미 생성되어 재오픈할 수 없습니다.'
    );
  }
}

function assertAccountingPeriodStatusTransition(
  fromStatus: AccountingPeriodStatusValue | null,
  toStatus: AccountingPeriodStatusValue
): void {
  const allowedTransitions = allowedAccountingPeriodTransitions.get(fromStatus);
  if (allowedTransitions?.includes(toStatus)) {
    return;
  }

  const fromLabel = fromStatus ?? 'INITIAL';
  throw conflictError(
    `Accounting period status cannot transition from ${fromLabel} to ${toStatus}.`
  );
}
