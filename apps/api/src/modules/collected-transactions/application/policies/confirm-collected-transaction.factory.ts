import { validationError } from '../../../../common/application/errors/app-error';
import { addMoneyWon } from '@personal-erp/money';
import {
  assertConfirmJournalAccountSubjectIdsResolved,
  assertConfirmJournalLinesSupported,
  buildConfirmCollectedTransactionEntryNumber,
  type ConfirmJournalLineDraft,
  resolveConfirmJournalAccountSubjectIds,
  resolveConfirmCollectedTransactionJournalLines
} from './confirm-collected-transaction.policy';
import type { ConfirmationCollectedTransaction } from '../ports/confirm-collected-transaction-store.port';
import { assessPostingAccountSelection } from '../../domain/posting-account-selection.policy';

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
  // 부채 상환은 원금/이자/수수료를 분리하는 전용 정책이다.
  if (input.collectedTransaction.matchedLiabilityRepaymentSchedule) {
    return buildLiabilityRepaymentJournalLines(input);
  }

  const selection = assessPostingAccountSelection({
    postingPolicyKey:
      input.collectedTransaction.ledgerTransactionType.postingPolicyKey,
    fundingAccountId: input.collectedTransaction.fundingAccount.id,
    fundingAccountType: input.collectedTransaction.fundingAccount.type,
    counterpartyFundingAccountId:
      input.collectedTransaction.counterpartyFundingAccount?.id ?? null,
    counterpartyFundingAccountType:
      input.collectedTransaction.counterpartyFundingAccount?.type ?? null,
    fundingAccountDirection: input.collectedTransaction.fundingAccountDirection,
    categoryId: input.collectedTransaction.category?.id ?? null
  });

  if (selection.validationError) {
    throw validationError(selection.validationError);
  }
  if (selection.missingRequirements.length > 0) {
    throw validationError(
      `전표 확정에 필요한 정보가 누락되었습니다: ${selection.missingRequirements.join(', ')}`
    );
  }

  const fundingAccountSubjectId = resolveLinkedFundingAccountSubjectId(
    input.collectedTransaction,
    input.collectedTransaction.fundingAccount
  );
  const counterpartyFundingAccountSubjectId = input.collectedTransaction
    .counterpartyFundingAccount
    ? resolveLinkedFundingAccountSubjectId(
        input.collectedTransaction,
        input.collectedTransaction.counterpartyFundingAccount
      )
    : null;
  const categoryAccountSubjectId = resolveCategoryAccountSubjectId(
    input.collectedTransaction
  );

  return assertConfirmJournalLinesSupported(
    resolveConfirmCollectedTransactionJournalLines({
      postingPolicyKey:
        input.collectedTransaction.ledgerTransactionType.postingPolicyKey,
      amount: input.collectedTransaction.amount,
      title: input.collectedTransaction.title,
      fundingAccountId: input.collectedTransaction.fundingAccount.id,
      fundingAccountType: input.collectedTransaction.fundingAccount.type,
      fundingAccountSubjectId,
      counterpartyFundingAccountId:
        input.collectedTransaction.counterpartyFundingAccount?.id ?? null,
      counterpartyFundingAccountType:
        input.collectedTransaction.counterpartyFundingAccount?.type ?? null,
      counterpartyFundingAccountSubjectId,
      fundingAccountDirection:
        input.collectedTransaction.fundingAccountDirection,
      categoryAccountSubjectId,
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
    throw validationError('이미 전표 확정된 부채 상환 예정입니다.');
  }

  if (repayment.totalAmount !== input.collectedTransaction.amount) {
    throw validationError(
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
      accountSubjectId:
        resolveCategoryAccountSubjectId(input.collectedTransaction) ??
        input.accountSubjectIds.expenseSubjectId,
      debitAmount: expenseAmount,
      creditAmount: 0,
      description: `${input.collectedTransaction.title} 이자/수수료`
    });
  }

  lines.push({
    lineNumber: lines.length + 1,
    accountSubjectId:
      resolveLinkedFundingAccountSubjectId(
        input.collectedTransaction,
        input.collectedTransaction.fundingAccount
      ) ?? input.accountSubjectIds.assetSubjectId,
    fundingAccountId: input.collectedTransaction.fundingAccount.id,
    debitAmount: 0,
    creditAmount: input.collectedTransaction.amount,
    description: input.collectedTransaction.title
  });

  return lines;
}

function resolveLinkedFundingAccountSubjectId(
  transaction: ConfirmationCollectedTransaction,
  fundingAccount: ConfirmationCollectedTransaction['fundingAccount']
): string | null {
  const subject = fundingAccount.linkedAccountSubject;
  if (!subject) {
    return null;
  }

  const expectedKind = fundingAccount.type === 'CARD' ? 'LIABILITY' : 'ASSET';
  if (
    !subject.isActive ||
    subject.ledgerId !== transaction.ledgerId ||
    subject.subjectKind !== expectedKind
  ) {
    throw validationError(
      `${fundingAccount.name} 자금수단의 연결 계정과목이 현재 Ledger의 활성 ${expectedKind} 계정이 아닙니다.`
    );
  }

  return subject.id;
}

function resolveCategoryAccountSubjectId(
  transaction: ConfirmationCollectedTransaction
): string | null {
  const category = transaction.category;
  const subject = category?.defaultAccountSubject ?? null;
  if (!subject) {
    return null;
  }

  const postingPolicyKey = transaction.ledgerTransactionType.postingPolicyKey;
  const expectedKind =
    postingPolicyKey === 'INCOME_BASIC'
      ? 'INCOME'
      : postingPolicyKey === 'EXPENSE_BASIC' ||
          postingPolicyKey === 'CARD_SPEND'
        ? 'EXPENSE'
        : null;

  if (
    !expectedKind ||
    !subject.isActive ||
    subject.ledgerId !== transaction.ledgerId ||
    subject.subjectKind !== expectedKind
  ) {
    throw validationError(
      `${category?.kind ?? 'UNKNOWN'} 카테고리의 공식 계정과목 매핑이 거래유형과 일치하지 않습니다.`
    );
  }

  return subject.id;
}
