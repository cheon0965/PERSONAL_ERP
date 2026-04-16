import type { PrismaMoneyLike } from '../../../../common/money/prisma-money';
// eslint-disable-next-line no-restricted-imports
import type {
  AccountSubjectKind,
  AccountingPeriodStatus,
  AuditActorType
} from '@prisma/client';

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
  abstract readGenerationContext(
    tenantId: string,
    ledgerId: string,
    fromPeriodId: string,
    nextYear: number,
    nextMonth: number
  ): Promise<CarryForwardGenerationContext>;

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
