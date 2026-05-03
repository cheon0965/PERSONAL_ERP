import { AccountingPeriodStatus, AuditActorType } from '@prisma/client';
import type { RequestPrismaMockContext } from './request-api.test-prisma-mock-shared';

export function createAccountingPeriodStatePrismaMock(
  context: RequestPrismaMockContext
): Record<string, unknown> {
  const { state, sortAccountingPeriods, findLedger } = context;
  const resolveNextJournalEntrySequence = (periodId: string) =>
    state.accountingPeriods.find((candidate) => candidate.id === periodId)
      ?.nextJournalEntrySequence ??
    state.journalEntries
      .filter((candidate) => candidate.periodId === periodId)
      .reduce((maxSequence, candidate) => {
        const rawSequence = Number(candidate.entryNumber.split('-').at(-1));
        return Number.isFinite(rawSequence) && rawSequence > maxSequence
          ? rawSequence
          : maxSequence;
      }, 0) + 1;

  return {
    accountingPeriod: {
      findFirst: async (args: {
        where?: {
          id?: string;
          tenantId?: string;
          ledgerId?: string;
          year?: number;
          month?: number;
          status?: AccountingPeriodStatus | { in?: AccountingPeriodStatus[] };
          OR?: Array<{
            year?: number | { lt?: number };
            month?: number | { lt?: number };
          }>;
        };
        select?: {
          id?: boolean;
          tenantId?: boolean;
          ledgerId?: boolean;
          year?: boolean;
          month?: boolean;
          status?: boolean;
          startDate?: boolean;
          endDate?: boolean;
          ledger?: {
            select?: { baseCurrency?: boolean };
          };
          openingBalanceSnapshot?: {
            select?: { id?: boolean; sourceKind?: boolean };
          };
        };
        include?: {
          ledger?: {
            select?: { baseCurrency?: boolean };
          };
          openingBalanceSnapshot?: {
            select?: { sourceKind?: boolean };
          };
          statusHistory?: {
            orderBy?: { changedAt?: 'asc' | 'desc' };
            select?: {
              id?: boolean;
              fromStatus?: boolean;
              toStatus?: boolean;
              eventType?: boolean;
              reason?: boolean;
              actorType?: boolean;
              actorMembershipId?: boolean;
              changedAt?: boolean;
            };
          };
        };
        orderBy?: Array<{ year?: 'asc' | 'desc'; month?: 'asc' | 'desc' }>;
      }) => {
        let items = state.accountingPeriods.filter((candidate) => {
          const matchesId = !args.where?.id || candidate.id === args.where.id;
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;
          const matchesYear =
            args.where?.year === undefined ||
            candidate.year === args.where.year;
          const matchesMonth =
            args.where?.month === undefined ||
            candidate.month === args.where.month;
          const matchesStatus =
            args.where?.status === undefined
              ? true
              : typeof args.where.status === 'string'
                ? candidate.status === args.where.status
                : !args.where.status.in ||
                  args.where.status.in.includes(candidate.status);
          const matchesOr =
            !args.where?.OR ||
            args.where.OR.some((clause) => {
              const matchesClauseYear =
                clause.year === undefined
                  ? true
                  : typeof clause.year === 'number'
                    ? candidate.year === clause.year
                    : clause.year.lt === undefined
                      ? true
                      : candidate.year < clause.year.lt;
              const matchesClauseMonth =
                clause.month === undefined
                  ? true
                  : typeof clause.month === 'number'
                    ? candidate.month === clause.month
                    : clause.month.lt === undefined
                      ? true
                      : candidate.month < clause.month.lt;

              return matchesClauseYear && matchesClauseMonth;
            });

          return (
            matchesId &&
            matchesTenant &&
            matchesLedger &&
            matchesYear &&
            matchesMonth &&
            matchesStatus &&
            matchesOr
          );
        });

        items = sortAccountingPeriods(items);

        const candidate = items[0];
        if (!candidate) {
          return null;
        }

        if (args.select) {
          const ledger = args.select.ledger
            ? findLedger(candidate.ledgerId)
            : null;
          const openingBalanceSnapshot = args.select.openingBalanceSnapshot
            ? (state.openingBalanceSnapshots.find(
                (snapshot) => snapshot.effectivePeriodId === candidate.id
              ) ?? null)
            : undefined;

          return {
            ...(args.select.id ? { id: candidate.id } : {}),
            ...(args.select.tenantId ? { tenantId: candidate.tenantId } : {}),
            ...(args.select.ledgerId ? { ledgerId: candidate.ledgerId } : {}),
            ...(args.select.year ? { year: candidate.year } : {}),
            ...(args.select.month ? { month: candidate.month } : {}),
            ...(args.select.status ? { status: candidate.status } : {}),
            ...(args.select.startDate
              ? { startDate: candidate.startDate }
              : {}),
            ...(args.select.endDate ? { endDate: candidate.endDate } : {}),
            ...(args.select.ledger
              ? {
                  ledger: ledger
                    ? {
                        ...(args.select.ledger.select?.baseCurrency
                          ? { baseCurrency: ledger.baseCurrency }
                          : {})
                      }
                    : null
                }
              : {}),
            ...(args.select.openingBalanceSnapshot
              ? {
                  openingBalanceSnapshot: openingBalanceSnapshot
                    ? {
                        ...(args.select.openingBalanceSnapshot.select?.id
                          ? { id: openingBalanceSnapshot.id }
                          : {}),
                        ...(args.select.openingBalanceSnapshot.select
                          ?.sourceKind
                          ? { sourceKind: openingBalanceSnapshot.sourceKind }
                          : {})
                      }
                    : null
                }
              : {})
          };
        }

        const ledger = args.include?.ledger
          ? findLedger(candidate.ledgerId)
          : null;
        const openingBalanceSnapshot = args.include?.openingBalanceSnapshot
          ? (state.openingBalanceSnapshots.find(
              (snapshot) => snapshot.effectivePeriodId === candidate.id
            ) ?? null)
          : undefined;
        const statusHistory = args.include?.statusHistory
          ? [...state.periodStatusHistory]
              .filter((history) => history.periodId === candidate.id)
              .sort(
                (left, right) =>
                  right.changedAt.getTime() - left.changedAt.getTime()
              )
              .map((history) => ({
                ...(args.include?.statusHistory?.select?.id
                  ? { id: history.id }
                  : {}),
                ...(args.include?.statusHistory?.select?.fromStatus
                  ? { fromStatus: history.fromStatus }
                  : {}),
                ...(args.include?.statusHistory?.select?.toStatus
                  ? { toStatus: history.toStatus }
                  : {}),
                ...(args.include?.statusHistory?.select?.eventType
                  ? { eventType: history.eventType }
                  : {}),
                ...(args.include?.statusHistory?.select?.reason
                  ? { reason: history.reason }
                  : {}),
                ...(args.include?.statusHistory?.select?.actorType
                  ? { actorType: history.actorType }
                  : {}),
                ...(args.include?.statusHistory?.select?.actorMembershipId
                  ? { actorMembershipId: history.actorMembershipId }
                  : {}),
                ...(args.include?.statusHistory?.select?.changedAt
                  ? { changedAt: history.changedAt }
                  : {})
              }))
          : undefined;

        return {
          ...candidate,
          nextJournalEntrySequence: resolveNextJournalEntrySequence(
            candidate.id
          ),
          ...(args.include?.ledger
            ? {
                ledger: ledger
                  ? {
                      ...(args.include.ledger.select?.baseCurrency
                        ? { baseCurrency: ledger.baseCurrency }
                        : {})
                    }
                  : null
              }
            : {}),
          ...(args.include?.openingBalanceSnapshot
            ? {
                openingBalanceSnapshot: openingBalanceSnapshot
                  ? {
                      ...(args.include?.openingBalanceSnapshot?.select
                        ?.sourceKind
                        ? { sourceKind: openingBalanceSnapshot.sourceKind }
                        : {})
                    }
                  : null
              }
            : {}),
          ...(args.include?.statusHistory ? { statusHistory } : {})
        };
      },
      findMany: async (args: {
        where?: { tenantId?: string; ledgerId?: string };
        include?: {
          ledger?: {
            select?: { baseCurrency?: boolean };
          };
          openingBalanceSnapshot?: {
            select?: { sourceKind?: boolean };
          };
          statusHistory?: {
            orderBy?: { changedAt?: 'asc' | 'desc' };
            select?: {
              id?: boolean;
              fromStatus?: boolean;
              toStatus?: boolean;
              eventType?: boolean;
              reason?: boolean;
              actorType?: boolean;
              actorMembershipId?: boolean;
              changedAt?: boolean;
            };
          };
        };
        orderBy?: Array<{ year?: 'asc' | 'desc'; month?: 'asc' | 'desc' }>;
      }) => {
        let items = state.accountingPeriods.filter((candidate) => {
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;

          return matchesTenant && matchesLedger;
        });

        items = sortAccountingPeriods(items);

        return items.map((candidate) => {
          const ledger = args.include?.ledger
            ? findLedger(candidate.ledgerId)
            : null;
          const openingBalanceSnapshot = args.include?.openingBalanceSnapshot
            ? (state.openingBalanceSnapshots.find(
                (snapshot) => snapshot.effectivePeriodId === candidate.id
              ) ?? null)
            : undefined;
          const statusHistory = args.include?.statusHistory
            ? [...state.periodStatusHistory]
                .filter((history) => history.periodId === candidate.id)
                .sort(
                  (left, right) =>
                    right.changedAt.getTime() - left.changedAt.getTime()
                )
                .map((history) => ({
                  ...(args.include?.statusHistory?.select?.id
                    ? { id: history.id }
                    : {}),
                  ...(args.include?.statusHistory?.select?.fromStatus
                    ? { fromStatus: history.fromStatus }
                    : {}),
                  ...(args.include?.statusHistory?.select?.toStatus
                    ? { toStatus: history.toStatus }
                    : {}),
                  ...(args.include?.statusHistory?.select?.eventType
                    ? { eventType: history.eventType }
                    : {}),
                  ...(args.include?.statusHistory?.select?.reason
                    ? { reason: history.reason }
                    : {}),
                  ...(args.include?.statusHistory?.select?.actorType
                    ? { actorType: history.actorType }
                    : {}),
                  ...(args.include?.statusHistory?.select?.actorMembershipId
                    ? { actorMembershipId: history.actorMembershipId }
                    : {}),
                  ...(args.include?.statusHistory?.select?.changedAt
                    ? { changedAt: history.changedAt }
                    : {})
                }))
            : undefined;

          return {
            ...candidate,
            nextJournalEntrySequence: resolveNextJournalEntrySequence(
              candidate.id
            ),
            ...(args.include?.ledger
              ? {
                  ledger: ledger
                    ? {
                        ...(args.include.ledger.select?.baseCurrency
                          ? { baseCurrency: ledger.baseCurrency }
                          : {})
                      }
                    : null
                }
              : {}),
            ...(args.include?.openingBalanceSnapshot
              ? {
                  openingBalanceSnapshot: openingBalanceSnapshot
                    ? {
                        ...(args.include?.openingBalanceSnapshot?.select
                          ?.sourceKind
                          ? { sourceKind: openingBalanceSnapshot.sourceKind }
                          : {})
                      }
                    : null
                }
              : {}),
            ...(args.include?.statusHistory ? { statusHistory } : {})
          };
        });
      },
      create: async (args: {
        data: {
          tenantId: string;
          ledgerId: string;
          year: number;
          month: number;
          startDate: Date;
          endDate: Date;
          status: AccountingPeriodStatus;
        };
      }) => {
        const created = {
          id: `period-${state.accountingPeriods.length + 1}`,
          tenantId: args.data.tenantId,
          ledgerId: args.data.ledgerId,
          year: args.data.year,
          month: args.data.month,
          startDate: args.data.startDate,
          endDate: args.data.endDate,
          status: args.data.status,
          nextJournalEntrySequence: 1,
          openedAt: new Date(),
          lockedAt: null,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        state.accountingPeriods.push(created);
        return created;
      },
      update: async (args: {
        where: { id: string };
        data: {
          status?: AccountingPeriodStatus;
          lockedAt?: Date | null;
          nextJournalEntrySequence?: { increment?: number };
        };
      }) => {
        const candidate = state.accountingPeriods.find(
          (item) => item.id === args.where.id
        );

        if (!candidate) {
          throw new Error('Accounting period not found');
        }

        if (args.data.status !== undefined) {
          candidate.status = args.data.status;
        }

        if (args.data.lockedAt !== undefined) {
          candidate.lockedAt = args.data.lockedAt;
        }

        if (args.data.nextJournalEntrySequence?.increment) {
          candidate.nextJournalEntrySequence =
            resolveNextJournalEntrySequence(candidate.id) +
            args.data.nextJournalEntrySequence.increment;
        }

        candidate.updatedAt = new Date();
        return candidate;
      },
      updateMany: async (args: {
        where?: {
          id?: string;
          tenantId?: string;
          ledgerId?: string;
          status?: AccountingPeriodStatus | { in?: AccountingPeriodStatus[] };
        };
        data: {
          status?: AccountingPeriodStatus;
          lockedAt?: Date | null;
          nextJournalEntrySequence?: { increment?: number };
        };
      }) => {
        let updatedCount = 0;

        state.accountingPeriods.forEach((candidate) => {
          const matchesId = !args.where?.id || candidate.id === args.where.id;
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;
          const matchesStatus =
            args.where?.status === undefined
              ? true
              : typeof args.where.status === 'string'
                ? candidate.status === args.where.status
                : !args.where.status.in ||
                  args.where.status.in.includes(candidate.status);

          if (!(matchesId && matchesTenant && matchesLedger && matchesStatus)) {
            return;
          }

          if (args.data.status !== undefined) {
            candidate.status = args.data.status;
          }

          if (args.data.lockedAt !== undefined) {
            candidate.lockedAt = args.data.lockedAt;
          }

          if (args.data.nextJournalEntrySequence?.increment) {
            candidate.nextJournalEntrySequence =
              resolveNextJournalEntrySequence(candidate.id) +
              args.data.nextJournalEntrySequence.increment;
          }

          candidate.updatedAt = new Date();
          updatedCount += 1;
        });

        return {
          count: updatedCount
        };
      },
      deleteMany: async (args: {
        where?: {
          id?: string;
          tenantId?: string;
          ledgerId?: string;
          status?: AccountingPeriodStatus;
        };
      }) => {
        const deletedPeriodIds = state.accountingPeriods
          .filter((candidate) => {
            const matchesId = !args.where?.id || candidate.id === args.where.id;
            const matchesTenant =
              !args.where?.tenantId ||
              candidate.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where?.ledgerId ||
              candidate.ledgerId === args.where.ledgerId;
            const matchesStatus =
              !args.where?.status || candidate.status === args.where.status;

            return matchesId && matchesTenant && matchesLedger && matchesStatus;
          })
          .map((candidate) => candidate.id);

        state.accountingPeriods = state.accountingPeriods.filter(
          (candidate) => !deletedPeriodIds.includes(candidate.id)
        );
        state.periodStatusHistory = state.periodStatusHistory.filter(
          (candidate) => !deletedPeriodIds.includes(candidate.periodId)
        );

        return {
          count: deletedPeriodIds.length
        };
      }
    },
    periodStatusHistory: {
      create: async (args: {
        data: {
          tenantId: string;
          ledgerId: string;
          periodId: string;
          fromStatus: AccountingPeriodStatus | null;
          toStatus: AccountingPeriodStatus;
          eventType:
            | 'OPEN'
            | 'MOVE_TO_REVIEW'
            | 'START_CLOSING'
            | 'LOCK'
            | 'REOPEN'
            | 'FORCE_LOCK';
          reason: string | null;
          actorType: AuditActorType;
          actorMembershipId: string | null;
        };
      }) => {
        const created = {
          id: `period-history-${state.periodStatusHistory.length + 1}`,
          tenantId: args.data.tenantId,
          ledgerId: args.data.ledgerId,
          periodId: args.data.periodId,
          fromStatus: args.data.fromStatus,
          toStatus: args.data.toStatus,
          eventType: args.data.eventType,
          reason: args.data.reason,
          actorType: args.data.actorType,
          actorMembershipId: args.data.actorMembershipId,
          changedAt: new Date()
        };

        state.periodStatusHistory.push(created);
        return created;
      },
      deleteMany: async (args: {
        where?: {
          tenantId?: string;
          ledgerId?: string;
          periodId?: string;
        };
      }) => {
        const beforeCount = state.periodStatusHistory.length;
        state.periodStatusHistory = state.periodStatusHistory.filter(
          (candidate) => {
            const matchesTenant =
              !args.where?.tenantId ||
              candidate.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where?.ledgerId ||
              candidate.ledgerId === args.where.ledgerId;
            const matchesPeriod =
              !args.where?.periodId ||
              candidate.periodId === args.where.periodId;

            return !(matchesTenant && matchesLedger && matchesPeriod);
          }
        );

        return {
          count: beforeCount - state.periodStatusHistory.length
        };
      }
    }
  };
}
