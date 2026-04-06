import {
  AccountingPeriodStatus,
  CollectedTransactionStatus,
  ImportBatchParseStatus,
  ImportedRowParseStatus,
  ImportSourceKind,
  PlanItemStatus
} from '@prisma/client';
import { buildSourceFingerprint } from '../src/modules/import-batches/import-batch.policy';
import type { RequestTestContext } from './request-api.test-support';

type RequestTestState = RequestTestContext['state'];
type AccountingPeriodStateItem = RequestTestState['accountingPeriods'][number];
type ImportBatchStateItem = RequestTestState['importBatches'][number];
type ImportedRowStateItem = RequestTestState['importedRows'][number];
type PlanItemStateItem = RequestTestState['planItems'][number];
type CollectedTransactionStateItem =
  RequestTestState['collectedTransactions'][number];

type PushImportedRowInput = {
  id: string;
  batchId: string;
  rowNumber?: number;
  occurredOn?: string;
  title?: string;
  amount?: number;
  parseStatus?: ImportedRowParseStatus;
  parseError?: string | null;
  sourceFingerprint?: string | null;
  original?: Record<string, unknown>;
  parsed?: Record<string, unknown>;
};

type SeedCollectableImportScenarioInput = {
  periodId?: string;
  batchId?: string;
  rowId?: string;
  planItemId?: string;
  occurredOn?: string;
  title?: string;
  amount?: number;
  sourceKind?: ImportSourceKind;
  fileName?: string;
  fileHash?: string;
  planItemTitle?: string;
  sourceFingerprint?: string | null;
};

export function buildImportRowFingerprint(input: {
  sourceKind?: ImportSourceKind;
  occurredOn: string;
  amount: number;
  title: string;
  sourceOrigin?: string | null;
}) {
  return buildSourceFingerprint({
    sourceKind: input.sourceKind ?? ImportSourceKind.MANUAL_UPLOAD,
    occurredOn: input.occurredOn,
    amount: input.amount,
    description: input.title,
    sourceOrigin: input.sourceOrigin ?? null
  });
}

export function pushOpenCollectingPeriod(
  context: RequestTestContext,
  overrides: Partial<AccountingPeriodStateItem> &
    Pick<AccountingPeriodStateItem, 'id'>
) {
  const { id, ...rest } = overrides;
  const period: AccountingPeriodStateItem = {
    id,
    tenantId: 'tenant-1',
    ledgerId: 'ledger-1',
    year: 2026,
    month: 3,
    startDate: new Date('2026-03-01T00:00:00.000Z'),
    endDate: new Date('2026-04-01T00:00:00.000Z'),
    status: AccountingPeriodStatus.OPEN,
    openedAt: new Date('2026-03-01T00:00:00.000Z'),
    lockedAt: null,
    createdAt: new Date('2026-03-01T00:00:00.000Z'),
    updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    ...rest
  };

  context.state.accountingPeriods.push(period);
  return period;
}

export function pushImportBatch(
  context: RequestTestContext,
  overrides: Partial<ImportBatchStateItem> & Pick<ImportBatchStateItem, 'id'>
) {
  const { id, ...rest } = overrides;
  const batch: ImportBatchStateItem = {
    id,
    tenantId: 'tenant-1',
    ledgerId: 'ledger-1',
    periodId: null,
    sourceKind: ImportSourceKind.MANUAL_UPLOAD,
    fileName: 'collect-me.csv',
    fileHash: 'hash-collect',
    rowCount: 1,
    parseStatus: ImportBatchParseStatus.COMPLETED,
    uploadedByMembershipId: 'membership-1',
    uploadedAt: new Date('2026-03-10T00:00:00.000Z'),
    ...rest
  };

  context.state.importBatches.push(batch);
  return batch;
}

