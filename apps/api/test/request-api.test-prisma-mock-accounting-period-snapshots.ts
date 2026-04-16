import { AuditActorType, OpeningBalanceSourceKind } from '@prisma/client';
import type { RequestPrismaMockContext } from './request-api.test-prisma-mock-shared';

export function createAccountingPeriodSnapshotsPrismaMock(
  context: RequestPrismaMockContext
): Record<string, unknown> {
  const {
    state,
    findAccountingPeriod,
    findOpeningBalanceSnapshot,
    findClosingSnapshot,
    resolveAccountSubject,
    resolveAccount
  } = context;

  return {
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
                  id?: boolean;
                  code?: boolean;
                  name?: boolean;
                  subjectKind?: boolean;
                };
              };
              fundingAccount?: {
                select?: {
                  id?: boolean;
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
                    ...(args.include?.lines?.include?.accountSubject?.select?.id
                      ? { id: accountSubject?.id ?? '' }
                      : {}),
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
                          ?.id
                          ? { id: fundingAccount.id }
                          : {}),
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
          totalAssetAmount?: boolean;
          totalLiabilityAmount?: boolean;
          totalEquityAmount?: boolean;
          periodPnLAmount?: boolean;
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

        if (args.select) {
          return {
            ...(args.select.id ? { id: snapshot.id } : {}),
            ...(args.select.totalAssetAmount
              ? { totalAssetAmount: snapshot.totalAssetAmount }
              : {}),
            ...(args.select.totalLiabilityAmount
              ? { totalLiabilityAmount: snapshot.totalLiabilityAmount }
              : {}),
            ...(args.select.totalEquityAmount
              ? { totalEquityAmount: snapshot.totalEquityAmount }
              : {}),
            ...(args.select.periodPnLAmount
              ? { periodPnLAmount: snapshot.periodPnLAmount }
              : {})
          };
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
