import type {
  OperationsExportScope,
  OperationsNoteItem
} from '@personal-erp/contracts';
import type { OperationalNoteKind } from '@prisma/client';

export const exportScopes: readonly OperationsExportScope[] = [
  'REFERENCE_DATA',
  'COLLECTED_TRANSACTIONS',
  'JOURNAL_ENTRIES',
  'FINANCIAL_STATEMENTS'
] as const;

export type ExportPeriodRecord = {
  id: string;
  year: number;
  month: number;
};

export type BuildExportPayloadInput = {
  scope: OperationsExportScope;
  tenantId: string;
  ledgerId: string;
  periodId: string | null;
  rangeLabel: string;
};

export type BuildExportPayloadResult = {
  rowCount: number;
  rangeLabel: string;
  payload: string;
};

export type CsvCell = string | number | boolean | Date | null | undefined;
export type CsvRow = CsvCell[];

export type OperationalNoteRecord = {
  id: string;
  kind: OperationalNoteKind;
  title: string;
  body: string;
  relatedHref: string | null;
  periodId: string | null;
  authorMembershipId: string;
  createdAt: Date;
  updatedAt: Date;
  period?: {
    year: number;
    month: number;
  } | null;
};

export type ExportSourceCollections = {
  accounts: Array<{ updatedAt?: Date }>;
  categories: Array<{ updatedAt?: Date }>;
  accountSubjects: Array<{ updatedAt?: Date }>;
  ledgerTransactionTypes: Array<{ updatedAt?: Date }>;
  collectedTransactions: Array<{ occurredOn?: Date; updatedAt?: Date }>;
  journalEntries: Array<{
    entryDate?: Date;
    createdAt?: Date;
    updatedAt?: Date;
  }>;
  financialStatementSnapshots: Array<{ createdAt?: Date; updatedAt?: Date }>;
};

export function readExportRowCount(
  scope: OperationsExportScope,
  sources: ExportSourceCollections
): number {
  switch (scope) {
    case 'REFERENCE_DATA':
      return (
        sources.accounts.length +
        sources.categories.length +
        sources.accountSubjects.length +
        sources.ledgerTransactionTypes.length
      );
    case 'COLLECTED_TRANSACTIONS':
      return sources.collectedTransactions.length;
    case 'JOURNAL_ENTRIES':
      return sources.journalEntries.length;
    case 'FINANCIAL_STATEMENTS':
      return sources.financialStatementSnapshots.length;
    default:
      return 0;
  }
}

export function readExportSourceDates(
  scope: OperationsExportScope,
  sources: ExportSourceCollections
): Array<Date | undefined> {
  switch (scope) {
    case 'REFERENCE_DATA':
      return [
        ...sources.accounts.map((item) => item.updatedAt),
        ...sources.categories.map((item) => item.updatedAt),
        ...sources.accountSubjects.map((item) => item.updatedAt),
        ...sources.ledgerTransactionTypes.map((item) => item.updatedAt)
      ];
    case 'COLLECTED_TRANSACTIONS':
      return sources.collectedTransactions.flatMap((item) => [
        item.occurredOn,
        item.updatedAt
      ]);
    case 'JOURNAL_ENTRIES':
      return sources.journalEntries.flatMap((item) => [
        item.entryDate,
        item.createdAt,
        item.updatedAt
      ]);
    case 'FINANCIAL_STATEMENTS':
      return sources.financialStatementSnapshots.flatMap((item) => [
        item.createdAt,
        item.updatedAt
      ]);
    default:
      return [];
  }
}

export function readExportScopeLabel(scope: OperationsExportScope): string {
  switch (scope) {
    case 'REFERENCE_DATA':
      return '기준 데이터';
    case 'COLLECTED_TRANSACTIONS':
      return '수집 거래';
    case 'JOURNAL_ENTRIES':
      return '전표';
    case 'FINANCIAL_STATEMENTS':
      return '재무제표 스냅샷';
    default:
      return scope;
  }
}

export function readExportScopeDescription(
  scope: OperationsExportScope
): string {
  switch (scope) {
    case 'REFERENCE_DATA':
      return '자금수단, 카테고리, 계정과목, 거래유형을 한 번에 CSV로 반출합니다.';
    case 'COLLECTED_TRANSACTIONS':
      return '수집 거래의 상태, 금액, 업로드 연결 정보를 CSV로 반출합니다.';
    case 'JOURNAL_ENTRIES':
      return '전표 헤더와 라인을 한 행 단위 CSV로 반출합니다.';
    case 'FINANCIAL_STATEMENTS':
      return '생성된 재무제표 스냅샷 payload를 감사용 CSV로 반출합니다.';
    default:
      return '운영 데이터를 CSV로 반출합니다.';
  }
}

export function readExportScopeCadence(scope: OperationsExportScope): string {
  switch (scope) {
    case 'REFERENCE_DATA':
      return '기준 데이터 변경 후';
    case 'COLLECTED_TRANSACTIONS':
    case 'JOURNAL_ENTRIES':
      return '월 마감 전/후';
    case 'FINANCIAL_STATEMENTS':
      return '재무제표 생성 직후';
    default:
      return '필요 시';
  }
}

export function readScopeRangeLabel(scope: OperationsExportScope): string {
  switch (scope) {
    case 'REFERENCE_DATA':
      return '기준 데이터 전체';
    default:
      return '전체 기간';
  }
}

export function isExportScope(
  value: string | null
): value is OperationsExportScope {
  return exportScopes.includes(value as OperationsExportScope);
}

export function readPeriodRecordLabel(period: ExportPeriodRecord): string {
  return readPeriodLabel(period.year, period.month);
}

export function readPeriodLabel(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function normalizeOptionalText(
  value: string | null | undefined
): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function mapOperationalNote(
  note: OperationalNoteRecord
): OperationsNoteItem {
  return {
    id: note.id,
    kind: note.kind,
    title: note.title,
    body: note.body,
    relatedHref: note.relatedHref,
    periodId: note.periodId,
    periodLabel: note.period
      ? readPeriodLabel(note.period.year, note.period.month)
      : null,
    authorMembershipId: note.authorMembershipId,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString()
  };
}

export function readLatestIso(values: Array<string | null>): string | null {
  return (
    values
      .flatMap((value) => (value ? [value] : []))
      .sort((left, right) => right.localeCompare(left))[0] ?? null
  );
}

export function readLatestDateValue(
  values: Array<Date | string | null | undefined>
): string | null {
  const latest = values
    .map((value) => readDateObject(value))
    .filter((value): value is Date => Boolean(value))
    .sort((left, right) => right.getTime() - left.getTime())[0];

  return latest?.toISOString() ?? null;
}

export function readDateValue(value: Date | string | null | undefined): string {
  return readDateObject(value)?.toISOString() ?? '';
}

export function toCsv(rows: CsvRow[]): string {
  return `\ufeff${rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')}\r\n`;
}

function readDateObject(value: Date | string | null | undefined): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string' && value.trim()) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function escapeCsvCell(cell: CsvCell): string {
  const value = cell instanceof Date ? cell.toISOString() : String(cell ?? '');
  const escaped = value.replaceAll('"', '""');
  return /[",\r\n]/.test(escaped) ? `"${escaped}"` : escaped;
}
