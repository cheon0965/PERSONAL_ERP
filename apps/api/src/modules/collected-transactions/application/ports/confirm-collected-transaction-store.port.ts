// eslint-disable-next-line no-restricted-imports
import type {
  AccountingPeriodStatus,
  AuditActorType,
  CollectedTransactionStatus,
  JournalEntrySourceKind,
  JournalEntryStatus,
  PostingPolicyKey,
  Prisma
} from '@prisma/client';
import type { JournalEntryRecord } from '../../../journal-entries/public';

/**
 * 수집 거래 확정 유스케이스가 DB 구현 세부사항에 묶이지 않도록 만든 저장소 포트입니다.
 *
 * 확정 흐름은 수집 거래 상태 선점, 전표 번호 할당, 전표 생성, 계획/부채 상태 갱신을
 * 하나의 트랜잭션으로 묶어야 합니다. 이 포트는 그 트랜잭션 안에서 필요한 최소 데이터와
 * 명령만 노출해 유스케이스가 회계 흐름을 읽기 쉽게 유지하도록 돕습니다.
 */
export type ConfirmationWorkspaceScope = {
  tenantId: string;
  ledgerId: string;
};

export type ConfirmationCollectedTransaction = {
  id: string;
  occurredOn: Date;
  title: string;
  memo: string | null;
  amount: number;
  status: CollectedTransactionStatus;
  matchedPlanItemId: string | null;
  matchedLiabilityRepaymentSchedule: {
    id: string;
    principalAmount: number;
    interestAmount: number;
    feeAmount: number;
    totalAmount: number;
    postedJournalEntryId: string | null;
    liabilityAccountSubjectId: string | null;
  } | null;
  period: {
    id: string;
    year: number;
    month: number;
    status: AccountingPeriodStatus;
  } | null;
  fundingAccount: {
    id: string;
    name: string;
  };
  ledgerTransactionType: {
    postingPolicyKey: PostingPolicyKey;
  };
  importedRow: {
    id: string;
    batchId: string;
    rawPayload: Prisma.JsonValue;
  } | null;
  postedJournalEntry: {
    id: string;
  } | null;
};

export type ConfirmationReversalTarget = {
  id: string;
  createdCollectedTransaction: {
    id: string;
    status: CollectedTransactionStatus;
    postedJournalEntry: {
      id: string;
      entryNumber: string;
      status: JournalEntryStatus;
      lines: Array<{
        accountSubjectId: string;
        fundingAccountId: string | null;
        debitAmount: Prisma.Decimal;
        creditAmount: Prisma.Decimal;
        description: string | null;
      }>;
    } | null;
  } | null;
};

export type AllocatedConfirmationEntryNumber = {
  period: {
    id: string;
    year: number;
    month: number;
  };
  sequence: number;
};

export type ConfirmationJournalLine = {
  lineNumber: number;
  accountSubjectId: string;
  fundingAccountId?: string;
  debitAmount: number;
  creditAmount: number;
  description?: string;
};

export type CreateConfirmationJournalEntryInput = {
  tenantId: string;
  ledgerId: string;
  periodId: string;
  entryNumber: string;
  entryDate: Date;
  sourceKind: JournalEntrySourceKind;
  sourceCollectedTransactionId: string;
  status: JournalEntryStatus;
  memo: string;
  createdByActorType: AuditActorType;
  createdByMembershipId: string;
  lines: ConfirmationJournalLine[];
  reversesJournalEntryId?: string | null;
  correctsJournalEntryId?: string | null;
  correctionReason?: string | null;
};

/**
 * `runInTransaction` 내부에서만 사용하는 작업 컨텍스트입니다.
 *
 * 전표 번호와 수집 거래 상태는 동시에 수정될 수 있는 자원이므로,
 * 유스케이스가 트랜잭션 안에서 최신 상태를 다시 읽고 기대 상태 조건으로 갱신하도록
 * 일반 조회 포트와 분리했습니다.
 */
export abstract class ConfirmTransactionContext {
  /**
   * 목록에서 본 거래가 확정 직전에도 같은 상태인지 확인하기 위해 최신 레코드를 다시 읽습니다.
   */
  abstract findLatestForConfirmation(
    scope: ConfirmationWorkspaceScope,
    collectedTransactionId: string
  ): Promise<ConfirmationCollectedTransaction | null>;