export function pushImportedRow(
  context: RequestTestContext,
  input: PushImportedRowInput
) {
  const occurredOn = input.occurredOn ?? '2026-03-12';
  const title = input.title ?? 'Coffee beans';
  const amount = input.amount ?? 19_800;
  const parseStatus = input.parseStatus ?? ImportedRowParseStatus.PARSED;
  const parseError =
    input.parseError ??
    (parseStatus === ImportedRowParseStatus.FAILED
      ? 'date 값이 올바르지 않습니다.'
      : null);
  const row: ImportedRowStateItem = {
    id: input.id,
    batchId: input.batchId,
    rowNumber: input.rowNumber ?? 2,
    rawPayload: {
      original: input.original ?? {
        date:
          parseStatus === ImportedRowParseStatus.FAILED
            ? 'not-a-date'
            : occurredOn,
        title,
        amount: String(amount)
      },
      parsed: input.parsed ?? {
        occurredOn:
          parseStatus === ImportedRowParseStatus.FAILED ? null : occurredOn,
        title,
        amount
      }
    },
    parseStatus,
    parseError,
    sourceFingerprint: input.sourceFingerprint ?? null
  };

  context.state.importedRows.push(row);
  return row;
}

export function pushDraftPlanItem(
  context: RequestTestContext,
  overrides: Partial<PlanItemStateItem> &
    Pick<PlanItemStateItem, 'id' | 'periodId'>
) {
  const { id, periodId, ...rest } = overrides;
  const planItem: PlanItemStateItem = {
    id,
    tenantId: 'tenant-1',
    ledgerId: 'ledger-1',
    periodId,
    recurringRuleId: null,
    ledgerTransactionTypeId: 'ltt-1-expense',
    fundingAccountId: 'acc-1',
    categoryId: 'cat-1',
    title: 'Coffee beans budget',
    plannedAmount: 19_800,
    plannedDate: new Date('2026-03-11T00:00:00.000Z'),
    status: PlanItemStatus.DRAFT,
    createdAt: new Date('2026-03-01T00:00:00.000Z'),
    updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    ...rest
  };

  context.state.planItems.push(planItem);
  return planItem;
}

export function pushCollectedTransaction(
  context: RequestTestContext,
  overrides: Partial<CollectedTransactionStateItem> &
    Pick<CollectedTransactionStateItem, 'id'>
) {
  const { id, ...rest } = overrides;
  const collectedTransaction: CollectedTransactionStateItem = {
    id,
    tenantId: 'tenant-1',
    ledgerId: 'ledger-1',
    periodId: 'period-open-import-collect',
    ledgerTransactionTypeId: 'ltt-1-expense',
    fundingAccountId: 'acc-1',
    categoryId: 'cat-1',
    matchedPlanItemId: null,
    importBatchId: null,
    importedRowId: null,
    sourceFingerprint: null,
    title: 'Existing transaction',
    occurredOn: new Date('2026-03-12T00:00:00.000Z'),
    amount: 12_000,
    status: CollectedTransactionStatus.READY_TO_POST,
    memo: null,
    createdAt: new Date('2026-03-12T08:00:00.000Z'),
    updatedAt: new Date('2026-03-12T08:00:00.000Z'),
    ...rest
  };

  context.state.collectedTransactions.push(collectedTransaction);
  return collectedTransaction;
}

export function seedCollectableImportScenario(
  context: RequestTestContext,
  input: SeedCollectableImportScenarioInput = {}
) {
  const occurredOn = input.occurredOn ?? '2026-03-12';
  const title = input.title ?? 'Coffee beans';
  const amount = input.amount ?? 19_800;
  const sourceKind = input.sourceKind ?? ImportSourceKind.MANUAL_UPLOAD;
  const fingerprint =
    input.sourceFingerprint ??
    buildImportRowFingerprint({
      sourceKind,
      occurredOn,
      amount,
      title
    });
  const period = pushOpenCollectingPeriod(context, {
    id: input.periodId ?? 'period-open-import-collect'
  });
  const batch = pushImportBatch(context, {
    id: input.batchId ?? 'import-batch-collect',
    sourceKind,
    fileName: input.fileName ?? 'collect-me.csv',
    fileHash: input.fileHash ?? 'hash-collect'
  });
  const planItem = pushDraftPlanItem(context, {
    id: input.planItemId ?? 'plan-item-collect-1',
    periodId: period.id,
    title: input.planItemTitle ?? `${title} budget`,
    plannedAmount: amount
  });
  const row = pushImportedRow(context, {
    id: input.rowId ?? 'imported-row-collect-1',
    batchId: batch.id,
    occurredOn,
    title,
    amount,
    sourceFingerprint: fingerprint
  });

  return {
    period,
    batch,
    row,
    planItem,
    fingerprint
  };
}
