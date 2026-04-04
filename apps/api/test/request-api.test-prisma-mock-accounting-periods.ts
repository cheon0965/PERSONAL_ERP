import {
  AccountingPeriodStatus,
  AuditActorType,
  OpeningBalanceSourceKind
} from '@prisma/client';
import type { RequestPrismaMockContext } from './request-api.test-prisma-mock-shared';

export function createAccountingPeriodsPrismaMock(
  context: RequestPrismaMockContext
): Record<string, unknown> {
  const {
    state,
    sortAccountingPeriods,
    findLedger,
    findAccountingPeriod,
    findOpeningBalanceSnapshot,
    findClosingSnapshot,
    resolveAccountSubject,
    resolveAccount
  } = context;

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
          startDate?: boolean;
          endDate?: boolean;
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
          return {
            ...(args.select.id ? { id: candidate.id } : {}),
            ...(args.select.startDate
              ? { startDate: candidate.startDate }
              : {}),
            ...(args.select.endDate ? { endDate: candidate.endDate } : {})
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

          candidate.updatedAt = new Date();
          updatedCount += 1;
        });

        return {
          count: updatedCount
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
      }
    },
    openingBalanceSnapshot: {
      findUnique: async (args: {
        where: {
          effectivePeriodId: string;
        };
        include?: {
          lines?: {
            include?: {
              accountSubject?: {
                select?: {
                  code?: boolean;
                  name?: boolean;
                  subjectKind?: boolean;
                };
              };
              fundingAccount?: {
                select?: {
                  name?: boolean;
                };
              };
            };
          };
        };
      }) => {
        const snapshot = findOpeningBalanceSnapshot(
          args.where.effectivePeriodId
        );

        if (!snapshot) {
          return null;
        }

        const lines = args.include?.lines
          ? state.balanceSnapshotLines
              .filter((line) => line.openingSnapshotId === snapshot.id)
              .map((line) => {
                const accountSubject = resolveAccountSubject(
                  line.accountSubjectId
                );
                const fundingAccount = line.fundingAccountId
                  ? resolveAccount(line.fundingAccountId)
                  : null;

                return {
                  ...line,
                  accountSubject: {
                    ...(args.include?.lines?.include?.accountSubject?.select
                      ?.code
                      ? { code: accountSubject?.code ?? '' }
                      : {}),
                    ...(args.include?.lines?.include?.accountSubject?.select
                      ?.name
                      ? { name: accountSubject?.name ?? '' }
                      : {}),
                    ...(args.include?.lines?.include?.accountSubject?.select
                      ?.subjectKind
                      ? { subjectKind: accountSubject?.subjectKind ?? 'ASSET' }
                      : {})
                  },
                  fundingAccount: fundingAccount
                    ? {
                        ...(args.include?.lines?.include?.fundingAccount?.select
                          ?.name
                          ? { name: fundingAccount.name }
                          : {})
                      }
                    : null
                };
              })
          : undefined;

        return {
          ...snapshot,
          ...(args.include?.lines ? { lines } : {})
        };
      },
      create: async (args: {
        data: {
          tenantId: string;
          ledgerId: string;
          effectivePeriodId: string;
          sourceKind: OpeningBalanceSourceKind;
          createdByActorType: AuditActorType;
          createdByMembershipId: string | null;
        };
        select?: {
          sourceKind?: boolean;
        };
      }) => {
        if (state.failOpeningBalanceSnapshotCreate) {
          throw new Error('Opening balance snapshot create failed');
        }

        const period = findAccountingPeriod(args.data.effectivePeriodId);
        if (!period) {
          throw new Error('Period not found');
        }

        const created = {
          id: `opening-snapshot-${state.openingBalanceSnapshots.length + 1}`,
          tenantId: args.data.tenantId,
          ledgerId: args.data.ledgerId,
          effectivePeriodId: args.data.effectivePeriodId,
          sourceKind: args.data.sourceKind,
          createdAt: new Date(),
          createdByActorType: args.data.createdByActorType,
          createdByMembershipId: args.data.createdByMembershipId
        };

        state.openingBalanceSnapshots.push(created);

        if (args.select?.sourceKind) {
          return {
            sourceKind: created.sourceKind
          };
        }

        return created;
      }
    },
    closingSnapshot: {
      findUnique: async (args: {
        where: {
          periodId: string;
        };
        select?: {
          id?: boolean;
        };
        include?: {
          lines?: {
            include?: {
              accountSubject?: {
                select?: {
                  code?: boolean;
                  name?: boolean;
                  subjectKind?: boolean;
                };
              };
              fundingAccount?: {
                select?: {
                  name?: boolean;
                };
              };
            };
          };
        };
      }) => {
        const snapshot = findClosingSnapshot(args.where.periodId);

        if (!snapshot) {
          return null;
        }

        if (args.select?.id) {
          return { id: snapshot.id };
        }

        const lines = args.include?.lines
          ? state.balanceSnapshotLines
              .filter((line) => line.closingSnapshotId === snapshot.id)
              .map((line) => {
                const accountSubject = resolveAccountSubject(
                  line.accountSubjectId
                );
                const fundingAccount = line.fundingAccountId
                  ? resolveAccount(line.fundingAccountId)
                  : null;

                return {
                  ...line,
                  accountSubject: {
                    ...(args.include?.lines?.include?.accountSubject?.select
                      ?.code
                      ? { code: accountSubject?.code ?? '' }
                      : {}),
                    ...(args.include?.lines?.include?.accountSubject?.select
                      ?.name
                      ? { name: accountSubject?.name ?? '' }
                      : {}),
                    ...(args.include?.lines?.include?.accountSubject?.select
                      ?.subjectKind
                      ? { subjectKind: accountSubject?.subjectKind ?? 'ASSET' }
                      : {})
                  },
                  fundingAccount: fundingAccount
                    ? {
                        ...(args.include?.lines?.include?.fundingAccount?.select
                          ?.name
                          ? { name: fundingAccount.name }
                          : {})
                      }
                    : null
                };
              })
          : undefined;

        return {
          ...snapshot,
          ...(args.include?.lines ? { lines } : {})
        };
      },
      create: async (args: {
        data: {
          tenantId: string;
          ledgerId: string;
          periodId: string;
          lockedAt: Date;
          totalAssetAmount: number;
          totalLiabilityAmount: number;
          totalEquityAmount: number;
          periodPnLAmount: number;
        };
      }) => {
        const created = {
          id: `closing-snapshot-${state.closingSnapshots.length + 1}`,
          tenantId: args.data.tenantId,
          ledgerId: args.data.ledgerId,
          periodId: args.data.periodId,
          lockedAt: new Date(String(args.data.lockedAt)),
          totalAssetAmount: args.data.totalAssetAmount,
          totalLiabilityAmount: args.data.totalLiabilityAmount,
          totalEquityAmount: args.data.totalEquityAmount,
          periodPnLAmount: args.data.periodPnLAmount,
          createdAt: new Date()
        };

        state.closingSnapshots.push(created);
        return created;
      },
      deleteMany: async (args: {
        where?: {
          tenantId?: string;
          ledgerId?: string;
          periodId?: string;
        };
      }) => {
        const deletedSnapshotIds = state.closingSnapshots
          .filter((candidate) => {
            const matchesTenant =
              !args.where?.tenantId ||
              candidate.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where?.ledgerId ||
              candidate.ledgerId === args.where.ledgerId;
            const matchesPeriod =
              !args.where?.periodId ||
              candidate.periodId === args.where.periodId;

            return matchesTenant && matchesLedger && matchesPeriod;
          })
          .map((candidate) => candidate.id);

        state.closingSnapshots = state.closingSnapshots.filter(
          (candidate) => !deletedSnapshotIds.includes(candidate.id)
        );
        state.balanceSnapshotLines = state.balanceSnapshotLines.filter(
          (candidate) =>
            !deletedSnapshotIds.includes(candidate.closingSnapshotId ?? '')
        );
        state.carryForwardRecords = state.carryForwardRecords.filter(
          (candidate) =>
            !deletedSnapshotIds.includes(candidate.sourceClosingSnapshotId)
        );

        return {
          count: deletedSnapshotIds.length
        };
      }
    },
    balanceSnapshotLine: {
      findMany: async (args: {
        where?: {
          openingSnapshotId?: string;
          closingSnapshotId?: string;
        };
        include?: {
          accountSubject?: {
            select?: {
              code?: boolean;
              name?: boolean;
              subjectKind?: boolean;
            };
          };
          fundingAccount?: {
            select?: {
              name?: boolean;
            };
          };
        };
      }) => {
        const items = state.balanceSnapshotLines.filter((line) => {
          const matchesOpeningSnapshot =
            !args.where?.openingSnapshotId ||
            line.openingSnapshotId === args.where.openingSnapshotId;
          const matchesClosingSnapshot =
            !args.where?.closingSnapshotId ||
            line.closingSnapshotId === args.where.closingSnapshotId;

          return matchesOpeningSnapshot && matchesClosingSnapshot;
        });

        return items.map((line) => {
          const accountSubject = resolveAccountSubject(line.accountSubjectId);
          const fundingAccount = line.fundingAccountId
            ? resolveAccount(line.fundingAccountId)
            : null;

          return {
            ...line,
            ...(args.include?.accountSubject
              ? {
                  accountSubject: {
                    ...(args.include.accountSubject.select?.code
                      ? { code: accountSubject?.code ?? '' }
                      : {}),
                    ...(args.include.accountSubject.select?.name
                      ? { name: accountSubject?.name ?? '' }
                      : {}),
                    ...(args.include.accountSubject.select?.subjectKind
                      ? { subjectKind: accountSubject?.subjectKind ?? 'ASSET' }
                      : {})
                  }
                }
              : {}),
            ...(args.include?.fundingAccount
              ? {
                  fundingAccount: fundingAccount
                    ? {
                        ...(args.include.fundingAccount.select?.name
                          ? { name: fundingAccount.name }
                          : {})
                      }
                    : null
                }
              : {})
          };
        });
      },
      createMany: async (args: {
        data: Array<{
          snapshotKind: 'OPENING' | 'CLOSING';
          openingSnapshotId?: string | null;
          closingSnapshotId?: string | null;
          accountSubjectId: string;
          fundingAccountId?: string | null;
          balanceAmount: number;
        }>;
      }) => {
        for (const line of args.data) {
          state.balanceSnapshotLines.push({
            id: `balance-snapshot-line-${state.balanceSnapshotLines.length + 1}`,
            snapshotKind: line.snapshotKind,
            openingSnapshotId: line.openingSnapshotId ?? null,
            closingSnapshotId: line.closingSnapshotId ?? null,
            accountSubjectId: line.accountSubjectId,
            fundingAccountId: line.fundingAccountId ?? null,
            balanceAmount: line.balanceAmount
          });
        }

        return {
          count: args.data.length
        };
      }
    }
  };
}
