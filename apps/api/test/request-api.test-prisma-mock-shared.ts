import type {
  RequestTestState,
  RequestTestUser
} from './request-api.test-types';

export function createRequestPrismaMockContext(state: RequestTestState) {
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
          const matchedPlanItem =
            createdCollectedTransaction?.matchedPlanItemId != null
              ? findPlanItem(createdCollectedTransaction.matchedPlanItemId)
              : null;
          const category =
            createdCollectedTransaction?.categoryId != null
              ? resolveCategory(createdCollectedTransaction.categoryId)
              : null;
          const ledgerTransactionType =
            createdCollectedTransaction?.ledgerTransactionTypeId != null
              ? resolveLedgerTransactionType(
                  createdCollectedTransaction.ledgerTransactionTypeId
                )
              : null;

          return createdCollectedTransaction
            ? {
                id: createdCollectedTransaction.id,
                title: createdCollectedTransaction.title,
                status: createdCollectedTransaction.status,
                matchedPlanItem: matchedPlanItem
                  ? {
                      id: matchedPlanItem.id,
                      title: matchedPlanItem.title
                    }
                  : null,
                ledgerTransactionType: ledgerTransactionType
                  ? {
                      flowKind: ledgerTransactionType.flowKind
                    }
                  : null,
                category: category
                  ? {
                      id: category.id,
                      name: category.name
                    }
                  : null
              }
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
          passwordHash?: boolean;
          status?: boolean;
          lockedReason?: boolean;
          lockedAt?: boolean;
          isSystemAdmin?: boolean;
          emailVerifiedAt?: boolean;
          createdAt?: boolean;
          settings?: {
            select?: {
              minimumReserveWon?: boolean;
              monthlySinkingFundWon?: boolean;
              timezone?: boolean;
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

    if (select.passwordHash) {
      projected.passwordHash = user.passwordHash;
    }

    if (select.status) {
      projected.status = user.status ?? 'ACTIVE';
    }

    if (select.lockedReason) {
      projected.lockedReason = user.lockedReason ?? null;
    }

    if (select.lockedAt) {
      projected.lockedAt = user.lockedAt ?? null;
    }

    if (select.isSystemAdmin) {
      projected.isSystemAdmin = Boolean(user.isSystemAdmin);
    }

    if (select.emailVerifiedAt) {
      projected.emailVerifiedAt = user.emailVerifiedAt;
    }

    if (select.createdAt) {
      projected.createdAt = user.createdAt;
    }

    if (select.settings) {
      projected.settings = user.settings
        ? {
            minimumReserveWon: select.settings.select?.minimumReserveWon
              ? user.settings.minimumReserveWon
              : undefined,
            monthlySinkingFundWon: select.settings.select?.monthlySinkingFundWon
              ? user.settings.monthlySinkingFundWon
              : undefined,
            timezone: select.settings.select?.timezone
              ? user.settings.timezone
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
    state,
    sortCollectedTransactions,
    sortRecurringRules,
    sortAccountingPeriods,
    findUser,
    findTenant,
    findLedger,
    findAccountingPeriod,
    findOpeningBalanceSnapshot,
    findClosingSnapshot,
    findCarryForwardRecord,
    findImportBatch,
    findPlanItem,
    findCollectedTransactionByImportedRowId,
    resolveImportedRows,
    projectImportBatch,
    projectUser,
    resolveAccount,
    resolveCategory,
    resolveLedgerTransactionType,
    resolveAccountSubject,
    resolveJournalEntry,
    resolveJournalEntryByCollectedTransaction,
    projectJournalEntry
  };
}

export type RequestPrismaMockContext = ReturnType<
  typeof createRequestPrismaMockContext
>;
