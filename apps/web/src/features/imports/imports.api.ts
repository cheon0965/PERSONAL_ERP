'use client';

import type {
  CollectImportedRowRequest,
  CollectedTransactionItem,
  CreateImportBatchRequest,
  ImportBatchItem,
  ImportSourceKind
} from '@personal-erp/contracts';
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

export function collectImportedRow(
  importBatchId: string,
  importedRowId: string,
  input: CollectImportedRowRequest,
  fallback: CollectedTransactionItem
) {
  return postJson<CollectedTransactionItem, CollectImportedRowRequest>(
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

export function buildImportedCollectedFallbackItem(input: {
  request: CollectImportedRowRequest;
  row: ImportBatchItem['rows'][number];
  fundingAccountName: string;
  categoryName?: string;
}): CollectedTransactionItem {
  const parsed = readParsedRow(input.row);

  return {
    id: `txn-demo-import-${Date.now()}`,
    businessDate: parsed?.occurredOn ?? new Date().toISOString().slice(0, 10),
    title: parsed?.title ?? `업로드 행 ${input.row.rowNumber}`,
    type: input.request.type,
    amountWon: parsed?.amount ?? 0,
    fundingAccountName: input.fundingAccountName,
    categoryName: input.categoryName ?? '-',
    sourceKind: 'IMPORT',
    postingStatus: 'PENDING',
    postedJournalEntryId: null,
    postedJournalEntryNumber: null
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
        parseError: isParsed ? null : '파서가 행을 읽지 못했습니다.',
        sourceFingerprint: isParsed
          ? `sf:v1:fallback-${candidate.rowNumber}`
          : null,
        createdCollectedTransactionId: null,
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

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}
