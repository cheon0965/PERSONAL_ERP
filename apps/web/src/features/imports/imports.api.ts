'use client';

import type {
  CollectImportedRowPreview,
  CollectImportedRowRequest,
  CollectImportedRowResponse,
  CreateImportBatchRequest,
  ImportBatchItem,
  ImportSourceKind,
  ImportedRowAutoPreparationSummary
} from '@personal-erp/contracts';
import { resolveImportedCollectedTransactionPostingStatus } from '@/features/transactions/transaction-workflow';
import { fetchJson, postJson } from '@/shared/api/fetch-json';

export const importBatchesQueryKey = ['import-batches'] as const;

export const mockImportBatches: ImportBatchItem[] = [
  {
    id: 'import-batch-demo-1',
    sourceKind: 'MANUAL_UPLOAD',
    fileName: 'march-manual.csv',
    fileHash: 'hash-demo-1',
    rowCount: 3,
    parseStatus: 'PARTIAL',
    uploadedAt: '2026-03-12T09:00:00.000Z',
    parsedRowCount: 2,
    failedRowCount: 1,
    rows: [
      {
        id: 'imported-row-demo-1',
        rowNumber: 2,
        parseStatus: 'PARSED',
        parseError: null,
        sourceFingerprint: 'sf:v1:demo-row-1',
        createdCollectedTransactionId: null,
        collectionSummary: null,
        rawPayload: {
          original: {
            date: '2026-03-12',
            title: 'Coffee beans',
            amount: '19800'
          },
          parsed: {
            occurredOn: '2026-03-12',
            title: 'Coffee beans',
            amount: 19800
          }
        }
      },
      {
        id: 'imported-row-demo-2',
        rowNumber: 3,
        parseStatus: 'PARSED',
        parseError: null,
        sourceFingerprint: 'sf:v1:demo-row-2',
        createdCollectedTransactionId: 'txn-demo-imported-1',
        collectionSummary: {
          createdCollectedTransactionId: 'txn-demo-imported-1',
          createdCollectedTransactionTitle: 'Lunch',
          createdCollectedTransactionStatus: 'READY_TO_POST',
          autoPreparation: buildFallbackAutoPreparationSummary({
            type: 'EXPENSE',
            requestedCategoryId: null,
            matchedPlanItemId: 'plan-item-demo-lunch',
            matchedPlanItemTitle: '점심 예산',
            effectiveCategoryId: 'cat-demo-meal',
            effectiveCategoryName: '식비',
            hasDuplicateSourceFingerprint: false
          })
        },
        rawPayload: {
          original: {
            date: '2026-03-14',
            title: 'Lunch',
            amount: '12000'
          },
          parsed: {
            occurredOn: '2026-03-14',
            title: 'Lunch',
            amount: 12000
          }
        }
      },
      {
        id: 'imported-row-demo-3',
        rowNumber: 4,
        parseStatus: 'FAILED',
        parseError: 'date 값이 올바르지 않습니다.',
        sourceFingerprint: null,
        createdCollectedTransactionId: null,
        collectionSummary: null,
        rawPayload: {
          original: {
            date: 'not-a-date',
            title: 'Broken row',
            amount: '9000'
          },
          parsed: {
            occurredOn: null,
            title: 'Broken row',
            amount: 9000
          }
        }
      }
    ]
  },
  {
    id: 'import-batch-demo-2',
    sourceKind: 'BANK_CSV',
    fileName: 'bank-export.csv',
    fileHash: 'hash-demo-2',
    rowCount: 2,
    parseStatus: 'COMPLETED',
    uploadedAt: '2026-03-18T09:00:00.000Z',
    parsedRowCount: 2,
    failedRowCount: 0,
    rows: [
      {
        id: 'imported-row-demo-4',
        rowNumber: 2,
        parseStatus: 'PARSED',
        parseError: null,
        sourceFingerprint: 'sf:v1:demo-row-4',
        createdCollectedTransactionId: null,
        collectionSummary: null,
        rawPayload: {
          original: {
            date: '2026-03-18',
            title: 'Fuel',
            amount: '84000'
          },
          parsed: {
            occurredOn: '2026-03-18',
            title: 'Fuel',
            amount: 84000
          }
        }
      },
      {
        id: 'imported-row-demo-5',
        rowNumber: 3,
        parseStatus: 'PARSED',
        parseError: null,
        sourceFingerprint: 'sf:v1:demo-row-5',
        createdCollectedTransactionId: null,
        collectionSummary: null,
        rawPayload: {
          original: {
            date: '2026-03-19',
            title: 'Office supplies',
            amount: '31500'
          },
          parsed: {
            occurredOn: '2026-03-19',
            title: 'Office supplies',
            amount: 31500
          }
        }
      }
    ]
  }
];

