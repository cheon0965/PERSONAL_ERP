import type {
  CollectImportedRowResponse,
  ImportBatchParseStatus,
  ImportBatchItem,
  ImportSourceKind,
  ImportedRowParseStatus
} from '@personal-erp/contracts';
import { resolveStatusLabel } from '@/shared/ui/status-chip';

export const sourceKindOptions: Array<{
  value: ImportSourceKind;
  label: string;
}> = [
  { value: 'MANUAL_UPLOAD', label: '직접 붙여넣기' },
  { value: 'BANK_CSV', label: '계좌 CSV' },
  { value: 'CARD_EXCEL', label: '카드 엑셀' },
  { value: 'IM_BANK_PDF', label: 'IM뱅크 PDF' }
];

export type FeedbackState = {
  severity: 'success' | 'error';
  message: string;
} | null;

export type ImportedRowTableItem = ImportBatchItem['rows'][number] & {
  occurredOn: string;
  title: string;
  amount: number | null;
  direction: 'WITHDRAWAL' | 'DEPOSIT' | 'REVERSAL' | null;
  collectTypeHint: 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'REVERSAL' | null;
  balanceAfter: number | null;
};

export function buildCollectSuccessMessage(
  result: CollectImportedRowResponse
): string {
  const summary = result.preview.autoPreparation;
  const leadingReason = summary.decisionReasons[0];
  const trailingReason =
    summary.decisionReasons[summary.decisionReasons.length - 1];

  return `${result.collectedTransaction.title} 행을 수집 거래로 올렸습니다. ${resolveStatusLabel(result.collectedTransaction.postingStatus)} 상태이며, ${leadingReason} ${trailingReason}`;
}

export function readParsedRowPreview(row: ImportBatchItem['rows'][number]): {
  occurredOn: string;
  title: string;
  amount: number;
  direction: 'WITHDRAWAL' | 'DEPOSIT' | 'REVERSAL' | null;
  collectTypeHint: 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'REVERSAL' | null;
  balanceAfter: number | null;
} | null {
  const parsed =
    isObjectRecord(row.rawPayload) && isObjectRecord(row.rawPayload.parsed)
      ? row.rawPayload.parsed
      : null;

  if (
    !parsed ||
    typeof parsed.occurredOn !== 'string' ||
    typeof parsed.title !== 'string' ||
    typeof parsed.amount !== 'number'
  ) {
    return null;
  }

  return {
    occurredOn: parsed.occurredOn,
    title: parsed.title,
    amount: parsed.amount,
    direction: readParsedDirection(parsed.direction),
    collectTypeHint: readParsedCollectTypeHint(parsed.collectTypeHint),
    balanceAfter:
      typeof parsed.balanceAfter === 'number' ? parsed.balanceAfter : null
  };
}

export function normalizeOptionalValue(
  value: string | undefined
): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function readImportBatchParseStatusLabel(
  status: ImportBatchParseStatus | string
) {
  switch (status) {
    case 'COMPLETED':
      return '완료';
    case 'PARTIAL':
      return '부분 성공';
    case 'FAILED':
      return '실패';
    case 'PENDING':
      return '대기';
    default:
      return status;
  }
}

export function readImportedRowParseStatusLabel(
  status: ImportedRowParseStatus | string
) {
  switch (status) {
    case 'PARSED':
      return '읽기 완료';
    case 'FAILED':
      return '실패';
    case 'SKIPPED':
      return '건너뜀';
    case 'PENDING':
      return '대기';
    default:
      return status;
  }
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function readParsedDirection(
  value: unknown
): 'WITHDRAWAL' | 'DEPOSIT' | 'REVERSAL' | null {
  return value === 'WITHDRAWAL' ||
    value === 'DEPOSIT' ||
    value === 'REVERSAL'
    ? value
    : null;
}

function readParsedCollectTypeHint(
  value: unknown
): 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'REVERSAL' | null {
  return value === 'INCOME' ||
    value === 'EXPENSE' ||
    value === 'TRANSFER' ||
    value === 'REVERSAL'
    ? value
    : null;
}
