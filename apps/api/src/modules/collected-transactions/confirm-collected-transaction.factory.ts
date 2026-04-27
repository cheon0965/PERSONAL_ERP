import { BadRequestException } from '@nestjs/common';
import { addMoneyWon } from '@personal-erp/money';
import {
  assertConfirmJournalAccountSubjectIdsResolved,
  assertConfirmJournalLinesSupported,
  buildConfirmCollectedTransactionEntryNumber,
  type ConfirmJournalLineDraft,
  resolveConfirmJournalAccountSubjectIds,
  resolveConfirmCollectedTransactionJournalLines
} from './confirm-collected-transaction.policy';
import type { ConfirmationCollectedTransaction } from './application/ports/confirm-collected-transaction-store.port';

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
  // 부채 상환은 단순 비용 전표가 아니다. 원금은 부채 감소로, 이자/수수료는 비용으로
  // 나누어야 하므로 일반 posting policy보다 먼저 전용 라인을 만든다.
  if (input.collectedTransaction.matchedLiabilityRepaymentSchedule) {
    return buildLiabilityRepaymentJournalLines(input);
  }

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
  sequence: number;
}) {
  return buildConfirmCollectedTransactionEntryNumber(
    input.year,
    input.month,
    input.sequence
  );
}

function buildLiabilityRepaymentJournalLines(input: {
  collectedTransaction: ConfirmationCollectedTransaction;
  accountSubjectIds: ReturnType<typeof resolveConfirmationAccountSubjectIds>;
}): ConfirmJournalLineDraft[] {
  const repayment =
    input.collectedTransaction.matchedLiabilityRepaymentSchedule;

  if (!repayment) {
    return [];
  }

  if (repayment.postedJournalEntryId) {
    throw new BadRequestException('이미 전표 확정된 부채 상환 예정입니다.');
  }

  if (repayment.totalAmount !== input.collectedTransaction.amount) {
    throw new BadRequestException(
      '수집 거래 금액과 부채 상환 예정 총액이 일치하지 않습니다.'
    );
  }

  const expenseAmount = addMoneyWon(
    repayment.interestAmount,
    repayment.feeAmount
  );
  const lines: ConfirmJournalLineDraft[] = [];

  // 원금, 이자/수수료, 출금 자금수단을 각각 별도 라인으로 쌓는다.
  // 금액이 0인 구성요소는 라인을 만들지 않아 전표를 불필요하게 복잡하게 하지 않는다.
  if (repayment.principalAmount > 0) {
    lines.push({
      lineNumber: lines.length + 1,
      accountSubjectId:
        repayment.liabilityAccountSubjectId ??
        input.accountSubjectIds.liabilitySubjectId,
      debitAmount: repayment.principalAmount,
      creditAmount: 0,
      description: `${input.collectedTransaction.title} 원금 상환`
    });
  }

  if (expenseAmount > 0) {
    lines.push({
      lineNumber: lines.length + 1,
      accountSubjectId: input.accountSubjectIds.expenseSubjectId,
      debitAmount: expenseAmount,
      creditAmount: 0,
      description: `${input.collectedTransaction.title} 이자/수수료`
    });
  }

  lines.push({
    lineNumber: lines.length + 1,
    accountSubjectId: input.accountSubjectIds.assetSubjectId,
    fundingAccountId: input.collectedTransaction.fundingAccount.id,
    debitAmount: 0,
    creditAmount: input.collectedTransaction.amount,
    description: input.collectedTransaction.title
  });

  return lines;
}