export function getImportBatches() {
  return fetchJson<ImportBatchItem[]>('/import-batches', mockImportBatches);
}

export function createImportBatch(
  input: CreateImportBatchRequest,
  fallback: ImportBatchItem
) {
  return postJson<ImportBatchItem, CreateImportBatchRequest>(
    '/import-batches',
    input,
    fallback
  );
}

export function previewImportedRowCollection(
  importBatchId: string,
  importedRowId: string,
  input: CollectImportedRowRequest,
  fallback: CollectImportedRowPreview
) {
  return postJson<CollectImportedRowPreview, CollectImportedRowRequest>(
    `/import-batches/${importBatchId}/rows/${importedRowId}/collect-preview`,
    input,
    fallback
  );
}

export function collectImportedRow(
  importBatchId: string,
  importedRowId: string,
  input: CollectImportedRowRequest,
  fallback: CollectImportedRowResponse
) {
  return postJson<CollectImportedRowResponse, CollectImportedRowRequest>(
    `/import-batches/${importBatchId}/rows/${importedRowId}/collect`,
    input,
    fallback
  );
}

export function buildImportBatchFallbackItem(
  input: CreateImportBatchRequest
): ImportBatchItem {
  const rows = parseFallbackRows(input.sourceKind, input.content);
  const parsedRowCount = rows.filter(
    (row) => row.parseStatus === 'PARSED'
  ).length;

  return {
    id: `import-batch-demo-${Date.now()}`,
    sourceKind: input.sourceKind,
    fileName: input.fileName,
    fileHash: `hash-${Date.now()}`,
    rowCount: rows.length,
    parseStatus:
      parsedRowCount === rows.length
        ? 'COMPLETED'
        : parsedRowCount === 0
          ? 'FAILED'
          : 'PARTIAL',
    uploadedAt: new Date().toISOString(),
    parsedRowCount,
    failedRowCount: rows.length - parsedRowCount,
    rows
  };
}

export function buildImportedCollectedFallbackPreview(input: {
  request: CollectImportedRowRequest;
  row: ImportBatchItem['rows'][number];
  fundingAccountId: string;
  fundingAccountName: string;
  requestedCategoryId?: string;
  requestedCategoryName?: string;
}): CollectImportedRowPreview {
  const parsed = readParsedRow(input.row);
  const effectiveCategoryName = normalizeOptionalText(
    input.requestedCategoryName
  );
  const effectiveCategoryId = normalizeOptionalText(input.requestedCategoryId);

  return {
    importedRowId: input.row.id,
    occurredOn: parsed?.occurredOn ?? new Date().toISOString().slice(0, 10),
    title: parsed?.title ?? `업로드 행 ${input.row.rowNumber}`,
    amountWon: parsed?.amount ?? 0,
    fundingAccountId: input.fundingAccountId,
    fundingAccountName: input.fundingAccountName,
    type: input.request.type,
    requestedCategoryId: effectiveCategoryId,
    requestedCategoryName: effectiveCategoryName,
    autoPreparation: buildFallbackAutoPreparationSummary({
      type: input.request.type,
      requestedCategoryId: effectiveCategoryId,
      matchedPlanItemId: null,
      matchedPlanItemTitle: null,
      effectiveCategoryId,
      effectiveCategoryName,
      hasDuplicateSourceFingerprint: false
    })
  };
}

export function buildImportedCollectedFallbackResponse(input: {
  request: CollectImportedRowRequest;
  row: ImportBatchItem['rows'][number];
  fundingAccountId: string;
  fundingAccountName: string;
  requestedCategoryId?: string;
  requestedCategoryName?: string;
}): CollectImportedRowResponse {
  const preview = buildImportedCollectedFallbackPreview(input);

  return {
    collectedTransaction: {
      id: `txn-demo-import-${Date.now()}`,
      businessDate: preview.occurredOn,
      title: preview.title,
      type: preview.type,
      amountWon: preview.amountWon,
      fundingAccountName: preview.fundingAccountName,
      categoryName: preview.autoPreparation.effectiveCategoryName ?? '-',
      sourceKind: 'IMPORT',
      postingStatus: preview.autoPreparation.nextWorkflowStatus,
      postedJournalEntryId: null,
      postedJournalEntryNumber: null,
      matchedPlanItemId: preview.autoPreparation.matchedPlanItemId,
      matchedPlanItemTitle: preview.autoPreparation.matchedPlanItemTitle
    },
    preview
  };
}

