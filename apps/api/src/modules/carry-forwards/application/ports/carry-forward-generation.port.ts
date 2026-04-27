import type { PrismaMoneyLike } from '../../../../common/money/prisma-money';
// eslint-disable-next-line no-restricted-imports
import type {
  AccountSubjectKind,
  AccountingPeriodStatus,
  AuditActorType
} from '@prisma/client';

/**
 * 월마감 결과를 다음 월의 기초 잔액으로 넘기는 이월 생성 포트입니다.
 *
 * 이월은 "마감 스냅샷 읽기 -> 다음 월 존재 여부 확인 -> 오프닝 스냅샷 생성"이
 * 한 흐름으로 묶여야 합니다. 유스케이스가 회계 정책을 판단하고,
 * 이 포트 구현체가 실제 저장 방식과 상태 이력 생성을 담당하도록 경계를 나눕니다.
 */
export type CarryForwardGenerationPeriod = {
  id: string;
  tenantId: string;
  ledgerId: string;
  year: number;
  month: number;
  status: AccountingPeriodStatus;
  openingBalanceSnapshot: {
    id: string;
  } | null;
};

export type CarryForwardGenerationContext = {
  sourcePeriod: CarryForwardGenerationPeriod | null;
  sourceClosingSnapshot: {
    id: string;
    lines: Array<{
      accountSubjectId: string;
      fundingAccountId: string | null;
      balanceAmount: PrismaMoneyLike;
      accountSubject: {
        subjectKind: AccountSubjectKind;
      };
    }>;
  } | null;
  existingRecord: {
    id: string;
  } | null;
  existingTargetPeriod: CarryForwardGenerationPeriod | null;
};

export abstract class CarryForwardGenerationPort {
  /**
   * 이월 생성 가능 여부 판단에 필요한 원천 기간, 마감 스냅샷, 기존 이월, 대상 기간을 한 번에 읽습니다.
   */
  abstract readGenerationContext(
    tenantId: string,
    ledgerId: string,
    fromPeriodId: string,
    nextYear: number,
    nextMonth: number
  ): Promise<CarryForwardGenerationContext>;

  /**
   * 대상 월 기간과 오프닝 스냅샷, 이월 기록을 하나의 원자적 저장 단위로 생성합니다.
   */
  abstract createCarryForward(input: {
    tenantId: string;
    ledgerId: string;
    sourcePeriod: {
      id: string;
      year: number;
      month: number;
    };
    nextYear: number;
    nextMonth: number;
    nextPeriodBoundary: {
      startDate: Date;
      endDate: Date;
    };
    existingTargetPeriod: {
      id: string;
    } | null;
    carryableLines: Array<{
      accountSubjectId: string;
      fundingAccountId: string | null;
      balanceAmount: PrismaMoneyLike;
    }>;
    sourceClosingSnapshotId: string;
    actorRef: {
      actorType: AuditActorType;
      actorMembershipId: string;
    };
    createdByActorRef: {
      createdByActorType: AuditActorType;
      createdByMembershipId: string;
    };
  }): Promise<void>;
}