  /**
   * 기간별 전표 번호는 순번 충돌이 치명적이므로 트랜잭션 내부에서만 할당합니다.
   */
  abstract allocateJournalEntryNumber(
    scope: ConfirmationWorkspaceScope,
    periodId: string
  ): Promise<AllocatedConfirmationEntryNumber>;

  /**
   * 수집 거래를 POSTED로 먼저 선점해 같은 거래가 중복 확정되는 상황을 막습니다.
   */
  abstract claimForConfirmation(input: {
    tenantId: string;
    ledgerId: string;
    collectedTransactionId: string;
    currentStatus: CollectedTransactionStatus;
  }): Promise<{ count: number }>;

  /**
   * 선점 실패 시 현재 상태를 다시 읽어 사용자에게 재시도 가능한 충돌인지 알려줍니다.
   */
  abstract assertClaimSucceeded(input: {
    tenantId: string;
    ledgerId: string;
    collectedTransactionId: string;
    updatedCount: number;
  }): Promise<void>;

  /**
   * 확정의 공식 산출물인 POSTED 전표와 전표 라인을 생성합니다.
   */
  abstract createJournalEntry(
    input: CreateConfirmationJournalEntryInput
  ): Promise<JournalEntryRecord>;

  /**
   * 계획 항목에서 넘어온 수집 거래라면 계획도 함께 확정해 화면 간 상태가 어긋나지 않게 합니다.
   */
  abstract markMatchedPlanItemConfirmed(
    matchedPlanItemId: string | null | undefined
  ): Promise<void>;

  /**
   * 부채 상환 계획은 전표 생성 이후 schedule에 전표 ID를 남겨 상환 이력을 잠급니다.
   */
  abstract markMatchedLiabilityRepaymentPosted(
    matchedPlanItemId: string | null | undefined,
    journalEntryId: string
  ): Promise<number>;

  /**
   * 승인취소 업로드 행이 뒤집어야 할 원거래와 원전표를 찾습니다.
   */
  abstract findReversalTarget(
    scope: ConfirmationWorkspaceScope,
    importBatchId: string,
    rowNumber: number
  ): Promise<ConfirmationReversalTarget | null>;

  /**
   * 원전표 반전/정정은 기대 상태 조건으로 처리해 동시에 들어온 조정과 충돌을 감지합니다.
   */
  abstract updateJournalEntryStatusInWorkspace(input: {
    tenantId: string;
    ledgerId: string;
    journalEntryId: string;
    expectedStatuses: JournalEntryStatus[];
    nextStatus: JournalEntryStatus;
  }): Promise<number>;

  abstract findCurrentJournalEntryStatusInWorkspace(
    scope: ConfirmationWorkspaceScope,
    journalEntryId: string
  ): Promise<JournalEntryStatus | null>;

  abstract updateCollectedTransactionStatusInWorkspace(input: {
    tenantId: string;
    ledgerId: string;
    collectedTransactionId: string;
    expectedStatuses: CollectedTransactionStatus[];
    nextStatus: CollectedTransactionStatus;
  }): Promise<number>;

  abstract findCurrentCollectedTransactionStatusInWorkspace(
    scope: ConfirmationWorkspaceScope,
    collectedTransactionId: string
  ): Promise<CollectedTransactionStatus | null>;
}

export abstract class ConfirmCollectedTransactionStorePort {
  /**
   * 트랜잭션 밖 1차 검증에 필요한 수집 거래, 기간, 원천 정보를 읽습니다.
   */
  abstract findForConfirmation(
    scope: ConfirmationWorkspaceScope,
    collectedTransactionId: string
  ): Promise<ConfirmationCollectedTransaction | null>;

  /**
   * 일반 수입/지출/이체 확정에 필요한 기본 계정과목을 코드 기준으로 조회합니다.
   */
  abstract findActiveAccountSubjects(
    scope: ConfirmationWorkspaceScope,
    codes: readonly string[]
  ): Promise<Array<{ id: string; code: string }>>;

  /**
   * 확정 흐름 전체를 한 DB 트랜잭션으로 감싸 유스케이스의 상태 전이를 원자적으로 보장합니다.
   */
  abstract runInTransaction<T>(
    fn: (ctx: ConfirmTransactionContext) => Promise<T>
  ): Promise<T>;
}
