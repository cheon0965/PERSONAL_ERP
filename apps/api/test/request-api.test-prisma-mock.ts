import type { FinancialStatementPayload } from '@personal-erp/contracts';
import {
  AccountingPeriodStatus,
  AuditActorType,
  CollectedTransactionStatus,
  FinancialStatementKind,
  ImportBatchParseStatus,
  ImportedRowParseStatus,
  ImportSourceKind,
  LedgerTransactionFlowKind,
  RecurrenceFrequency,
  OpeningBalanceSourceKind,
  PlanItemStatus,
  TransactionOrigin,
  TransactionStatus,
  TransactionType
} from '@prisma/client';
import type {
  RequestTestState,
  RequestTestUser
} from './request-api.test-types';

function applyOneShotTransactionSimulations(state: RequestTestState) {
  const collectedTransactionId =
    state.simulateCollectedTransactionAlreadyPostedOnNextTransactionId;

  if (!collectedTransactionId) {
    return;
  }

  state.simulateCollectedTransactionAlreadyPostedOnNextTransactionId = null;

  const collectedTransaction = state.collectedTransactions.find(
    (candidate) => candidate.id === collectedTransactionId
  );

  if (!collectedTransaction) {
    return;
  }

  collectedTransaction.status = CollectedTransactionStatus.POSTED;
  collectedTransaction.updatedAt = new Date();

  const existingJournalEntry = state.journalEntries.find(
    (candidate) =>
      candidate.sourceCollectedTransactionId === collectedTransaction.id
  );

  if (existingJournalEntry) {
    return;
  }

  state.journalEntries.push({
    id: `simulated-journal-entry-${state.journalEntries.length + 1}`,
    tenantId: collectedTransaction.tenantId,
    ledgerId: collectedTransaction.ledgerId,
    periodId: collectedTransaction.periodId ?? 'simulated-period',
    entryNumber: `SIM-${String(state.journalEntries.length + 1).padStart(4, '0')}`,
    entryDate: new Date(collectedTransaction.occurredOn),
    sourceKind: 'COLLECTED_TRANSACTION',
    sourceCollectedTransactionId: collectedTransaction.id,
    reversesJournalEntryId: null,
    correctsJournalEntryId: null,
    correctionReason: null,
    status: 'POSTED',
    memo: collectedTransaction.memo,
    createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
    createdByMembershipId: 'membership-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    lines: []
  });
}

