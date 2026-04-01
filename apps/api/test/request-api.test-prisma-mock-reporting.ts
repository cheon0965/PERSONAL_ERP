import type { FinancialStatementPayload } from '@personal-erp/contracts';
import { AuditActorType, FinancialStatementKind } from '@prisma/client';
import type { RequestPrismaMockContext } from './request-api.test-prisma-mock-shared';

export function createReportingPrismaMock(
  context: RequestPrismaMockContext
): Record<string, unknown> {
  const { state, findAccountingPeriod, findCarryForwardRecord } = context;

  return {
    financialStatementSnapshot: {
      findMany: async (args: {
        where?: {
          tenantId?: string;
          ledgerId?: string;
          periodId?: string;
        };
        include?: {
          period?: {
            select?: {
              year?: boolean;
              month?: boolean;
            };
          };
        };
      }) => {
        const items = state.financialStatementSnapshots.filter((candidate) => {
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;
          const matchesPeriod =
            !args.where?.periodId || candidate.periodId === args.where.periodId;

          return matchesTenant && matchesLedger && matchesPeriod;
        });

        return items.map((candidate) => {
          const period = findAccountingPeriod(candidate.periodId);

          return {
            ...candidate,
            ...(args.include?.period
              ? {
                  period: period
                    ? {
                        ...(args.include.period.select?.year
                          ? { year: period.year }
                          : {}),
                        ...(args.include.period.select?.month
                          ? { month: period.month }
                          : {})
                      }
                    : null
                }
              : {})
          };
        });
      },
      upsert: async (args: {
        where: {
          periodId_statementKind: {
            periodId: string;
            statementKind: FinancialStatementKind;
          };
        };
        update: {
          currency: string;
          payload: FinancialStatementPayload;
        };
        create: {
          tenantId: string;
          ledgerId: string;
          periodId: string;
          statementKind: FinancialStatementKind;
          currency: string;
          payload: FinancialStatementPayload;
        };
      }) => {
        const existing = state.financialStatementSnapshots.find(
          (candidate) =>
            candidate.periodId === args.where.periodId_statementKind.periodId &&
            candidate.statementKind ===
              args.where.periodId_statementKind.statementKind
        );

        if (existing) {
          existing.currency = args.update.currency;
          existing.payload = args.update.payload;
          existing.updatedAt = new Date();
          return existing;
        }

        const created = {
          id: `financial-statement-snapshot-${state.financialStatementSnapshots.length + 1}`,
          tenantId: args.create.tenantId,
          ledgerId: args.create.ledgerId,
          periodId: args.create.periodId,
          statementKind: args.create.statementKind,
          currency: args.create.currency,
          payload: args.create.payload,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        state.financialStatementSnapshots.push(created);
        return created;
      },
      deleteMany: async (args: {
        where?: {
          tenantId?: string;
          ledgerId?: string;
          periodId?: string;
        };
      }) => {
        const beforeCount = state.financialStatementSnapshots.length;
        state.financialStatementSnapshots =
          state.financialStatementSnapshots.filter((candidate) => {
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
          });

        return {
          count: beforeCount - state.financialStatementSnapshots.length
        };
      }
    },
    carryForwardRecord: {
      findFirst: async (args: {
        where?: {
          tenantId?: string;
          ledgerId?: string;
          fromPeriodId?: string;
          toPeriodId?: string;
        };
      }) => {
        const fromPeriodMatch = args.where?.fromPeriodId
          ? findCarryForwardRecord(args.where.fromPeriodId)
          : null;

        if (
          fromPeriodMatch &&
          (!args.where?.tenantId ||
            fromPeriodMatch.tenantId === args.where.tenantId) &&
          (!args.where?.ledgerId ||
            fromPeriodMatch.ledgerId === args.where.ledgerId)
        ) {
          return fromPeriodMatch;
        }

        return (
          state.carryForwardRecords.find((candidate) => {
            const matchesTenant =
              !args.where?.tenantId ||
              candidate.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where?.ledgerId ||
              candidate.ledgerId === args.where.ledgerId;
            const matchesFromPeriod =
              !args.where?.fromPeriodId ||
              candidate.fromPeriodId === args.where.fromPeriodId;
            const matchesToPeriod =
              !args.where?.toPeriodId ||
              candidate.toPeriodId === args.where.toPeriodId;

            return (
              matchesTenant &&
              matchesLedger &&
              matchesFromPeriod &&
              matchesToPeriod
            );
          }) ?? null
        );
      },
      create: async (args: {
        data: {
          tenantId: string;
          ledgerId: string;
          fromPeriodId: string;
          toPeriodId: string;
          sourceClosingSnapshotId: string;
          createdJournalEntryId: string | null;
          createdByActorType: AuditActorType;
          createdByMembershipId: string | null;
        };
      }) => {
        const created = {
          id: `carry-forward-record-${state.carryForwardRecords.length + 1}`,
          tenantId: args.data.tenantId,
          ledgerId: args.data.ledgerId,
          fromPeriodId: args.data.fromPeriodId,
          toPeriodId: args.data.toPeriodId,
          sourceClosingSnapshotId: args.data.sourceClosingSnapshotId,
          createdJournalEntryId: args.data.createdJournalEntryId,
          createdAt: new Date(),
          createdByActorType: args.data.createdByActorType,
          createdByMembershipId: args.data.createdByMembershipId
        };

        state.carryForwardRecords.push(created);
        return created;
      }
    }
  };
}
