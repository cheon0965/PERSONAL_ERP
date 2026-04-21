import { ConflictException } from '@nestjs/common';
import {
  AccountingPeriodStatus,
  OpeningBalanceSourceKind
} from '@prisma/client';

const collectingAccountingPeriodStatuses = [
  AccountingPeriodStatus.OPEN,
  AccountingPeriodStatus.IN_REVIEW,
  AccountingPeriodStatus.CLOSING
] as const;

const allowedAccountingPeriodTransitions = new Map<
  AccountingPeriodStatus | null,
  readonly AccountingPeriodStatus[]
>([
  [null, [AccountingPeriodStatus.OPEN]],
  [
    AccountingPeriodStatus.OPEN,
    [
      AccountingPeriodStatus.IN_REVIEW,
      AccountingPeriodStatus.CLOSING,
      AccountingPeriodStatus.LOCKED
    ]
  ],
  [
    AccountingPeriodStatus.IN_REVIEW,
    [
      AccountingPeriodStatus.OPEN,
      AccountingPeriodStatus.CLOSING,
      AccountingPeriodStatus.LOCKED
    ]
  ],
  [
    AccountingPeriodStatus.CLOSING,
    [
      AccountingPeriodStatus.OPEN,
      AccountingPeriodStatus.IN_REVIEW,
      AccountingPeriodStatus.LOCKED
    ]
  ],
  [AccountingPeriodStatus.LOCKED, [AccountingPeriodStatus.OPEN]]
]);

export function readCollectingAccountingPeriodStatuses() {
  return collectingAccountingPeriodStatuses;
}

export function assertAccountingPeriodCanRecordInitialOpen(): void {
  assertAccountingPeriodStatusTransition(null, AccountingPeriodStatus.OPEN);
}

export function assertAccountingPeriodCanBeClosed(
  currentStatus: AccountingPeriodStatus
): void {
  if (currentStatus === AccountingPeriodStatus.LOCKED) {
    throw new ConflictException('이미 잠긴 운영 기간입니다.');
  }

  assertAccountingPeriodStatusTransition(
    currentStatus,
    AccountingPeriodStatus.LOCKED
  );
}

export function assertAccountingPeriodCanBeReopened(
  currentStatus: AccountingPeriodStatus
): void {
  if (currentStatus !== AccountingPeriodStatus.LOCKED) {
    throw new ConflictException('잠금된 운영 기간만 재오픈할 수 있습니다.');
  }

  assertAccountingPeriodStatusTransition(
    currentStatus,
    AccountingPeriodStatus.OPEN
  );
}

export function assertAccountingPeriodCanBeReopenedWithoutDependents(input: {
  carryForwardRecordId: string | null;
  nextOpeningBalanceSourceKind: OpeningBalanceSourceKind | null;
}): void {
  if (input.carryForwardRecordId) {
    throw new ConflictException(
      '차기 이월이 이미 생성된 운영 기간은 재오픈할 수 없습니다.'
    );
  }

  if (input.nextOpeningBalanceSourceKind) {
    throw new ConflictException(
      '다음 운영 기간에 오프닝 잔액 스냅샷이 이미 생성되어 재오픈할 수 없습니다.'
    );
  }
}

function assertAccountingPeriodStatusTransition(
  fromStatus: AccountingPeriodStatus | null,
  toStatus: AccountingPeriodStatus
): void {
  const allowedTransitions = allowedAccountingPeriodTransitions.get(fromStatus);
  if (allowedTransitions?.includes(toStatus)) {
    return;
  }

  const fromLabel = fromStatus ?? 'INITIAL';
  throw new ConflictException(
    `Accounting period status cannot transition from ${fromLabel} to ${toStatus}.`
  );
}