export function createPrismaMock(
  state: RequestTestState
): Record<string, unknown> {
  const sortTransactions = (
    items: RequestTestState['transactions']
  ): RequestTestState['transactions'] =>
    [...items].sort((left, right) => {
      if (left.businessDate.getTime() !== right.businessDate.getTime()) {
        return right.businessDate.getTime() - left.businessDate.getTime();
      }

      return right.createdAt.getTime() - left.createdAt.getTime();
    });

  const sortCollectedTransactions = (
    items: RequestTestState['collectedTransactions']
  ): RequestTestState['collectedTransactions'] =>
    [...items].sort((left, right) => {
      if (left.occurredOn.getTime() !== right.occurredOn.getTime()) {
        return right.occurredOn.getTime() - left.occurredOn.getTime();
      }

      return right.createdAt.getTime() - left.createdAt.getTime();
    });

  const sortRecurringRules = (
    items: RequestTestState['recurringRules']
  ): RequestTestState['recurringRules'] =>
    [...items].sort((left, right) => {
      if (left.isActive !== right.isActive) {
        return Number(right.isActive) - Number(left.isActive);
      }

      return left.nextRunDate.getTime() - right.nextRunDate.getTime();
    });

  const sortAccountingPeriods = (
    items: RequestTestState['accountingPeriods']
  ): RequestTestState['accountingPeriods'] =>
    [...items].sort((left, right) => {
      if (left.year !== right.year) {
        return right.year - left.year;
      }

      return right.month - left.month;
    });

  const findUser = (where: { email?: string; id?: string }) =>
    state.users.find((candidate) => {
      const { email, id } = where;
      return (
        (!email || candidate.email === email) && (!id || candidate.id === id)
      );
    });
  const findTenant = (tenantId: string) =>
    state.tenants.find((candidate) => candidate.id === tenantId) ?? null;
  const findLedger = (ledgerId: string) =>
    state.ledgers.find((candidate) => candidate.id === ledgerId) ?? null;
  const findAccountingPeriod = (periodId: string) =>
    state.accountingPeriods.find((candidate) => candidate.id === periodId) ??
    null;
  const findOpeningBalanceSnapshot = (periodId: string) =>
    state.openingBalanceSnapshots.find(
      (candidate) => candidate.effectivePeriodId === periodId
    ) ?? null;
  const findClosingSnapshot = (periodId: string) =>
    state.closingSnapshots.find(
      (candidate) => candidate.periodId === periodId
    ) ?? null;
  const findCarryForwardRecord = (fromPeriodId: string) =>
    state.carryForwardRecords.find(
      (candidate) => candidate.fromPeriodId === fromPeriodId
    ) ?? null;
  const findImportBatch = (importBatchId: string) =>
    state.importBatches.find((candidate) => candidate.id === importBatchId) ??
    null;
  const findPlanItem = (planItemId: string) =>
    state.planItems.find((candidate) => candidate.id === planItemId) ?? null;
  const findCollectedTransactionByImportedRowId = (importedRowId: string) =>
    state.collectedTransactions.find(
      (candidate) => candidate.importedRowId === importedRowId
    ) ?? null;
  const resolveImportedRows = (batchId: string) =>
    [...state.importedRows]
      .filter((candidate) => candidate.batchId === batchId)
      .sort((left, right) => left.rowNumber - right.rowNumber)
      .map((candidate) => ({
        ...candidate,
        createdCollectedTransaction: (() => {
          const createdCollectedTransaction =
            findCollectedTransactionByImportedRowId(candidate.id);

          return createdCollectedTransaction
            ? { id: createdCollectedTransaction.id }
            : null;
        })()
      }));
  const projectImportBatch = (
    candidate: RequestTestState['importBatches'][number],
    include?: {
      rows?: {
        orderBy?: { rowNumber?: 'asc' | 'desc' };
      };
    }
  ) => {
    const rows = include?.rows
      ? resolveImportedRows(candidate.id).map((row) => ({ ...row }))
      : undefined;

    return {
      ...candidate,
      ...(include?.rows ? { rows } : {})
    };
  };

  const projectUser = (
    user: RequestTestUser,
    select?:
      | {
          id?: boolean;
          email?: boolean;
          name?: boolean;
          settings?: {
            select?: {
              minimumReserveWon?: boolean;
              monthlySinkingFundWon?: boolean;
            };
          };
        }
      | undefined
  ) => {
    if (!select) {
      return user;
    }

    const projected: Record<string, unknown> = {};

    if (select.id) {
      projected.id = user.id;
    }

    if (select.email) {
      projected.email = user.email;
    }

    if (select.name) {
      projected.name = user.name;
    }

    if (select.settings) {
      projected.settings = user.settings
        ? {
            minimumReserveWon: select.settings.select?.minimumReserveWon
              ? user.settings.minimumReserveWon
              : undefined,
            monthlySinkingFundWon: select.settings.select?.monthlySinkingFundWon
              ? user.settings.monthlySinkingFundWon
              : undefined
          }
        : null;
    }

    return projected;
  };

  const resolveAccount = (accountId: string) =>
    state.accounts.find((candidate) => candidate.id === accountId) ?? null;
  const resolveCategory = (categoryId: string) =>
    state.categories.find((candidate) => candidate.id === categoryId) ?? null;
  const resolveLedgerTransactionType = (ledgerTransactionTypeId: string) =>
    state.ledgerTransactionTypes.find(
      (candidate) => candidate.id === ledgerTransactionTypeId
    ) ?? null;
  const resolveAccountSubject = (accountSubjectId: string) =>
    state.accountSubjects.find(
      (candidate) => candidate.id === accountSubjectId
    ) ?? null;
  const resolveJournalEntry = (journalEntryId: string) =>
    state.journalEntries.find((candidate) => candidate.id === journalEntryId) ??
    null;
  const resolveJournalEntryByCollectedTransaction = (
    collectedTransactionId: string
  ) =>
    state.journalEntries.find(
      (candidate) =>
        candidate.sourceCollectedTransactionId === collectedTransactionId
    ) ?? null;

  type JournalEntryRelationInclude = {
    select?: { id?: boolean; entryNumber?: boolean };
  };

  type JournalEntryInclude = {
    sourceCollectedTransaction?: {
      select?: { id?: boolean; title?: boolean; status?: boolean };
    };
    reversesJournalEntry?: JournalEntryRelationInclude;
    reversedByJournalEntry?: JournalEntryRelationInclude;
    correctsJournalEntry?: JournalEntryRelationInclude;
    correctionEntries?: {
      select?: { id?: boolean; entryNumber?: boolean };
      orderBy?: { createdAt?: 'asc' | 'desc' };
    };
    lines?: {
      include?: {
        accountSubject?: {
          select?: { code?: boolean; name?: boolean };
        };
        fundingAccount?: {
          select?: { name?: boolean };
        };
      };
      orderBy?: { lineNumber?: 'asc' | 'desc' };
    };
  };

  const projectJournalEntry = (
    candidate: RequestTestState['journalEntries'][number],
    include?: JournalEntryInclude
  ) => {
    const sourceCollectedTransaction = candidate.sourceCollectedTransactionId
      ? (state.collectedTransactions.find(
          (item) => item.id === candidate.sourceCollectedTransactionId
        ) ?? null)
      : null;
    const reversesJournalEntry = candidate.reversesJournalEntryId
      ? resolveJournalEntry(candidate.reversesJournalEntryId)
      : null;
    const reversedByJournalEntry =
      state.journalEntries.find(
        (item) => item.reversesJournalEntryId === candidate.id
      ) ?? null;
    const correctsJournalEntry = candidate.correctsJournalEntryId
      ? resolveJournalEntry(candidate.correctsJournalEntryId)
      : null;
    const correctionEntries = state.journalEntries
      .filter((item) => item.correctsJournalEntryId === candidate.id)
      .sort((left, right) => {
        if (include?.correctionEntries?.orderBy?.createdAt === 'desc') {
          return right.createdAt.getTime() - left.createdAt.getTime();
        }

        return left.createdAt.getTime() - right.createdAt.getTime();
      });

    return {
      ...candidate,
      ...(include?.sourceCollectedTransaction
        ? {
            sourceCollectedTransaction: sourceCollectedTransaction
              ? {
                  ...(include.sourceCollectedTransaction.select?.id
                    ? { id: sourceCollectedTransaction.id }
                    : {}),
                  ...(include.sourceCollectedTransaction.select?.title
                    ? { title: sourceCollectedTransaction.title }
                    : {}),
                  ...(include.sourceCollectedTransaction.select?.status
                    ? { status: sourceCollectedTransaction.status }
                    : {})
                }
              : null
          }
        : {}),
      ...(include?.reversesJournalEntry
        ? {
            reversesJournalEntry: reversesJournalEntry
              ? {
                  ...(include.reversesJournalEntry.select?.id
                    ? { id: reversesJournalEntry.id }
                    : {}),
                  ...(include.reversesJournalEntry.select?.entryNumber
                    ? { entryNumber: reversesJournalEntry.entryNumber }
                    : {})
                }
              : null
          }
        : {}),
      ...(include?.reversedByJournalEntry
        ? {
            reversedByJournalEntry: reversedByJournalEntry
              ? {
                  ...(include.reversedByJournalEntry.select?.id
                    ? { id: reversedByJournalEntry.id }
                    : {}),
                  ...(include.reversedByJournalEntry.select?.entryNumber
                    ? { entryNumber: reversedByJournalEntry.entryNumber }
                    : {})
                }
              : null
          }
        : {}),
      ...(include?.correctsJournalEntry
        ? {
            correctsJournalEntry: correctsJournalEntry
              ? {
                  ...(include.correctsJournalEntry.select?.id
                    ? { id: correctsJournalEntry.id }
                    : {}),
                  ...(include.correctsJournalEntry.select?.entryNumber
                    ? { entryNumber: correctsJournalEntry.entryNumber }
                    : {})
                }
              : null
          }
        : {}),
      ...(include?.correctionEntries
        ? {
            correctionEntries: correctionEntries.map((item) => ({
              ...(include.correctionEntries?.select?.id ? { id: item.id } : {}),
              ...(include.correctionEntries?.select?.entryNumber
                ? { entryNumber: item.entryNumber }
                : {})
            }))
          }
        : {}),
      ...(include?.lines
        ? {
            lines: candidate.lines.map((line) => {
              const accountSubject = resolveAccountSubject(
                line.accountSubjectId
              );
              const fundingAccount = line.fundingAccountId
                ? resolveAccount(line.fundingAccountId)
                : null;

              return {
                ...line,
                ...(include.lines?.include?.accountSubject
                  ? {
                      accountSubject: {
                        ...(include.lines.include.accountSubject.select?.code
                          ? { code: accountSubject?.code ?? '' }
                          : {}),
                        ...(include.lines.include.accountSubject.select?.name
                          ? { name: accountSubject?.name ?? '' }
                          : {})
                      }
                    }
                  : {}),
                ...(include.lines?.include?.fundingAccount
                  ? {
                      fundingAccount: fundingAccount
                        ? {
                            ...(include.lines.include.fundingAccount.select
                              ?.name
                              ? { name: fundingAccount.name }
                              : {})
                          }
                        : null
                    }
                  : {})
              };
            })
          }
        : {})
    };
  };

  return {
    $queryRaw: async () => {
      if (!state.databaseReady) {
        throw new Error('Database unavailable');
      }

      return [{ ready: 1 }];
    },
    $transaction: async <T>(
      callback: (tx: Record<string, unknown>) => Promise<T>
    ) => {
      applyOneShotTransactionSimulations(state);
      const transactionState = structuredClone(state);
      const result = await callback(createPrismaMock(transactionState));
      Object.assign(state, transactionState);
      return result;
    },
    user: {
      findUnique: async (args: {
        where: { email?: string; id?: string };
        select?: {
          id?: boolean;
          email?: boolean;
          name?: boolean;
          settings?: {
            select?: {
              minimumReserveWon?: boolean;
              monthlySinkingFundWon?: boolean;
            };
          };
        };
      }) => {
        const user = findUser(args.where);

        if (!user) {
          return null;
        }

        return projectUser(user, args.select);
      },
      findUniqueOrThrow: async (args: {
        where: { id: string };
        select?: {
          settings?: {
            select?: {
              minimumReserveWon?: boolean;
              monthlySinkingFundWon?: boolean;
            };
          };
        };
      }) => {
        const user = findUser(args.where);

        if (!user) {
          throw new Error('User not found');
        }

        return projectUser(user, args.select);
      }
    },
    authSession: {
      create: async (args: {
        data: {
          id: string;
          userId: string;
          refreshTokenHash: string;
          expiresAt: Date;
        };
      }) => {
        const created = {
          ...args.data,
          revokedAt: null
        };
        state.authSessions.push(created);
        return created;
      },
      findUnique: async (args: { where: { id: string } }) => {
        return (
          state.authSessions.find(
            (candidate) => candidate.id === args.where.id
          ) ?? null
        );
      },
      updateMany: async (args: {
        where: {
          id?: string;
          userId?: string;
          revokedAt?: null;
        };
        data: {
          revokedAt?: Date | null;
        };
      }) => {
        let count = 0;

        state.authSessions = state.authSessions.map((candidate) => {
          const matchesId = !args.where.id || candidate.id === args.where.id;
          const matchesUser =
            !args.where.userId || candidate.userId === args.where.userId;
          const matchesRevoked =
            args.where.revokedAt === undefined ||
            candidate.revokedAt === args.where.revokedAt;

          if (!(matchesId && matchesUser && matchesRevoked)) {
            return candidate;
          }

          count += 1;
          return {
            ...candidate,
            ...args.data
          };
        });

        return { count };
      }
    },
    tenantMembership: {
      findMany: async (args: {
        where?: {
          userId?: string;
          status?: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'REMOVED';
        };
        select?: {
          id?: boolean;
          role?: boolean;
          status?: boolean;
          tenantId?: boolean;
          joinedAt?: boolean;
        };
      }) => {
        const items = state.memberships.filter((candidate) => {
          const matchesUser =
            !args.where?.userId || candidate.userId === args.where.userId;
          const matchesStatus =
            !args.where?.status || candidate.status === args.where.status;
          return matchesUser && matchesStatus;
        });

        if (!args.select) {
          return items;
        }

        return items.map((candidate) => ({
          ...(args.select?.id ? { id: candidate.id } : {}),
          ...(args.select?.role ? { role: candidate.role } : {}),
          ...(args.select?.status ? { status: candidate.status } : {}),
          ...(args.select?.tenantId ? { tenantId: candidate.tenantId } : {}),
          ...(args.select?.joinedAt ? { joinedAt: candidate.joinedAt } : {})
        }));
      }
    },
    tenant: {
      findUnique: async (args: {
        where: { id: string };
        select?: {
          id?: boolean;
          slug?: boolean;
          name?: boolean;
          status?: boolean;
          defaultLedgerId?: boolean;
        };
      }) => {
        const tenant = findTenant(args.where.id);
        if (!tenant) {
          return null;
        }

        if (!args.select) {
          return tenant;
        }

        return {
          ...(args.select.id ? { id: tenant.id } : {}),
          ...(args.select.slug ? { slug: tenant.slug } : {}),
          ...(args.select.name ? { name: tenant.name } : {}),
          ...(args.select.status ? { status: tenant.status } : {}),
          ...(args.select.defaultLedgerId
            ? { defaultLedgerId: tenant.defaultLedgerId }
            : {})
        };
      }
    },
    ledger: {
      findUnique: async (args: {
        where: { id: string };
        select?: {
          id?: boolean;
          name?: boolean;
          baseCurrency?: boolean;
          timezone?: boolean;
          status?: boolean;
        };
      }) => {
        const ledger = findLedger(args.where.id);
        if (!ledger) {
          return null;
        }

        if (!args.select) {
          return ledger;
        }

        return {
          ...(args.select.id ? { id: ledger.id } : {}),
          ...(args.select.name ? { name: ledger.name } : {}),
          ...(args.select.baseCurrency
            ? { baseCurrency: ledger.baseCurrency }
            : {}),
          ...(args.select.timezone ? { timezone: ledger.timezone } : {}),
          ...(args.select.status ? { status: ledger.status } : {})
        };
      },
      findFirst: async (args: {
        where?: { tenantId?: string };
        select?: {
          id?: boolean;
          name?: boolean;
          baseCurrency?: boolean;
          timezone?: boolean;
          status?: boolean;
        };
      }) => {
        const ledger =
          state.ledgers.find(
            (candidate) =>
              !args.where?.tenantId ||
              candidate.tenantId === args.where.tenantId
          ) ?? null;

        if (!ledger) {
          return null;
        }

        if (!args.select) {
          return ledger;
        }

        return {
          ...(args.select.id ? { id: ledger.id } : {}),
          ...(args.select.name ? { name: ledger.name } : {}),
          ...(args.select.baseCurrency
            ? { baseCurrency: ledger.baseCurrency }
            : {}),
          ...(args.select.timezone ? { timezone: ledger.timezone } : {}),
          ...(args.select.status ? { status: ledger.status } : {})
        };
      }
    },
    importBatch: {
      findFirst: async (args: {
        where?: {
          id?: string;
          tenantId?: string;
          ledgerId?: string;
        };
        include?: {
          rows?: {
            orderBy?: { rowNumber?: 'asc' | 'desc' };
          };
        };
      }) => {
        const items = state.importBatches
          .filter((candidate) => {
            const matchesId = !args.where?.id || candidate.id === args.where.id;
            const matchesTenant =
              !args.where?.tenantId ||
              candidate.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where?.ledgerId ||
              candidate.ledgerId === args.where.ledgerId;

            return matchesId && matchesTenant && matchesLedger;
          })
          .sort(
            (left, right) =>
              right.uploadedAt.getTime() - left.uploadedAt.getTime()
          );

        const candidate = items[0];
        return candidate ? projectImportBatch(candidate, args.include) : null;
      },
      findMany: async (args: {
        where?: {
          tenantId?: string;
          ledgerId?: string;
        };
        include?: {
          rows?: {
            orderBy?: { rowNumber?: 'asc' | 'desc' };
          };
        };
        orderBy?: {
          uploadedAt?: 'asc' | 'desc';
        };
      }) => {
        const items = state.importBatches
          .filter((candidate) => {
            const matchesTenant =
              !args.where?.tenantId ||
              candidate.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where?.ledgerId ||
              candidate.ledgerId === args.where.ledgerId;

            return matchesTenant && matchesLedger;
          })
          .sort(
            (left, right) =>
              right.uploadedAt.getTime() - left.uploadedAt.getTime()
          );

        return items.map((candidate) =>
          projectImportBatch(candidate, args.include)
        );
      },
      create: async (args: {
        data: {
          tenantId: string;
          ledgerId: string;
          periodId: string | null;
          sourceKind: ImportSourceKind;
          fileName: string;
          fileHash: string;
          rowCount: number;
          parseStatus: ImportBatchParseStatus;
          uploadedByMembershipId: string;
        };
      }) => {
        const created = {
          id: `import-batch-${state.importBatches.length + 1}`,
          tenantId: args.data.tenantId,
          ledgerId: args.data.ledgerId,
          periodId: args.data.periodId,
          sourceKind: args.data.sourceKind,
          fileName: args.data.fileName,
          fileHash: args.data.fileHash,
          rowCount: args.data.rowCount,
          parseStatus: args.data.parseStatus,
          uploadedByMembershipId: args.data.uploadedByMembershipId,
          uploadedAt: new Date()
        };

        state.importBatches.push(created);
        return created;
      }
    },
    importedRow: {
      findFirst: async (args: {
        where?: {
          id?: string;
          batchId?: string;
          batch?: {
            tenantId?: string;
            ledgerId?: string;
          };
        };
        select?: {
          id?: boolean;
          parseStatus?: boolean;
          rawPayload?: boolean;
          sourceFingerprint?: boolean;
          createdCollectedTransaction?: {
            select?: {
              id?: boolean;
            };
          };
          batch?: {
            select?: {
              sourceKind?: boolean;
            };
          };
        };
      }) => {
        const candidate = state.importedRows.find((row) => {
          const batch = findImportBatch(row.batchId);
          const matchesId = !args.where?.id || row.id === args.where.id;
          const matchesBatchId =
            !args.where?.batchId || row.batchId === args.where.batchId;
          const matchesTenant =
            !args.where?.batch?.tenantId ||
            batch?.tenantId === args.where.batch.tenantId;
          const matchesLedger =
            !args.where?.batch?.ledgerId ||
            batch?.ledgerId === args.where.batch.ledgerId;

          return matchesId && matchesBatchId && matchesTenant && matchesLedger;
        });

        if (!candidate) {
          return null;
        }

        const batch = findImportBatch(candidate.batchId);
        const createdCollectedTransaction =
          findCollectedTransactionByImportedRowId(candidate.id);

        if (!args.select) {
          return {
            ...candidate,
            createdCollectedTransaction: createdCollectedTransaction
              ? { id: createdCollectedTransaction.id }
              : null,
            batch: batch
              ? {
                  sourceKind: batch.sourceKind
                }
              : null
          };
        }

        return {
          ...(args.select.id ? { id: candidate.id } : {}),
          ...(args.select.parseStatus
            ? { parseStatus: candidate.parseStatus }
            : {}),
          ...(args.select.rawPayload
            ? { rawPayload: candidate.rawPayload }
            : {}),
          ...(args.select.sourceFingerprint
            ? { sourceFingerprint: candidate.sourceFingerprint }
            : {}),
          ...(args.select.createdCollectedTransaction
            ? {
                createdCollectedTransaction: createdCollectedTransaction
                  ? {
                      ...(args.select.createdCollectedTransaction.select?.id
                        ? { id: createdCollectedTransaction.id }
                        : {})
                    }
                  : null
              }
            : {}),
          ...(args.select.batch
            ? {
                batch: batch
                  ? {
                      ...(args.select.batch.select?.sourceKind
                        ? { sourceKind: batch.sourceKind }
                        : {})
                    }
                  : null
              }
            : {})
        };
      },
      create: async (args: {
        data: {
          batchId: string;
          rowNumber: number;
          rawPayload: Record<string, unknown>;
          parseStatus: ImportedRowParseStatus;
          parseError: string | null;
          sourceFingerprint: string | null;
        };
      }) => {
        const batch = findImportBatch(args.data.batchId);
        if (!batch) {
          throw new Error('Import batch not found');
        }

        const created = {
          id: `imported-row-${state.importedRows.length + 1}`,
          batchId: args.data.batchId,
          rowNumber: args.data.rowNumber,
          rawPayload: args.data.rawPayload,
          parseStatus: args.data.parseStatus,
          parseError: args.data.parseError,
          sourceFingerprint: args.data.sourceFingerprint
        };

        state.importedRows.push(created);
        return created;
      }
    },
    planItem: {
      findMany: async (args: {
        where?: {
          tenantId?: string;
          ledgerId?: string;
          periodId?: string;
          status?: PlanItemStatus;
          matchedCollectedTransaction?: {
            is?: null;
          };
        };
        select?: {
          id?: boolean;
          plannedAmount?: boolean;
          plannedDate?: boolean;
          fundingAccountId?: boolean;
          ledgerTransactionTypeId?: boolean;
          categoryId?: boolean;
        };
        orderBy?: Array<{
          plannedDate?: 'asc' | 'desc';
          createdAt?: 'asc' | 'desc';
        }>;
      }) => {
        const items = [...state.planItems]
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
            const matchesStatus =
              args.where?.status === undefined ||
              candidate.status === args.where.status;
            const matchesUnmatched =
              args.where?.matchedCollectedTransaction?.is !== null ||
              !state.collectedTransactions.some(
                (transaction) => transaction.matchedPlanItemId === candidate.id
              );

            return (
              matchesTenant &&
              matchesLedger &&
              matchesPeriod &&
              matchesStatus &&
              matchesUnmatched
            );
          })
          .sort((left, right) => {
            const plannedDateDiff =
              left.plannedDate.getTime() - right.plannedDate.getTime();
            if (plannedDateDiff !== 0) {
              return plannedDateDiff;
            }

            return left.createdAt.getTime() - right.createdAt.getTime();
          });

        return items.map((candidate) => {
          if (!args.select) {
            return candidate;
          }

          return {
            ...(args.select.id ? { id: candidate.id } : {}),
            ...(args.select.plannedAmount
              ? { plannedAmount: candidate.plannedAmount }
              : {}),
            ...(args.select.plannedDate
              ? { plannedDate: candidate.plannedDate }
              : {}),
            ...(args.select.fundingAccountId
              ? { fundingAccountId: candidate.fundingAccountId }
              : {}),
            ...(args.select.ledgerTransactionTypeId
              ? { ledgerTransactionTypeId: candidate.ledgerTransactionTypeId }
              : {}),
            ...(args.select.categoryId
              ? { categoryId: candidate.categoryId }
              : {})
          };
        });
      },
      update: async (args: {
        where: {
          id: string;
        };
        data: {
          status?: PlanItemStatus;
        };
      }) => {
        const candidate = findPlanItem(args.where.id);
        if (!candidate) {
          throw new Error('Plan item not found');
        }

        if (args.data.status) {
          candidate.status = args.data.status;
        }

        candidate.updatedAt = new Date();
        return candidate;
      }
    },
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
    },
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
    },
    accountSubject: {
      findMany: async (args: {
        where?: {
          tenantId?: string;
          ledgerId?: string;
          code?: { in?: string[] };
          isActive?: boolean;
        };
        select?: {
          id?: boolean;
          code?: boolean;
        };
      }) => {
        const items = state.accountSubjects.filter((candidate) => {
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;
          const matchesCode =
            !args.where?.code?.in ||
            args.where.code.in.includes(candidate.code);
          const matchesActive =
            args.where?.isActive === undefined ||
            candidate.isActive === args.where.isActive;

          return matchesTenant && matchesLedger && matchesCode && matchesActive;
        });

        if (!args.select) {
          return items;
        }

        return items.map((candidate) => ({
          ...(args.select?.id ? { id: candidate.id } : {}),
          ...(args.select?.code ? { code: candidate.code } : {})
        }));
      }
    },
    ledgerTransactionType: {
      findFirst: async (args: {
        where: {
          tenantId?: string;
          ledgerId?: string;
          code?: string;
          isActive?: boolean;
        };
        select?: {
          id?: boolean;
        };
      }) => {
        const item =
          state.ledgerTransactionTypes.find((candidate) => {
            const matchesTenant =
              !args.where.tenantId ||
              candidate.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where.ledgerId ||
              candidate.ledgerId === args.where.ledgerId;
            const matchesCode =
              !args.where.code || candidate.code === args.where.code;
            const matchesActive =
              args.where.isActive === undefined ||
              candidate.isActive === args.where.isActive;

            return (
              matchesTenant && matchesLedger && matchesCode && matchesActive
            );
          }) ?? null;

        if (!item) {
          return null;
        }

        if (args.select?.id) {
          return {
            id: item.id
          };
        }

        return item;
      },
      findMany: async (args: {
        where?: {
          tenantId?: string;
          ledgerId?: string;
          isActive?: boolean;
        };
      }) => {
        return state.ledgerTransactionTypes.filter((candidate) => {
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;
          const matchesActive =
            args.where?.isActive === undefined ||
            candidate.isActive === args.where.isActive;

          return matchesTenant && matchesLedger && matchesActive;
        });
      }
    },
    account: {
      findFirst: async (args: {
        where: {
          id: string;
          userId?: string;
          tenantId?: string;
          ledgerId?: string;
        };
        select?: {
          id?: boolean;
          name?: boolean;
        };
      }) => {
        const account = state.accounts.find(
          (candidate) =>
            candidate.id === args.where.id &&
            (!args.where.userId || candidate.userId === args.where.userId) &&
            (!args.where.tenantId ||
              candidate.tenantId === args.where.tenantId) &&
            (!args.where.ledgerId || candidate.ledgerId === args.where.ledgerId)
        );

        if (!account) {
          return null;
        }

        if (!args.select) {
          return account;
        }

        return {
          ...(args.select.id ? { id: account.id } : {}),
          ...(args.select.name ? { name: account.name } : {})
        };
      },
      findMany: async (args: {
        where?: {
          userId?: string;
          tenantId?: string;
          ledgerId?: string;
          status?: 'ACTIVE' | 'INACTIVE' | 'CLOSED';
        };
        select?: { balanceWon?: boolean };
      }) => {
        const items = state.accounts.filter((candidate) => {
          const matchesUser =
            !args.where?.userId || candidate.userId === args.where.userId;
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;

          return matchesUser && matchesTenant && matchesLedger;
        });

        if (args.select?.balanceWon) {
          return items.map((candidate) => ({
            balanceWon: candidate.balanceWon
          }));
        }

        return items;
      }
    },
    category: {
      findFirst: async (args: {
        where: {
          id: string;
          userId?: string;
          tenantId?: string;
          ledgerId?: string;
        };
        select?: {
          id?: boolean;
          name?: boolean;
        };
      }) => {
        const category = state.categories.find(
          (candidate) =>
            candidate.id === args.where.id &&
            (!args.where.userId || candidate.userId === args.where.userId) &&
            (!args.where.tenantId ||
              candidate.tenantId === args.where.tenantId) &&
            (!args.where.ledgerId || candidate.ledgerId === args.where.ledgerId)
        );

        if (!category) {
          return null;
        }

        if (!args.select) {
          return category;
        }

        return {
          ...(args.select.id ? { id: category.id } : {}),
          ...(args.select.name ? { name: category.name } : {})
        };
      },
      findMany: async (args: {
        where?: {
          userId?: string;
          tenantId?: string;
          ledgerId?: string;
          kind?: 'INCOME' | 'EXPENSE' | 'TRANSFER';
          isActive?: boolean;
        };
      }) => {
        return state.categories
          .filter((candidate) => {
            const matchesUser =
              !args.where?.userId || candidate.userId === args.where.userId;
            const matchesTenant =
              !args.where?.tenantId ||
              candidate.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where?.ledgerId ||
              candidate.ledgerId === args.where.ledgerId;
            const matchesKind =
              !args.where?.kind || candidate.kind === args.where.kind;
            const matchesActive =
              args.where?.isActive === undefined ||
              candidate.isActive === args.where.isActive;

            return (
              matchesUser &&
              matchesTenant &&
              matchesLedger &&
              matchesKind &&
              matchesActive
            );
          })
          .sort((left, right) => {
            if (left.kind !== right.kind) {
              const categoryKindOrder = {
                INCOME: 0,
                EXPENSE: 1,
                TRANSFER: 2
              } as const;

              return (
                categoryKindOrder[left.kind ?? 'EXPENSE'] -
                categoryKindOrder[right.kind ?? 'EXPENSE']
              );
            }

            return left.name.localeCompare(right.name);
          });
      }
    },
    collectedTransaction: {
      findFirst: async (args: {
        where?: {
          id?: string;
          tenantId?: string;
          ledgerId?: string;
          sourceFingerprint?: string | null;
        };
        select?: {
          id?: boolean;
        };
        include?: {
          period?: {
            select?: {
              id?: boolean;
              year?: boolean;
              month?: boolean;
              status?: boolean;
            };
          };
          fundingAccount?: {
            select?: {
              id?: boolean;
              name?: boolean;
            };
          };
          category?: {
            select?: {
              name?: boolean;
            };
          };
          ledgerTransactionType?: {
            select?: {
              postingPolicyKey?: boolean;
            };
          };
          postedJournalEntry?: {
            select?: {
              id?: boolean;
            };
          };
        };
      }) => {
        const candidate =
          state.collectedTransactions.find((item) => {
            const matchesId = !args.where?.id || item.id === args.where.id;
            const matchesTenant =
              !args.where?.tenantId || item.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where?.ledgerId || item.ledgerId === args.where.ledgerId;
            const matchesSourceFingerprint =
              args.where?.sourceFingerprint === undefined ||
              item.sourceFingerprint === args.where.sourceFingerprint;

            return (
              matchesId &&
              matchesTenant &&
              matchesLedger &&
              matchesSourceFingerprint
            );
          }) ?? null;

        if (!candidate) {
          return null;
        }

        if (args.select) {
          return {
            ...(args.select.id ? { id: candidate.id } : {})
          };
        }

        const period = candidate.periodId
          ? findAccountingPeriod(candidate.periodId)
          : null;
        const fundingAccount = resolveAccount(candidate.fundingAccountId);
        const category = candidate.categoryId
          ? resolveCategory(candidate.categoryId)
          : null;
        const _ledgerTransactionType = resolveLedgerTransactionType(
          candidate.ledgerTransactionTypeId
        );
        const postedJournalEntry = resolveJournalEntryByCollectedTransaction(
          candidate.id
        );

        if (!args.include) {
          return candidate;
        }

        return {
          ...candidate,
          ...(args.include.period
            ? {
                period: period
                  ? {
                      ...(args.include.period.select?.id
                        ? { id: period.id }
                        : {}),
                      ...(args.include.period.select?.year
                        ? { year: period.year }
                        : {}),
                      ...(args.include.period.select?.month
                        ? { month: period.month }
                        : {}),
                      ...(args.include.period.select?.status
                        ? { status: period.status }
                        : {})
                    }
                  : null
              }
            : {}),
          ...(args.include.fundingAccount
            ? {
                fundingAccount: {
                  ...(args.include.fundingAccount.select?.id
                    ? { id: fundingAccount?.id ?? '' }
                    : {}),
                  ...(args.include.fundingAccount.select?.name
                    ? { name: fundingAccount?.name ?? '' }
                    : {})
                }
              }
            : {}),
          ...(args.include.category
            ? {
                category: category
                  ? {
                      ...(args.include.category.select?.name
                        ? { name: category.name }
                        : {})
                    }
                  : null
              }
            : {}),
          ...(args.include.ledgerTransactionType
            ? {
                ledgerTransactionType: {
                  ...(args.include.ledgerTransactionType.select
                    ?.postingPolicyKey
                    ? {
                        postingPolicyKey:
                          candidate.ledgerTransactionTypeId === 'ltt-1-income'
                            ? 'INCOME_BASIC'
                            : candidate.ledgerTransactionTypeId ===
                                'ltt-1-transfer'
                              ? 'TRANSFER_BASIC'
                              : 'EXPENSE_BASIC'
                      }
                    : {})
                }
              }
            : {}),
          ...(args.include.postedJournalEntry
            ? {
                postedJournalEntry: postedJournalEntry
                  ? {
                      ...(args.include.postedJournalEntry.select?.id
                        ? { id: postedJournalEntry.id }
                        : {})
                    }
                  : null
              }
            : {})
        };
      },
      findMany: async (args: {
        where?: { tenantId?: string; ledgerId?: string };
        select?: {
          id?: boolean;
          occurredOn?: boolean;
          title?: boolean;
          amount?: boolean;
          status?: boolean;
          importBatchId?: boolean;
          matchedPlanItemId?: boolean;
          postedJournalEntry?: {
            select?: {
              id?: boolean;
              entryNumber?: boolean;
            };
          };
          fundingAccount?: {
            select?: { name?: boolean };
          };
          category?: {
            select?: { name?: boolean };
          };
          ledgerTransactionType?: {
            select?: { flowKind?: boolean };
          };
        };
        orderBy?: Array<{
          occurredOn?: 'asc' | 'desc';
          createdAt?: 'asc' | 'desc';
        }>;
        take?: number;
      }) => {
        let items = state.collectedTransactions.filter((candidate) => {
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;

          return matchesTenant && matchesLedger;
        });

        items = sortCollectedTransactions(items);

        if (args.take !== undefined) {
          items = items.slice(0, args.take);
        }

        return items.map((candidate) => {
          const fundingAccount = resolveAccount(candidate.fundingAccountId);
          const category = candidate.categoryId
            ? resolveCategory(candidate.categoryId)
            : null;
          const ledgerTransactionType = resolveLedgerTransactionType(
            candidate.ledgerTransactionTypeId
          );
          const postedJournalEntry = resolveJournalEntryByCollectedTransaction(
            candidate.id
          );

          if (!args.select) {
            return candidate;
          }

          return {
            ...(args.select.id ? { id: candidate.id } : {}),
            ...(args.select.occurredOn
              ? { occurredOn: candidate.occurredOn }
              : {}),
            ...(args.select.title ? { title: candidate.title } : {}),
            ...(args.select.amount ? { amount: candidate.amount } : {}),
            ...(args.select.status ? { status: candidate.status } : {}),
            ...(args.select.importBatchId
              ? { importBatchId: candidate.importBatchId }
              : {}),
            ...(args.select.matchedPlanItemId
              ? { matchedPlanItemId: candidate.matchedPlanItemId }
              : {}),
            ...(args.select.postedJournalEntry
              ? {
                  postedJournalEntry: postedJournalEntry
                    ? {
                        ...(args.select.postedJournalEntry.select?.id
                          ? { id: postedJournalEntry.id }
                          : {}),
                        ...(args.select.postedJournalEntry.select?.entryNumber
                          ? { entryNumber: postedJournalEntry.entryNumber }
                          : {})
                      }
                    : null
                }
              : {}),
            ...(args.select.fundingAccount
              ? {
                  fundingAccount: {
                    ...(args.select.fundingAccount.select?.name
                      ? { name: fundingAccount?.name ?? '' }
                      : {})
                  }
                }
              : {}),
            ...(args.select.category
              ? {
                  category: category
                    ? {
                        ...(args.select.category.select?.name
                          ? { name: category.name }
                          : {})
                      }
                    : null
                }
              : {}),
            ...(args.select.ledgerTransactionType
              ? {
                  ledgerTransactionType: {
                    ...(args.select.ledgerTransactionType.select?.flowKind
                      ? {
                          flowKind:
                            ledgerTransactionType?.flowKind ??
                            LedgerTransactionFlowKind.EXPENSE
                        }
                      : {})
                  }
                }
              : {})
          };
        });
      },
      create: async (args: {
        data: {
          tenantId: string;
          ledgerId: string;
          periodId?: string;
          importBatchId?: string | null;
          importedRowId?: string | null;
          matchedPlanItemId?: string | null;
          ledgerTransactionTypeId: string;
          fundingAccountId: string;
          categoryId?: string;
          title: string;
          occurredOn: Date;
          amount: number;
          status: CollectedTransactionStatus;
          sourceFingerprint?: string | null;
          memo?: string;
        };
        select?: {
          id?: boolean;
          occurredOn?: boolean;
          title?: boolean;
          amount?: boolean;
          status?: boolean;
          importBatchId?: boolean;
          matchedPlanItemId?: boolean;
          postedJournalEntry?: {
            select?: {
              id?: boolean;
              entryNumber?: boolean;
            };
          };
          fundingAccount?: {
            select?: { name?: boolean };
          };
          category?: {
            select?: { name?: boolean };
          };
          ledgerTransactionType?: {
            select?: { flowKind?: boolean };
          };
        };
      }) => {
        const fundingAccount = resolveAccount(args.data.fundingAccountId);
        const category = args.data.categoryId
          ? resolveCategory(args.data.categoryId)
          : null;
        const ledgerTransactionType = resolveLedgerTransactionType(
          args.data.ledgerTransactionTypeId
        );
        const created = {
          id: `ctx-${state.collectedTransactions.length + 1}`,
          tenantId: args.data.tenantId,
          ledgerId: args.data.ledgerId,
          periodId: args.data.periodId ?? null,
          ledgerTransactionTypeId: args.data.ledgerTransactionTypeId,
          fundingAccountId: args.data.fundingAccountId,
          categoryId: args.data.categoryId ?? null,
          matchedPlanItemId: args.data.matchedPlanItemId ?? null,
          importBatchId: args.data.importBatchId ?? null,
          importedRowId: args.data.importedRowId ?? null,
          sourceFingerprint: args.data.sourceFingerprint ?? null,
          title: args.data.title,
          occurredOn: new Date(String(args.data.occurredOn)),
          amount: Number(args.data.amount),
          status: args.data.status,
          memo: args.data.memo ?? null,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        state.collectedTransactions.push(created);

        if (!args.select) {
          return created;
        }

        const postedJournalEntry = resolveJournalEntryByCollectedTransaction(
          created.id
        );

        return {
          ...(args.select.id ? { id: created.id } : {}),
          ...(args.select.occurredOn ? { occurredOn: created.occurredOn } : {}),
          ...(args.select.title ? { title: created.title } : {}),
          ...(args.select.amount ? { amount: created.amount } : {}),
          ...(args.select.status ? { status: created.status } : {}),
          ...(args.select.importBatchId
            ? { importBatchId: created.importBatchId }
            : {}),
          ...(args.select.matchedPlanItemId
            ? { matchedPlanItemId: created.matchedPlanItemId }
            : {}),
          ...(args.select.postedJournalEntry
            ? {
                postedJournalEntry: postedJournalEntry
                  ? {
                      ...(args.select.postedJournalEntry.select?.id
                        ? { id: postedJournalEntry.id }
                        : {}),
                      ...(args.select.postedJournalEntry.select?.entryNumber
                        ? { entryNumber: postedJournalEntry.entryNumber }
                        : {})
                    }
                  : null
              }
            : {}),
          ...(args.select.fundingAccount
            ? {
                fundingAccount: {
                  ...(args.select.fundingAccount.select?.name
                    ? { name: fundingAccount?.name ?? '' }
                    : {})
                }
              }
            : {}),
          ...(args.select.category
            ? {
                category: category
                  ? {
                      ...(args.select.category.select?.name
                        ? { name: category.name }
                        : {})
                    }
                  : null
              }
            : {}),
          ...(args.select.ledgerTransactionType
            ? {
                ledgerTransactionType: {
                  ...(args.select.ledgerTransactionType.select?.flowKind
                    ? {
                        flowKind:
                          ledgerTransactionType?.flowKind ??
                          LedgerTransactionFlowKind.EXPENSE
                      }
                    : {})
                }
              }
            : {})
        };
      },
      update: async (args: {
        where: { id: string };
        data: {
          status?: CollectedTransactionStatus;
        };
      }) => {
        const candidate = state.collectedTransactions.find(
          (item) => item.id === args.where.id
        );

        if (!candidate) {
          throw new Error('Collected transaction not found');
        }

        if (args.data.status) {
          candidate.status = args.data.status;
        }
        candidate.updatedAt = new Date();

        return candidate;
      }
    },
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
        where?: { tenantId?: string; ledgerId?: string };
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

          return matchesTenant && matchesLedger;
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
            create: Array<{
              lineNumber: number;
              accountSubjectId: string;
              fundingAccountId?: string;
              debitAmount: number;
              creditAmount: number;
              description?: string;
            }>;
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
          lines: args.data.lines.create.map((line, index) => ({
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
      }
    },

    journalLine: {
      findMany: async (args: {
        where?: {
          journalEntry?: {
            tenantId?: string;
            ledgerId?: string;
            periodId?: string;
            status?: 'POSTED' | 'REVERSED' | 'SUPERSEDED';
          };
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

        return entries.flatMap((entry) =>
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
      }
    },
    transaction: {
      findMany: async (args: {
        where?: { userId?: string; status?: TransactionStatus };
        include?: { account?: boolean; category?: boolean };
        select?: { type?: boolean; amountWon?: boolean };
        orderBy?: Array<{
          businessDate?: 'asc' | 'desc';
          createdAt?: 'asc' | 'desc';
        }>;
        take?: number;
      }) => {
        let items = state.transactions.filter((candidate) => {
          const matchesUser =
            !args.where?.userId || candidate.userId === args.where.userId;
          const matchesStatus =
            !args.where?.status || candidate.status === args.where.status;
          return matchesUser && matchesStatus;
        });

        items = sortTransactions(items);

        if (args.take !== undefined) {
          items = items.slice(0, args.take);
        }

        return items.map((candidate) => {
          if (args.select) {
            return {
              ...(args.select.type ? { type: candidate.type } : {}),
              ...(args.select.amountWon
                ? { amountWon: candidate.amountWon }
                : {})
            };
          }

          const account = resolveAccount(candidate.accountId);
          const category = resolveCategory(candidate.categoryId);

          if (args.include) {
            return {
              ...candidate,
              account: args.include.account ? account : undefined,
              category: args.include.category ? category : undefined
            };
          }

          return candidate;
        });
      },
      create: async (args: { data: Record<string, unknown> }) => {
        const account = resolveAccount(String(args.data.accountId));
        const category = resolveCategory(String(args.data.categoryId));
        const created = {
          id: `txn-${state.transactions.length + 1}`,
          userId: String(args.data.userId),
          title: String(args.data.title),
          type: args.data.type as TransactionType,
          amountWon: Number(args.data.amountWon),
          businessDate: new Date(String(args.data.businessDate)),
          accountId: String(args.data.accountId),
          categoryId: String(args.data.categoryId),
          memo: args.data.memo === undefined ? null : String(args.data.memo),
          origin: args.data.origin as TransactionOrigin,
          status: args.data.status as TransactionStatus,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        state.transactions.push(created);
        return {
          ...created,
          account,
          category
        };
      }
    },
    recurringRule: {
      findMany: async (args: {
        where?: {
          userId?: string;
          tenantId?: string;
          ledgerId?: string;
          isActive?: boolean;
        };
        include?: { account?: boolean; category?: boolean };
        select?: { amountWon?: boolean };
        orderBy?: Array<{
          isActive?: 'asc' | 'desc';
          nextRunDate?: 'asc' | 'desc';
        }>;
      }) => {
        let items = state.recurringRules.filter((candidate) => {
          const matchesUser =
            !args.where?.userId || candidate.userId === args.where.userId;
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;
          const matchesActive =
            args.where?.isActive === undefined ||
            candidate.isActive === args.where.isActive;
          return matchesUser && matchesTenant && matchesLedger && matchesActive;
        });

        items = sortRecurringRules(items);

        return items.map((candidate) => {
          if (args.select) {
            return {
              ...(args.select.amountWon
                ? { amountWon: candidate.amountWon }
                : {})
            };
          }

          const account = resolveAccount(candidate.accountId);
          const category = resolveCategory(candidate.categoryId);

          if (args.include) {
            return {
              ...candidate,
              account: args.include.account ? account : undefined,
              category: args.include.category ? category : undefined
            };
          }

          return candidate;
        });
      },
      create: async (args: { data: Record<string, unknown> }) => {
        const account = resolveAccount(String(args.data.accountId));
        const category = resolveCategory(String(args.data.categoryId));
        const created = {
          id: `rr-${state.recurringRules.length + 1}`,
          userId: String(args.data.userId),
          tenantId: String(args.data.tenantId),
          ledgerId: String(args.data.ledgerId),
          accountId: String(args.data.accountId),
          categoryId: String(args.data.categoryId),
          title: String(args.data.title),
          amountWon: Number(args.data.amountWon),
          frequency: args.data.frequency as RecurrenceFrequency,
          dayOfMonth: Number(args.data.dayOfMonth),
          startDate: new Date(String(args.data.startDate)),
          endDate:
            args.data.endDate === undefined || args.data.endDate === null
              ? null
              : new Date(String(args.data.endDate)),
          isActive: Boolean(args.data.isActive),
          nextRunDate: new Date(String(args.data.nextRunDate)),
          createdAt: new Date(),
          updatedAt: new Date()
        };
        state.recurringRules.push(created);
        return {
          ...created,
          account,
          category
        };
      }
    },
    insurancePolicy: {
      findMany: async (args: {
        where?: { userId?: string; isActive?: boolean };
        select?: { monthlyPremiumWon?: boolean };
      }) => {
        const items = state.insurancePolicies.filter((candidate) => {
          const matchesUser =
            !args.where?.userId || candidate.userId === args.where.userId;
          const matchesActive =
            args.where?.isActive === undefined ||
            candidate.isActive === args.where.isActive;
          return matchesUser && matchesActive;
        });

        if (args.select?.monthlyPremiumWon) {
          return items.map((candidate) => ({
            monthlyPremiumWon: candidate.monthlyPremiumWon
          }));
        }

        return items;
      }
    },
    vehicle: {
      findMany: async (args: {
        where?: { userId?: string };
        select?: { monthlyExpenseWon?: boolean };
      }) => {
        const items = state.vehicles.filter(
          (candidate) =>
            !args.where?.userId || candidate.userId === args.where.userId
        );

        if (args.select?.monthlyExpenseWon) {
          return items.map((candidate) => ({
            monthlyExpenseWon: candidate.monthlyExpenseWon
          }));
        }

        return items;
      }
    }
  };
}
