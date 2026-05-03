import assert from 'node:assert/strict';
import test from 'node:test';
import type { AccountingPeriodItem } from '@personal-erp/contracts';
import {
  readLatestCollectingAccountingPeriod,
  readLatestCollectingAccountingPeriods,
  readLatestJournalWritableAccountingPeriod,
  readLatestJournalWritableAccountingPeriods
} from '../src/features/accounting-periods/accounting-period-selection';
import { buildAccountingPeriodReopenEligibility } from '../src/features/accounting-periods/accounting-period-reopen-eligibility';

test('latest write-period helpers return only the newest collecting and journal-writable month', () => {
  const periods = [
    createPeriod('period-2026-02', 2026, 2, 'OPEN'),
    createPeriod('period-2026-04', 2026, 4, 'CLOSING'),
    createPeriod('period-2026-03', 2026, 3, 'IN_REVIEW'),
    createPeriod('period-2026-05', 2026, 5, 'LOCKED')
  ];

  assert.equal(
    readLatestCollectingAccountingPeriod(periods)?.id,
    'period-2026-04'
  );
  assert.deepEqual(
    readLatestCollectingAccountingPeriods(periods).map((period) => period.id),
    ['period-2026-04']
  );
  assert.equal(
    readLatestJournalWritableAccountingPeriod(periods)?.id,
    'period-2026-03'
  );
  assert.deepEqual(
    readLatestJournalWritableAccountingPeriods(periods).map(
      (period) => period.id
    ),
    ['period-2026-03']
  );
});

test('reopen eligibility blocks older locked months when the latest month is not a rollbackable successor', () => {
  const olderLockedPeriod = createPeriod('period-2026-03', 2026, 3, 'LOCKED');
  const latestOpenPeriod = createPeriod('period-2026-05', 2026, 5, 'OPEN');

  const eligibility = buildAccountingPeriodReopenEligibility({
    period: olderLockedPeriod,
    periods: [latestOpenPeriod, olderLockedPeriod],
    carryForwardView: null,
    carryForwardError: null,
    carryForwardPending: false
  });

  assert.equal(eligibility.canReopen, false);
  assert.equal(eligibility.statusLabel, '최신 월 아님');
  assert.match(
    eligibility.detailLines[0] ?? '',
    /최근 운영 월 2026-05이 이미 존재해 2026-03은 재오픈할 수 없습니다/
  );
});

test('reopen eligibility allows an older locked month when the empty latest successor can be rolled back', () => {
  const olderLockedPeriod = createPeriod('period-2026-03', 2026, 3, 'LOCKED');
  const latestOpenPeriod = createPeriod('period-2026-04', 2026, 4, 'OPEN');

  const eligibility = buildAccountingPeriodReopenEligibility({
    period: olderLockedPeriod,
    periods: [latestOpenPeriod, olderLockedPeriod],
    carryForwardView: null,
    carryForwardError: null,
    carryForwardPending: false
  });

  assert.equal(eligibility.canReopen, true);
  assert.equal(eligibility.statusLabel, '다음 월 롤백 가능');
  assert.match(
    eligibility.detailLines[0] ?? '',
    /바로 다음 최신 운영 월 2026-04에 차기 이월과 오프닝 스냅샷이 없어/
  );
});

test('reopen eligibility allows the latest locked month when no dependent outputs exist', () => {
  const latestLockedPeriod = createPeriod('period-2026-04', 2026, 4, 'LOCKED');
  const olderLockedPeriod = createPeriod('period-2026-03', 2026, 3, 'LOCKED');

  const eligibility = buildAccountingPeriodReopenEligibility({
    period: latestLockedPeriod,
    periods: [latestLockedPeriod, olderLockedPeriod],
    carryForwardView: null,
    carryForwardError: null,
    carryForwardPending: false
  });

  assert.equal(eligibility.canReopen, true);
  assert.equal(eligibility.statusLabel, '재오픈 가능');
});

function createPeriod(
  id: string,
  year: number,
  month: number,
  status: AccountingPeriodItem['status']
): AccountingPeriodItem {
  const monthLabel = `${year}-${String(month).padStart(2, '0')}`;

  return {
    id,
    year,
    month,
    monthLabel,
    startDate: `${monthLabel}-01T00:00:00.000Z`,
    endDate: `${readNextMonthLabel(year, month)}-01T00:00:00.000Z`,
    status,
    openedAt: `${monthLabel}-01T00:00:00.000Z`,
    lockedAt: status === 'LOCKED' ? `${monthLabel}-28T00:00:00.000Z` : null,
    hasOpeningBalanceSnapshot: false,
    openingBalanceSourceKind: null,
    statusHistory: []
  };
}

function readNextMonthLabel(year: number, month: number) {
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
}
