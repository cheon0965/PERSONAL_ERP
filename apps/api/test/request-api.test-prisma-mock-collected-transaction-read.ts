import {
  CollectedTransactionStatus,
  LedgerTransactionFlowKind
} from '@prisma/client';
import type { RequestPrismaMockContext } from './request-api.test-prisma-mock-shared';

export function createCollectedTransactionReadMethods(
  context: RequestPrismaMockContext
): Record<string, unknown> {
  const {
    state,
    sortCollectedTransactions,
    findAccountingPeriod,
    findPlanItem,
    resolveAccount,
    resolveCategory,
    resolveLedgerTransactionType,
    resolveJournalEntryByCollectedTransaction
  } = context;

  return {
    count: async (args: {
      where?: {
        tenantId?: string;
        ledgerId?: string;
        periodId?: string | null;
        fundingAccountId?: string;
      };
    }) => {
      return state.collectedTransactions.filter((candidate) => {
        const matchesTenant =
          !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
        const matchesLedger =
          !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;
        const matchesPeriod =
          args.where?.periodId === undefined ||
          candidate.periodId === args.where.periodId;
        const matchesFundingAccount =
          !args.where?.fundingAccountId ||
          candidate.fundingAccountId === args.where.fundingAccountId;

        return (
          matchesTenant &&
          matchesLedger &&
          matchesPeriod &&
          matchesFundingAccount
        );
      }).length;
    },
    findUnique: async (args: {
      where: { id: string };
      select?: {
        tenantId?: boolean;
        ledgerId?: boolean;
      };
    }) => {
      const candidate =
        state.collectedTransactions.find((item) => item.id === args.where.id) ??
        null;

      if (!candidate) {
        return null;
      }

      if (!args.select) {
        return candidate;
      }

      return {
        ...(args.select.tenantId ? { tenantId: candidate.tenantId } : {}),
        ...(args.select.ledgerId ? { ledgerId: candidate.ledgerId } : {})
      };
    },
    findFirst: async (args: {
      where?: {
        id?: string;
        tenantId?: string;
        ledgerId?: string;
        periodId?: string | null;
        sourceFingerprint?: string | null;
      };
      select?: {
        id?: boolean;
        occurredOn?: boolean;
        title?: boolean;
        amount?: boolean;
        status?: boolean;
        importBatchId?: boolean;
        matchedPlanItemId?: boolean;
        matchedPlanItem?: {
          select?: {
            id?: boolean;
            title?: boolean;
          };
        };
        importedRow?: {
          select?: {
            id?: boolean;
            batchId?: boolean;
            rawPayload?: boolean;
          };
        };
        fundingAccountId?: boolean;
        categoryId?: boolean;
        memo?: boolean;
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
            flowKind?: boolean;
            postingPolicyKey?: boolean;
          };
        };
        postedJournalEntry?: {
          select?: {
            id?: boolean;
            entryNumber?: boolean;
          };
        };
        linkedFuelLog?: {
          select?: {
            id?: boolean;
            vehicle?: {
              select?: {
                id?: boolean;
                name?: boolean;
              };
            };
          };
        };
        linkedMaintenanceLog?: {
          select?: {
            id?: boolean;
            vehicle?: {
              select?: {
                id?: boolean;
                name?: boolean;
              };
            };
          };
        };
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
        importedRow?: {
          select?: {
            id?: boolean;
            batchId?: boolean;
            rawPayload?: boolean;
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
          const matchesPeriod =
            args.where?.periodId === undefined ||
            item.periodId === args.where.periodId;
          const matchesSourceFingerprint =
            args.where?.sourceFingerprint === undefined ||
            item.sourceFingerprint === args.where.sourceFingerprint;

          return (
            matchesId &&
            matchesTenant &&
            matchesLedger &&
            matchesPeriod &&
            matchesSourceFingerprint
          );
        }) ?? null;

      if (!candidate) {
        return null;
      }

      const period = candidate.periodId
        ? findAccountingPeriod(candidate.periodId)
        : null;
      const fundingAccount = resolveAccount(candidate.fundingAccountId);
      const category = candidate.categoryId
        ? resolveCategory(candidate.categoryId)
        : null;
      const ledgerTransactionType = resolveLedgerTransactionType(
        candidate.ledgerTransactionTypeId
      );
      const matchedPlanItem = candidate.matchedPlanItemId
        ? findPlanItem(candidate.matchedPlanItemId)
        : null;
      const importedRow = candidate.importedRowId
        ? (state.importedRows.find(
            (item) => item.id === candidate.importedRowId
          ) ?? null)
        : null;
      const postedJournalEntry = resolveJournalEntryByCollectedTransaction(
        candidate.id
      );
      const linkedFuelLog =
        state.vehicles
          .flatMap((vehicle) =>
            vehicle.fuelLogs.map((fuelLog) => ({
              id: fuelLog.id,
              vehicle: {
                id: vehicle.id,
                name: vehicle.name
              },
              linkedCollectedTransactionId:
                fuelLog.linkedCollectedTransactionId ?? null
            }))
          )
          .find(
            (fuelLog) => fuelLog.linkedCollectedTransactionId === candidate.id
          ) ?? null;
      const linkedMaintenanceLog =
        state.vehicleMaintenanceLogs.find(
          (maintenanceLog) =>
            (maintenanceLog.linkedCollectedTransactionId ?? null) ===
            candidate.id
        ) ?? null;
      const linkedMaintenanceVehicle = linkedMaintenanceLog
        ? (state.vehicles.find(
            (vehicle) => vehicle.id === linkedMaintenanceLog.vehicleId
          ) ?? null)
        : null;
      const postingPolicyKey =
        candidate.ledgerTransactionTypeId === 'ltt-1-income'
          ? 'INCOME_BASIC'
          : candidate.ledgerTransactionTypeId === 'ltt-1-transfer'
            ? 'TRANSFER_BASIC'
            : candidate.ledgerTransactionTypeId === 'ltt-1-adjustment'
              ? 'MANUAL_ADJUSTMENT'
              : 'EXPENSE_BASIC';

      if (args.select) {
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
          ...(args.select.matchedPlanItem
            ? {
                matchedPlanItem: matchedPlanItem
                  ? {
                      ...(args.select.matchedPlanItem.select?.id
                        ? { id: matchedPlanItem.id }
                        : {}),
                      ...(args.select.matchedPlanItem.select?.title
                        ? { title: matchedPlanItem.title }
                        : {})
                    }
                  : null
              }
            : {}),
          ...(args.select.importedRow
            ? {
                importedRow: importedRow
                  ? {
                      ...(args.select.importedRow.select?.id
                        ? { id: importedRow.id }
                        : {}),
                      ...(args.select.importedRow.select?.batchId
                        ? { batchId: importedRow.batchId }
                        : {}),
                      ...(args.select.importedRow.select?.rawPayload
                        ? { rawPayload: importedRow.rawPayload }
                        : {})
                    }
                  : null
              }
            : {}),
          ...(args.select.fundingAccountId
            ? { fundingAccountId: candidate.fundingAccountId }
            : {}),
          ...(args.select.categoryId
            ? { categoryId: candidate.categoryId }
            : {}),
          ...(args.select.memo ? { memo: candidate.memo } : {}),
          ...(args.select.period
            ? {
                period: period
                  ? {
                      ...(args.select.period.select?.id
                        ? { id: period.id }
                        : {}),
                      ...(args.select.period.select?.year
                        ? { year: period.year }
                        : {}),
                      ...(args.select.period.select?.month
                        ? { month: period.month }
                        : {}),
                      ...(args.select.period.select?.status
                        ? { status: period.status }
                        : {})
                    }
                  : null
              }
            : {}),
          ...(args.select.fundingAccount
            ? {
                fundingAccount: {
                  ...(args.select.fundingAccount.select?.id
                    ? { id: fundingAccount?.id ?? '' }
                    : {}),
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
                    : {}),
                  ...(args.select.ledgerTransactionType.select?.postingPolicyKey
                    ? { postingPolicyKey }
                    : {})
                }
              }
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
          ...(args.select.linkedFuelLog
            ? {
                linkedFuelLog: linkedFuelLog
                  ? {
                      ...(args.select.linkedFuelLog.select?.id
                        ? { id: linkedFuelLog.id }
                        : {}),
                      ...(args.select.linkedFuelLog.select?.vehicle
                        ? {
                            vehicle: {
                              ...(args.select.linkedFuelLog.select.vehicle
                                .select?.id
                                ? { id: linkedFuelLog.vehicle.id }
                                : {}),
                              ...(args.select.linkedFuelLog.select.vehicle
                                .select?.name
                                ? { name: linkedFuelLog.vehicle.name }
                                : {})
                            }
                          }
                        : {})
                    }
                  : null
              }
            : {}),
          ...(args.select.linkedMaintenanceLog
            ? {
                linkedMaintenanceLog: linkedMaintenanceLog
                  ? {
                      ...(args.select.linkedMaintenanceLog.select?.id
                        ? { id: linkedMaintenanceLog.id }
                        : {}),
                      ...(args.select.linkedMaintenanceLog.select?.vehicle
                        ? {
                            vehicle: {
                              ...(args.select.linkedMaintenanceLog.select
                                .vehicle.select?.id
                                ? { id: linkedMaintenanceVehicle?.id ?? '' }
                                : {}),
                              ...(args.select.linkedMaintenanceLog.select
                                .vehicle.select?.name
                                ? { name: linkedMaintenanceVehicle?.name ?? '' }
                                : {})
                            }
                          }
                        : {})
                    }
                  : null
              }
            : {})
        };
      }

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
                ...(args.include.ledgerTransactionType.select?.postingPolicyKey
                  ? { postingPolicyKey }
                  : {})
              }
            }
          : {}),
        ...(args.include.importedRow
          ? {
              importedRow: importedRow
                ? {
                    ...(args.include.importedRow.select?.id
                      ? { id: importedRow.id }
                      : {}),
                    ...(args.include.importedRow.select?.batchId
                      ? { batchId: importedRow.batchId }
                      : {}),
                    ...(args.include.importedRow.select?.rawPayload
                      ? { rawPayload: importedRow.rawPayload }
                      : {})
                  }
                : null
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
      where?: {
        id?: { notIn?: string[] };
        tenantId?: string;
        ledgerId?: string;
        periodId?: string | null;
        importBatchId?: string | null;
        importedRowId?: string | null;
        sourceFingerprint?: string | null;
        occurredOn?: Date;
        amount?: number;
        ledgerTransactionTypeId?: string;
        fundingAccountId?: string;
        matchedPlanItemId?: {
          not?: null;
        };
        status?:
          | CollectedTransactionStatus
          | {
              in?: CollectedTransactionStatus[];
            };
      };
      select?: {
        id?: boolean;
        periodId?: boolean;
        occurredOn?: boolean;
        title?: boolean;
        amount?: boolean;
        status?: boolean;
        importBatchId?: boolean;
        importedRowId?: boolean;
        matchedPlanItemId?: boolean;
        matchedPlanItem?: {
          select?: {
            id?: boolean;
            title?: boolean;
          };
        };
        linkedFuelLog?: {
          select?: {
            id?: boolean;
            vehicle?: {
              select?: {
                id?: boolean;
                name?: boolean;
              };
            };
          };
        };
        linkedMaintenanceLog?: {
          select?: {
            id?: boolean;
            vehicle?: {
              select?: {
                id?: boolean;
                name?: boolean;
              };
            };
          };
        };
        fundingAccountId?: boolean;
        ledgerTransactionTypeId?: boolean;
        categoryId?: boolean;
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
        const matchesId =
          !args.where?.id?.notIn || !args.where.id.notIn.includes(candidate.id);
        const matchesTenant =
          !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
        const matchesLedger =
          !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;
        const matchesPeriod =
          args.where?.periodId === undefined ||
          candidate.periodId === args.where.periodId;
        const matchesImportBatch =
          args.where?.importBatchId === undefined ||
          candidate.importBatchId === args.where.importBatchId;
        const matchesImportedRow =
          args.where?.importedRowId === undefined ||
          candidate.importedRowId === args.where.importedRowId;
        const matchesSourceFingerprint =
          args.where?.sourceFingerprint === undefined ||
          candidate.sourceFingerprint === args.where.sourceFingerprint;
        const matchesOccurredOn =
          args.where?.occurredOn === undefined ||
          candidate.occurredOn.getTime() === args.where.occurredOn.getTime();
        const matchesAmount =
          args.where?.amount === undefined ||
          candidate.amount === args.where.amount;
        const matchesLedgerTransactionType =
          args.where?.ledgerTransactionTypeId === undefined ||
          candidate.ledgerTransactionTypeId ===
            args.where.ledgerTransactionTypeId;
        const matchesFundingAccount =
          args.where?.fundingAccountId === undefined ||
          candidate.fundingAccountId === args.where.fundingAccountId;
        const matchesMatchedPlanItem =
          args.where?.matchedPlanItemId?.not !== null ||
          candidate.matchedPlanItemId !== null;
        const statusFilter = args.where?.status;
        const matchesStatus =
          statusFilter === undefined
            ? true
            : typeof statusFilter === 'string'
              ? candidate.status === statusFilter
              : !statusFilter.in || statusFilter.in.includes(candidate.status);

        return (
          matchesId &&
          matchesTenant &&
          matchesLedger &&
          matchesPeriod &&
          matchesImportBatch &&
          matchesImportedRow &&
          matchesSourceFingerprint &&
          matchesOccurredOn &&
          matchesAmount &&
          matchesLedgerTransactionType &&
          matchesFundingAccount &&
          matchesMatchedPlanItem &&
          matchesStatus
        );
      });

      items = args.orderBy
        ? [...items].sort((left, right) => {
            for (const order of args.orderBy ?? []) {
              const direction = order.occurredOn ?? order.createdAt;
              const leftValue = order.occurredOn
                ? left.occurredOn.getTime()
                : left.createdAt.getTime();
              const rightValue = order.occurredOn
                ? right.occurredOn.getTime()
                : right.createdAt.getTime();

              if (leftValue !== rightValue) {
                return direction === 'asc'
                  ? leftValue - rightValue
                  : rightValue - leftValue;
              }
            }

            return 0;
          })
        : sortCollectedTransactions(items);

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
        const matchedPlanItem = candidate.matchedPlanItemId
          ? findPlanItem(candidate.matchedPlanItemId)
          : null;
        const postedJournalEntry = resolveJournalEntryByCollectedTransaction(
          candidate.id
        );
        const linkedFuelLog =
          state.vehicles
            .flatMap((vehicle) =>
              vehicle.fuelLogs.map((fuelLog) => ({
                id: fuelLog.id,
                vehicle: {
                  id: vehicle.id,
                  name: vehicle.name
                },
                linkedCollectedTransactionId:
                  fuelLog.linkedCollectedTransactionId ?? null
              }))
            )
            .find(
              (fuelLog) => fuelLog.linkedCollectedTransactionId === candidate.id
            ) ?? null;
        const linkedMaintenanceLog =
          state.vehicleMaintenanceLogs.find(
            (maintenanceLog) =>
              (maintenanceLog.linkedCollectedTransactionId ?? null) ===
              candidate.id
          ) ?? null;
        const linkedMaintenanceVehicle = linkedMaintenanceLog
          ? (state.vehicles.find(
              (vehicle) => vehicle.id === linkedMaintenanceLog.vehicleId
            ) ?? null)
          : null;

        if (!args.select) {
          return candidate;
        }

        return {
          ...(args.select.id ? { id: candidate.id } : {}),
          ...(args.select.periodId ? { periodId: candidate.periodId } : {}),
          ...(args.select.occurredOn
            ? { occurredOn: candidate.occurredOn }
            : {}),
          ...(args.select.title ? { title: candidate.title } : {}),
          ...(args.select.amount ? { amount: candidate.amount } : {}),
          ...(args.select.status ? { status: candidate.status } : {}),
          ...(args.select.importBatchId
            ? { importBatchId: candidate.importBatchId }
            : {}),
          ...(args.select.importedRowId
            ? { importedRowId: candidate.importedRowId }
            : {}),
          ...(args.select.matchedPlanItemId
            ? { matchedPlanItemId: candidate.matchedPlanItemId }
            : {}),
          ...(args.select.matchedPlanItem
            ? {
                matchedPlanItem: matchedPlanItem
                  ? {
                      ...(args.select.matchedPlanItem.select?.id
                        ? { id: matchedPlanItem.id }
                        : {}),
                      ...(args.select.matchedPlanItem.select?.title
                        ? { title: matchedPlanItem.title }
                        : {})
                    }
                  : null
              }
            : {}),
          ...(args.select.linkedFuelLog
            ? {
                linkedFuelLog: linkedFuelLog
                  ? {
                      ...(args.select.linkedFuelLog.select?.id
                        ? { id: linkedFuelLog.id }
                        : {}),
                      ...(args.select.linkedFuelLog.select?.vehicle
                        ? {
                            vehicle: {
                              ...(args.select.linkedFuelLog.select.vehicle
                                .select?.id
                                ? { id: linkedFuelLog.vehicle.id }
                                : {}),
                              ...(args.select.linkedFuelLog.select.vehicle
                                .select?.name
                                ? { name: linkedFuelLog.vehicle.name }
                                : {})
                            }
                          }
                        : {})
                    }
                  : null
              }
            : {}),
          ...(args.select.linkedMaintenanceLog
            ? {
                linkedMaintenanceLog: linkedMaintenanceLog
                  ? {
                      ...(args.select.linkedMaintenanceLog.select?.id
                        ? { id: linkedMaintenanceLog.id }
                        : {}),
                      ...(args.select.linkedMaintenanceLog.select?.vehicle
                        ? {
                            vehicle: {
                              ...(args.select.linkedMaintenanceLog.select
                                .vehicle.select?.id
                                ? { id: linkedMaintenanceVehicle?.id ?? '' }
                                : {}),
                              ...(args.select.linkedMaintenanceLog.select
                                .vehicle.select?.name
                                ? { name: linkedMaintenanceVehicle?.name ?? '' }
                                : {})
                            }
                          }
                        : {})
                    }
                  : null
              }
            : {}),
          ...(args.select.fundingAccountId
            ? { fundingAccountId: candidate.fundingAccountId }
            : {}),
          ...(args.select.ledgerTransactionTypeId
            ? { ledgerTransactionTypeId: candidate.ledgerTransactionTypeId }
            : {}),
          ...(args.select.categoryId
            ? { categoryId: candidate.categoryId }
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
    }
  };
}
