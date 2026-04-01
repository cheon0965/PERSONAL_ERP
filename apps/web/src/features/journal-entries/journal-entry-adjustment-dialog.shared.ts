import type { QueryClient } from '@tanstack/react-query';
import type {
  AccountingPeriodItem,
  AccountSubjectItem,
  FundingAccountItem,
  JournalEntryItem
} from '@personal-erp/contracts';
import type { FieldErrors } from 'react-hook-form';
import { currentAccountingPeriodQueryKey } from '@/features/accounting-periods/accounting-periods.api';
import { collectedTransactionsQueryKey } from '@/features/transactions/transactions.api';
import { getTodayDateInputValue } from '@/shared/lib/date-input';
import { journalEntriesQueryKey } from './journal-entries.api';
import type {
  CorrectJournalEntryFormInput,
  CorrectionLineInput,
  ReverseJournalEntryFormInput
} from './journal-entry-adjustment-dialog.types';

export async function invalidateAdjustmentQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: journalEntriesQueryKey }),
    queryClient.invalidateQueries({ queryKey: collectedTransactionsQueryKey }),
    queryClient.invalidateQueries({
      queryKey: currentAccountingPeriodQueryKey
    }),
    queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
    queryClient.invalidateQueries({ queryKey: ['forecast'] })
  ]);
}

export function buildReverseDefaultValues(
  currentPeriod: AccountingPeriodItem | null
): ReverseJournalEntryFormInput {
  return {
    entryDate: resolveAdjustmentEntryDate(currentPeriod),
    reason: ''
  };
}

export function buildCorrectionDefaultValues(
  entry: JournalEntryItem,
  currentPeriod: AccountingPeriodItem | null,
  accountSubjects: AccountSubjectItem[],
  fundingAccounts: FundingAccountItem[]
): CorrectJournalEntryFormInput {
  return {
    entryDate: resolveAdjustmentEntryDate(currentPeriod),
    reason: '',
    lines:
      entry.lines.length > 0
        ? entry.lines.map((line) => {
            const accountSubject =
              accountSubjects.find(
                (candidate) => candidate.code === line.accountSubjectCode
              ) ?? null;
            const fundingAccount =
              line.fundingAccountName == null
                ? null
                : (fundingAccounts.find(
                    (candidate) => candidate.name === line.fundingAccountName
                  ) ?? null);

            return {
              accountSubjectId: accountSubject?.id ?? '',
              fundingAccountId: fundingAccount?.id ?? '',
              debitAmount: line.debitAmount,
              creditAmount: line.creditAmount,
              description: line.description ?? ''
            };
          })
        : [createEmptyCorrectionLine(), createEmptyCorrectionLine()]
  };
}

export function resolveAdjustmentEntryDate(
  currentPeriod: AccountingPeriodItem | null
): string {
  const today = getTodayDateInputValue();

  if (!currentPeriod) {
    return today;
  }

  if (isWithinPeriod(today, currentPeriod)) {
    return today;
  }

  return currentPeriod.startDate.slice(0, 10);
}

export function isWithinPeriod(
  entryDate: string,
  currentPeriod: AccountingPeriodItem | null
): boolean {
  if (!currentPeriod) {
    return false;
  }

  const targetTime = Date.parse(`${entryDate}T00:00:00.000Z`);
  const startTime = Date.parse(currentPeriod.startDate);
  const endTime = Date.parse(currentPeriod.endDate);

  return targetTime >= startTime && targetTime < endTime;
}

export function createEmptyCorrectionLine(): CorrectionLineInput {
  return {
    accountSubjectId: '',
    fundingAccountId: '',
    debitAmount: 0,
    creditAmount: 0,
    description: ''
  };
}

export function trimOptionalText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function readLinesErrorMessage(
  linesError: FieldErrors<CorrectJournalEntryFormInput>['lines']
) {
  if (!linesError) {
    return null;
  }

  return 'message' in linesError && typeof linesError.message === 'string'
    ? linesError.message
    : null;
}
