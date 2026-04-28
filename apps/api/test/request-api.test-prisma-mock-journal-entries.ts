import { AuditActorType } from '@prisma/client';
import type { RequestPrismaMockContext } from './request-api.test-prisma-mock-shared';

type JournalEntryInclude = Parameters<
  RequestPrismaMockContext['projectJournalEntry']
>[1];

export function createJournalEntriesPrismaMock(
  context: RequestPrismaMockContext
): Record<string, unknown> {
  const {
    state,
    resolveAccount,
    resolveAccountSubject,
    resolveJournalEntry,
    projectJournalEntry
  } = context;

  return {
    journalEntry: {
      count: async (args: {
        where?: { tenantId?: string; ledgerId?: string; periodId?: string };
      }) => {
        return state.journalEntries.filter((candidate) => {
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;
          const matchesPeriod =
            !args.where?.periodId || candidate.periodId === args.where.periodId;

          return matchesTenant && matchesLedger && matchesPeriod;
        }).length;
      },
      findFirst: async (args: {
        where?: {
          id?: string;
          tenantId?: string;
          ledgerId?: string;
          sourceCollectedTransactionId?: string | null;
        };
        include?: JournalEntryInclude;
      }) => {
        const candidate = state.journalEntries.find((item) => {
          const matchesId = !args.where?.id || item.id === args.where.id;
          const matchesTenant =
            !args.where?.tenantId || item.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || item.ledgerId === args.where.ledgerId;
          const matchesSourceCollectedTransaction =
            args.where?.sourceCollectedTransactionId === undefined ||
            item.sourceCollectedTransactionId ===
              args.where.sourceCollectedTransactionId;

          return (
            matchesId &&
            matchesTenant &&
            matchesLedger &&
            matchesSourceCollectedTransaction
          );
        });

        if (!candidate) {
          return null;
        }

        if (!args.include) {
          return candidate;
        }

        return projectJournalEntry(candidate, {
          sourceCollectedTransaction: args.include.sourceCollectedTransaction,
          reversesJournalEntry: args.include.reversesJournalEntry,
          reversedByJournalEntry: args.include.reversedByJournalEntry,
          correctsJournalEntry: args.include.correctsJournalEntry,
          correctionEntries: args.include.correctionEntries,
          lines: args.include.lines
        });
      },
      findMany: async (args: {
        where?: { tenantId?: string; ledgerId?: string; periodId?: string };
        include?: JournalEntryInclude;
        orderBy?: Array<{
          entryDate?: 'asc' | 'desc';
          createdAt?: 'asc' | 'desc';
        }>;
        take?: number;
      }) => {
        let items = state.journalEntries.filter((candidate) => {
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;
          const matchesPeriod =
            !args.where?.periodId || candidate.periodId === args.where.periodId;

          return matchesTenant && matchesLedger && matchesPeriod;
        });

        items = [...items].sort((left, right) => {
          if (left.entryDate.getTime() !== right.entryDate.getTime()) {
            return right.entryDate.getTime() - left.entryDate.getTime();
          }

          return right.createdAt.getTime() - left.createdAt.getTime();
        });

        if (args.take !== undefined) {
          items = items.slice(0, args.take);
        }

        return items.map((candidate) =>
          projectJournalEntry(candidate, {
            sourceCollectedTransaction:
              args.include?.sourceCollectedTransaction,
            reversesJournalEntry: args.include?.reversesJournalEntry,
            reversedByJournalEntry: args.include?.reversedByJournalEntry,
            correctsJournalEntry: args.include?.correctsJournalEntry,
            correctionEntries: args.include?.correctionEntries,
            lines: args.include?.lines
          })
        );
      },
      create: async (args: {
        data: {
          tenantId: string;
          ledgerId: string;
          periodId: string;
          entryNumber: string;
          entryDate: Date;
          sourceKind:
            | 'COLLECTED_TRANSACTION'
            | 'PLAN_SETTLEMENT'
            | 'OPENING_BALANCE'
            | 'CARRY_FORWARD'
            | 'MANUAL_ADJUSTMENT';
          sourceCollectedTransactionId?: string;
          reversesJournalEntryId?: string | null;
          correctsJournalEntryId?: string | null;
          correctionReason?: string | null;
          status: 'POSTED' | 'REVERSED' | 'SUPERSEDED';
          memo?: string | null;
          createdByActorType: AuditActorType;
          createdByMembershipId: string | null;
          lines: {
            create?: Array<{
              lineNumber: number;
              accountSubjectId: string;
              fundingAccountId?: string | null;
              debitAmount: number;
              creditAmount: number;
              description?: string | null;
            }>;
            createMany?: {
              data: Array<{
                lineNumber: number;
                accountSubjectId: string;
                fundingAccountId?: string | null;
                debitAmount: number;
                creditAmount: number;
                description?: string | null;
              }>;
            };
          };
        };
        include?: JournalEntryInclude;
      }) => {
        const created = {
          id: `je-${state.journalEntries.length + 1}`,
          tenantId: args.data.tenantId,
          ledgerId: args.data.ledgerId,
          periodId: args.data.periodId,
          entryNumber: args.data.entryNumber,
          entryDate: new Date(String(args.data.entryDate)),
          sourceKind: args.data.sourceKind,
          sourceCollectedTransactionId:
            args.data.sourceCollectedTransactionId ?? null,
          reversesJournalEntryId: args.data.reversesJournalEntryId ?? null,
          correctsJournalEntryId: args.data.correctsJournalEntryId ?? null,
          correctionReason: args.data.correctionReason ?? null,
          status: args.data.status,
          memo: args.data.memo ?? null,
          createdByActorType: args.data.createdByActorType,
          createdByMembershipId: args.data.createdByMembershipId,
          createdAt: new Date(),
          updatedAt: new Date(),
          lines: (
            args.data.lines.create ??
            args.data.lines.createMany?.data ??
            []
          ).map((line, index) => ({
            id: `jel-${state.journalEntries.length + 1}-${index + 1}`,
            lineNumber: line.lineNumber,
            accountSubjectId: line.accountSubjectId,
            fundingAccountId: line.fundingAccountId ?? null,
            debitAmount: line.debitAmount,
            creditAmount: line.creditAmount,
            description: line.description ?? null
          }))
        };

        state.journalEntries.push(created);

        if (!args.include) {
          return created;
        }

        return projectJournalEntry(created, {
          sourceCollectedTransaction: args.include.sourceCollectedTransaction,
          reversesJournalEntry: args.include.reversesJournalEntry,
          reversedByJournalEntry: args.include.reversedByJournalEntry,
          correctsJournalEntry: args.include.correctsJournalEntry,
          correctionEntries: args.include.correctionEntries,
          lines: args.include.lines
        });
      },
      update: async (args: {
        where: { id: string };
        data: {
          status?: 'POSTED' | 'REVERSED' | 'SUPERSEDED';
          reversesJournalEntryId?: string | null;
          correctsJournalEntryId?: string | null;
          correctionReason?: string | null;
        };
      }) => {
        const candidate = resolveJournalEntry(args.where.id);

        if (!candidate) {
          throw new Error('Journal entry not found');
        }

        if (args.data.status) {
          candidate.status = args.data.status;
        }

        if ('reversesJournalEntryId' in args.data) {
          candidate.reversesJournalEntryId = args.data.reversesJournalEntryId;
        }

        if ('correctsJournalEntryId' in args.data) {
          candidate.correctsJournalEntryId = args.data.correctsJournalEntryId;
        }

        if ('correctionReason' in args.data) {
          candidate.correctionReason = args.data.correctionReason;
        }

        candidate.updatedAt = new Date();

        return candidate;
      },
      updateMany: async (args: {
        where?: {
          id?: string;
          tenantId?: string;
          ledgerId?: string;
          status?:
            | 'POSTED'
            | 'REVERSED'
            | 'SUPERSEDED'
            | {
                in?: Array<'POSTED' | 'REVERSED' | 'SUPERSEDED'>;
              };
        };
        data: {
          status?: 'POSTED' | 'REVERSED' | 'SUPERSEDED';
          reversesJournalEntryId?: string | null;
          correctsJournalEntryId?: string | null;
          correctionReason?: string | null;
        };
      }) => {
        let updatedCount = 0;

        state.journalEntries.forEach((candidate) => {
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

          if (args.data.status) {
            candidate.status = args.data.status;
          }

          if ('reversesJournalEntryId' in args.data) {
            candidate.reversesJournalEntryId = args.data.reversesJournalEntryId;
          }

          if ('correctsJournalEntryId' in args.data) {
            candidate.correctsJournalEntryId = args.data.correctsJournalEntryId;
          }

          if ('correctionReason' in args.data) {
            candidate.correctionReason = args.data.correctionReason;
          }

          candidate.updatedAt = new Date();
          updatedCount += 1;
        });

        return {
          count: updatedCount
        };
      }
    },

    journalLine: {
      count: async (args: {
        where?: {
          fundingAccountId?: string | null;
          journalEntry?: {
            tenantId?: string;
            ledgerId?: string;
            is?: {
              tenantId?: string;
              ledgerId?: string;
            };
          };
        };
      }) => {
        const relationFilter = args.where?.journalEntry;
        const tenantId =
          relationFilter?.tenantId ?? relationFilter?.is?.tenantId;
        const ledgerId =
          relationFilter?.ledgerId ?? relationFilter?.is?.ledgerId;

        return state.journalEntries
          .filter((candidate) => {
            const matchesTenant = !tenantId || candidate.tenantId === tenantId;
            const matchesLedger = !ledgerId || candidate.ledgerId === ledgerId;

            return matchesTenant && matchesLedger;
          })
          .flatMap((entry) => entry.lines)
          .filter((line) => {
            return (
              args.where?.fundingAccountId === undefined ||
              line.fundingAccountId === args.where.fundingAccountId
            );
          }).length;
      },
      findMany: async (args: {
        where?: {
          fundingAccountId?: string | null;
          journalEntry?: {
            tenantId?: string;
            ledgerId?: string;
            periodId?: string;
            status?: 'POSTED' | 'REVERSED' | 'SUPERSEDED';
          };
        };
        select?: {
          id?: boolean;
        };
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
        take?: number;
      }) => {
        const entries = state.journalEntries.filter((candidate) => {
          const matchesTenant =
            !args.where?.journalEntry?.tenantId ||
            candidate.tenantId === args.where.journalEntry.tenantId;
          const matchesLedger =
            !args.where?.journalEntry?.ledgerId ||
            candidate.ledgerId === args.where.journalEntry.ledgerId;
          const matchesPeriod =
            !args.where?.journalEntry?.periodId ||
            candidate.periodId === args.where.journalEntry.periodId;
          const matchesStatus =
            !args.where?.journalEntry?.status ||
            candidate.status === args.where.journalEntry.status;

          return (
            matchesTenant && matchesLedger && matchesPeriod && matchesStatus
          );
        });

        let lines = entries.flatMap((entry) =>
          entry.lines.map((line) => {
            const accountSubject = resolveAccountSubject(line.accountSubjectId);
            const fundingAccount = line.fundingAccountId
              ? resolveAccount(line.fundingAccountId)
              : null;

            return {
              ...line,
              ...(args.include?.accountSubject
                ? {
                    accountSubject: {
                      ...(args.include.accountSubject.select?.id
                        ? { id: accountSubject?.id ?? '' }
                        : {}),
                      ...(args.include.accountSubject.select?.code
                        ? { code: accountSubject?.code ?? '' }
                        : {}),
                      ...(args.include.accountSubject.select?.name
                        ? { name: accountSubject?.name ?? '' }
                        : {}),
                      ...(args.include.accountSubject.select?.subjectKind
                        ? {
                            subjectKind: accountSubject?.subjectKind ?? 'ASSET'
                          }
                        : {})
                    }
                  }
                : {}),
              ...(args.include?.fundingAccount
                ? {
                    fundingAccount: fundingAccount
                      ? {
                          ...(args.include.fundingAccount.select?.id
                            ? { id: fundingAccount.id }
                            : {}),
                          ...(args.include.fundingAccount.select?.name
                            ? { name: fundingAccount.name }
                            : {})
                        }
                      : null
                  }
                : {})
            };
          })
        );

        if (args.where?.fundingAccountId !== undefined) {
          lines = lines.filter(
            (line) => line.fundingAccountId === args.where?.fundingAccountId
          );
        }

        if (args.take !== undefined) {
          lines = lines.slice(0, args.take);
        }

        if (args.select) {
          return lines.map((line) => ({
            ...(args.select?.id ? { id: line.id } : {})
          }));
        }

        return lines;
      }
    }
  };
}
