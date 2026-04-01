export type JournalAdjustmentLineInput = {
  accountSubjectId: string;
  fundingAccountId?: string | null;
  debitAmount: number;
  creditAmount: number;
  description?: string | null;
};

export type JournalAdjustmentLineDraft = {
  lineNumber: number;
  accountSubjectId: string;
  fundingAccountId?: string;
  debitAmount: number;
  creditAmount: number;
  description?: string;
};

export type JournalEntrySourceLine = {
  accountSubjectId: string;
  fundingAccountId: string | null;
  debitAmount: number;
  creditAmount: number;
  description: string | null;
};

export function buildJournalEntryEntryNumber(
  year: number,
  month: number,
  sequence: number
): string {
  return `${year}${String(month).padStart(2, '0')}-${String(sequence).padStart(
    4,
    '0'
  )}`;
}

export function buildJournalEntryDate(entryDate: string): Date {
  return new Date(`${entryDate}T00:00:00.000Z`);
}

export function normalizeOptionalText(
  value: string | null | undefined
): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function buildReversalJournalLines(
  lines: JournalEntrySourceLine[]
): JournalAdjustmentLineDraft[] {
  return lines.map((line, index) => ({
    lineNumber: index + 1,
    accountSubjectId: line.accountSubjectId,
    ...(line.fundingAccountId
      ? { fundingAccountId: line.fundingAccountId }
      : {}),
    debitAmount: line.creditAmount,
    creditAmount: line.debitAmount,
    ...(line.description ? { description: line.description } : {})
  }));
}

export function normalizeJournalAdjustmentLines(
  lines: JournalAdjustmentLineInput[]
): JournalAdjustmentLineDraft[] {
  return lines.map((line, index) => {
    const description = normalizeOptionalText(line.description);

    return {
      lineNumber: index + 1,
      accountSubjectId: line.accountSubjectId,
      ...(line.fundingAccountId
        ? { fundingAccountId: line.fundingAccountId }
        : {}),
      debitAmount: line.debitAmount,
      creditAmount: line.creditAmount,
      ...(description ? { description } : {})
    };
  });
}

export function assertBalancedJournalAdjustmentLines(
  lines: JournalAdjustmentLineDraft[]
): void {
  if (lines.length < 2) {
    throw new Error('A manual journal entry requires at least two lines.');
  }

  let totalDebit = 0;
  let totalCredit = 0;

  for (const line of lines) {
    if (
      !Number.isInteger(line.debitAmount) ||
      !Number.isInteger(line.creditAmount)
    ) {
      throw new Error('Journal line amounts must be integers.');
    }

    if (line.debitAmount < 0 || line.creditAmount < 0) {
      throw new Error('Journal line amounts cannot be negative.');
    }

    const hasDebit = line.debitAmount > 0;
    const hasCredit = line.creditAmount > 0;

    if (hasDebit === hasCredit) {
      throw new Error(
        'Each journal line must carry either a debit or a credit amount.'
      );
    }

    totalDebit += line.debitAmount;
    totalCredit += line.creditAmount;
  }

  if (totalDebit <= 0 || totalCredit <= 0) {
    throw new Error('Journal entry amount must be greater than zero.');
  }

  if (totalDebit !== totalCredit) {
    throw new Error('Journal entry debit and credit totals must match.');
  }
}