function buildFallbackAutoPreparationSummary(input: {
  type: CollectImportedRowRequest['type'];
  requestedCategoryId: string | null;
  matchedPlanItemId: string | null;
  matchedPlanItemTitle: string | null;
  effectiveCategoryId: string | null;
  effectiveCategoryName: string | null;
  hasDuplicateSourceFingerprint: boolean;
}): ImportedRowAutoPreparationSummary {
  const nextWorkflowStatus = resolveImportedCollectedTransactionPostingStatus({
    type: input.type,
    categoryName: input.effectiveCategoryName
  });
  const decisionReasons: string[] = [];

  if (input.hasDuplicateSourceFingerprint) {
    decisionReasons.push(
      '같은 원본 식별값이 이미 있어 중복 후보로 보류합니다.'
    );
  }

  if (input.matchedPlanItemTitle) {
    decisionReasons.push(
      `계획 항목 "${input.matchedPlanItemTitle}"과 연결합니다.`
    );
  } else {
    decisionReasons.push('자동으로 연결할 단일 계획 항목을 찾지 못했습니다.');
  }

  if (input.requestedCategoryId && input.effectiveCategoryName) {
    decisionReasons.push(
      `선택한 카테고리 "${input.effectiveCategoryName}"를 그대로 적용합니다.`
    );
  } else if (input.effectiveCategoryName) {
    decisionReasons.push(
      `카테고리 "${input.effectiveCategoryName}"를 적용합니다.`
    );
  } else {
    decisionReasons.push('카테고리가 비어 있어 추가 검토가 필요합니다.');
  }

  if (nextWorkflowStatus === 'READY_TO_POST') {
    decisionReasons.push(
      input.type === 'TRANSFER' && !input.effectiveCategoryName
        ? '이체 거래라 카테고리 없이도 전표 준비 상태로 올립니다.'
        : '즉시 전표 준비 상태로 올립니다.'
    );
  } else if (nextWorkflowStatus === 'REVIEWED') {
    decisionReasons.push('카테고리 보완 전까지 검토 상태로 저장합니다.');
  } else {
    decisionReasons.push('중복 후보라 수집 단계로 남깁니다.');
  }

  return {
    matchedPlanItemId: input.matchedPlanItemId,
    matchedPlanItemTitle: input.matchedPlanItemTitle,
    effectiveCategoryId: input.effectiveCategoryId,
    effectiveCategoryName: input.effectiveCategoryName,
    nextWorkflowStatus,
    hasDuplicateSourceFingerprint: input.hasDuplicateSourceFingerprint,
    allowPlanItemMatch: !input.hasDuplicateSourceFingerprint,
    decisionReasons
  };
}

function parseFallbackRows(
  sourceKind: ImportSourceKind,
  content: string
): ImportBatchItem['rows'] {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return [];
  }

  const lines = normalized.split('\n');
  const header = splitLine(lines[0] ?? '');

  return lines
    .slice(1)
    .map((line, index) => ({
      line,
      rowNumber: index + 2
    }))
    .filter((candidate) => candidate.line.trim().length > 0)
    .map((candidate) => {
      const values = splitLine(candidate.line);
      const raw = Object.fromEntries(
        header.map((column, index) => [column, values[index] ?? ''])
      );
      const occurredOn = String(raw.date ?? raw.approved_at ?? '').trim();
      const title = String(
        raw.title ?? raw.description ?? raw.merchant ?? raw.memo ?? ''
      ).trim();
      const amount = Number(
        String(raw.amount ?? raw.approved_amount ?? '').replace(/,/g, '')
      );
      const isParsed =
        /^\d{4}-\d{2}-\d{2}$/.test(occurredOn) &&
        title.length > 0 &&
        Number.isFinite(amount);

      return {
        id: `imported-row-demo-${sourceKind}-${candidate.rowNumber}-${Date.now()}`,
        rowNumber: candidate.rowNumber,
        parseStatus: isParsed ? 'PARSED' : 'FAILED',
        parseError: isParsed ? null : '파서가 행을 읽을 수 없습니다.',
        sourceFingerprint: isParsed
          ? `sf:v1:fallback-${candidate.rowNumber}`
          : null,
        createdCollectedTransactionId: null,
        collectionSummary: null,
        rawPayload: {
          original: raw,
          parsed: {
            occurredOn: isParsed ? occurredOn : null,
            title: title || null,
            amount: Number.isFinite(amount) ? amount : null
          }
        }
      } satisfies ImportBatchItem['rows'][number];
    });
}

function splitLine(line: string): string[] {
  return line.includes('\t') ? line.split('\t') : line.split(',');
}

function readParsedRow(row: ImportBatchItem['rows'][number]): {
  occurredOn: string;
  title: string;
  amount: number;
} | null {
  const parsed =
    isObjectRecord(row.rawPayload) && isObjectRecord(row.rawPayload.parsed)
      ? row.rawPayload.parsed
      : null;

  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  return typeof parsed.occurredOn === 'string' &&
    typeof parsed.title === 'string' &&
    typeof parsed.amount === 'number'
    ? {
        occurredOn: parsed.occurredOn,
        title: parsed.title,
        amount: parsed.amount
      }
    : null;
}

function normalizeOptionalText(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}
