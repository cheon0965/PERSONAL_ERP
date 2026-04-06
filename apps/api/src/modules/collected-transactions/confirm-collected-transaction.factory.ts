import {
  assertConfirmJournalAccountSubjectIdsResolved,
  assertConfirmJournalLinesSupported,
  buildConfirmCollectedTransactionEntryNumber,
  resolveConfirmJournalAccountSubjectIds,
  resolveConfirmCollectedTransactionJournalLines
} from './confirm-collected-transaction.policy';
import type { ConfirmationCollectedTransaction } from './confirm-collected-transaction.reader';

export function resolveConfirmationAccountSubjectIds(
  accountSubjects: Array<{ id: string; code: string }>
) {
  return assertConfirmJournalAccountSubjectIdsResolved(
    resolveConfirmJournalAccountSubjectIds(accountSubjects)
  );
}

export function buildConfirmationJournalLines(input: {
  collectedTransaction: ConfirmationCollectedTransaction;
  accountSubjectIds: ReturnType<typeof resolveConfirmationAccountSubjectIds>;
}) {
  return assertConfirmJournalLinesSupported(
    resolveConfirmCollectedTransactionJournalLines({
      postingPolicyKey:
        input.collectedTransaction.ledgerTransactionType.postingPolicyKey,
      amount: input.collectedTransaction.amount,
      title: input.collectedTransaction.title,
      fundingAccountId: input.collectedTransaction.fundingAccount.id,
      accountSubjectIds: input.accountSubjectIds
    })
  );
}

export function buildConfirmationEntryNumber(input: {
  year: number;
  month: number;
  existingCount: number;
}) {
  return buildConfirmCollectedTransactionEntryNumber(
    input.year,
    input.month,
    input.existingCount + 1
  );
}
