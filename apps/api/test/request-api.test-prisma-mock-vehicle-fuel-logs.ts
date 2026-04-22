import type { RequestPrismaMockContext } from './request-api.test-prisma-mock-shared';

export function createVehicleFuelLogsPrismaMock(
  context: RequestPrismaMockContext
): Record<string, unknown> {
  const { state } = context;

  return {
    fuelLog: {
      findFirst: async (args: {
        where?: {
          id?: string;
          vehicleId?: string;
          vehicle?: {
            is?: {
              tenantId?: string;
              ledgerId?: string;
            };
          };
        };
        include?: {
          vehicle?: {
            select?: {
              id?: boolean;
              name?: boolean;
            };
          };
          linkedCollectedTransaction?: {
            select?: {
              id?: boolean;
              fundingAccountId?: boolean;
              categoryId?: boolean;
              status?: boolean;
              matchedPlanItemId?: boolean;
              postedJournalEntry?: {
                select?: {
                  id?: boolean;
                  entryNumber?: boolean;
                };
              };
            };
          };
        };
      }) => {
        const candidate =
          state.vehicles
            .flatMap((vehicle) =>
              vehicle.fuelLogs.map((fuelLog) => ({
                ...fuelLog,
                vehicleId: vehicle.id,
                vehicle
              }))
            )
            .find((item) => {
              const matchesId = !args.where?.id || item.id === args.where.id;
              const matchesVehicleId =
                !args.where?.vehicleId ||
                item.vehicleId === args.where.vehicleId;
              const matchesTenant =
                !args.where?.vehicle?.is?.tenantId ||
                item.vehicle.tenantId === args.where.vehicle.is.tenantId;
              const matchesLedger =
                !args.where?.vehicle?.is?.ledgerId ||
                item.vehicle.ledgerId === args.where.vehicle.is.ledgerId;

              return (
                matchesId && matchesVehicleId && matchesTenant && matchesLedger
              );
            }) ?? null;

        if (!candidate) {
          return null;
        }

        return {
          ...candidate,
          vehicle: args.include?.vehicle
            ? {
                ...(args.include.vehicle.select?.id
                  ? { id: candidate.vehicle.id }
                  : {}),
                ...(args.include.vehicle.select?.name
                  ? { name: candidate.vehicle.name }
                  : {})
              }
            : candidate.vehicle,
          linkedCollectedTransaction: args.include?.linkedCollectedTransaction
            ? projectLinkedCollectedTransaction(
                state,
                candidate.linkedCollectedTransactionId ?? null,
                args.include.linkedCollectedTransaction.select
              )
            : undefined
        };
      },
      findMany: async (args: {
        where?: {
          vehicleId?: string;
          vehicle?: {
            is?: {
              tenantId?: string;
              ledgerId?: string;
            };
          };
        };
        include?: {
          vehicle?: {
            select?: {
              id?: boolean;
              name?: boolean;
            };
          };
          linkedCollectedTransaction?: {
            select?: {
              id?: boolean;
              fundingAccountId?: boolean;
              categoryId?: boolean;
              status?: boolean;
              matchedPlanItemId?: boolean;
              postedJournalEntry?: {
                select?: {
                  id?: boolean;
                  entryNumber?: boolean;
                };
              };
            };
          };
        };
        orderBy?: Array<{
          filledOn?: 'asc' | 'desc';
          createdAt?: 'asc' | 'desc';
        }>;
      }) => {
        return state.vehicles
          .flatMap((vehicle) =>
            vehicle.fuelLogs.map((fuelLog) => ({
              ...fuelLog,
              vehicleId: vehicle.id,
              createdAt: fuelLog.filledOn,
              updatedAt: fuelLog.filledOn,
              vehicle
            }))
          )
          .filter((candidate) => {
            const matchesVehicleId =
              !args.where?.vehicleId ||
              candidate.vehicleId === args.where.vehicleId;
            const matchesTenant =
              !args.where?.vehicle?.is?.tenantId ||
              candidate.vehicle.tenantId === args.where.vehicle.is.tenantId;
            const matchesLedger =
              !args.where?.vehicle?.is?.ledgerId ||
              candidate.vehicle.ledgerId === args.where.vehicle.is.ledgerId;

            return matchesVehicleId && matchesTenant && matchesLedger;
          })
          .sort((left, right) => {
            for (const order of args.orderBy ?? []) {
              if (order.filledOn) {
                const diff = left.filledOn.getTime() - right.filledOn.getTime();
                if (diff !== 0) {
                  return order.filledOn === 'asc' ? diff : -diff;
                }
              }

              if (order.createdAt) {
                const diff =
                  left.createdAt.getTime() - right.createdAt.getTime();
                if (diff !== 0) {
                  return order.createdAt === 'asc' ? diff : -diff;
                }
              }
            }

            return right.filledOn.getTime() - left.filledOn.getTime();
          })
          .map((candidate) => ({
            ...candidate,
            vehicle: args.include?.vehicle
              ? {
                  ...(args.include.vehicle.select?.id
                    ? { id: candidate.vehicle.id }
                    : {}),
                  ...(args.include.vehicle.select?.name
                    ? { name: candidate.vehicle.name }
                    : {})
                }
              : candidate.vehicle,
            linkedCollectedTransaction: args.include?.linkedCollectedTransaction
              ? projectLinkedCollectedTransaction(
                  state,
                  candidate.linkedCollectedTransactionId ?? null,
                  args.include.linkedCollectedTransaction.select
                )
              : undefined
          }));
      },
      create: async (args: {
        data: {
          vehicleId: string;
          linkedCollectedTransactionId?: string | null;
          filledOn: Date;
          odometerKm: number;
          liters: number;
          amountWon: number;
          unitPriceWon: number;
          isFullTank: boolean;
        };
        include?: {
          vehicle?: {
            select?: {
              id?: boolean;
              name?: boolean;
            };
          };
          linkedCollectedTransaction?: {
            select?: {
              id?: boolean;
              fundingAccountId?: boolean;
              categoryId?: boolean;
              status?: boolean;
              matchedPlanItemId?: boolean;
              postedJournalEntry?: {
                select?: {
                  id?: boolean;
                  entryNumber?: boolean;
                };
              };
            };
          };
        };
      }) => {
        const vehicle =
          state.vehicles.find(
            (candidate) => candidate.id === args.data.vehicleId
          ) ?? null;

        if (!vehicle) {
          throw new Error('Vehicle not found');
        }

        const created = {
          id: `fuel-generated-${vehicle.fuelLogs.length + 1}`,
          linkedCollectedTransactionId:
            args.data.linkedCollectedTransactionId ?? null,
          filledOn: new Date(String(args.data.filledOn)),
          odometerKm: Number(args.data.odometerKm),
          liters: Number(args.data.liters),
          amountWon: Number(args.data.amountWon),
          unitPriceWon: Number(args.data.unitPriceWon),
          isFullTank: args.data.isFullTank
        };

        vehicle.fuelLogs.push(created);

        return {
          ...created,
          vehicleId: vehicle.id,
          vehicle: args.include?.vehicle
            ? {
                ...(args.include.vehicle.select?.id ? { id: vehicle.id } : {}),
                ...(args.include.vehicle.select?.name
                  ? { name: vehicle.name }
                  : {})
              }
            : vehicle,
          linkedCollectedTransaction: args.include?.linkedCollectedTransaction
            ? projectLinkedCollectedTransaction(
                state,
                created.linkedCollectedTransactionId,
                args.include.linkedCollectedTransaction.select
              )
            : undefined
        };
      },
      update: async (args: {
        where: { id: string };
        data: {
          linkedCollectedTransactionId?: string | null;
          filledOn?: Date;
          odometerKm?: number;
          liters?: number;
          amountWon?: number;
          unitPriceWon?: number;
          isFullTank?: boolean;
        };
        include?: {
          vehicle?: {
            select?: {
              id?: boolean;
              name?: boolean;
            };
          };
          linkedCollectedTransaction?: {
            select?: {
              id?: boolean;
              fundingAccountId?: boolean;
              categoryId?: boolean;
              status?: boolean;
              matchedPlanItemId?: boolean;
              postedJournalEntry?: {
                select?: {
                  id?: boolean;
                  entryNumber?: boolean;
                };
              };
            };
          };
        };
      }) => {
        const vehicle =
          state.vehicles.find((candidate) =>
            candidate.fuelLogs.some((fuelLog) => fuelLog.id === args.where.id)
          ) ?? null;

        if (!vehicle) {
          throw new Error('Vehicle fuel log not found');
        }

        const fuelLog =
          vehicle.fuelLogs.find(
            (candidate) => candidate.id === args.where.id
          ) ?? null;

        if (!fuelLog) {
          throw new Error('Vehicle fuel log not found');
        }

        if ('linkedCollectedTransactionId' in args.data) {
          fuelLog.linkedCollectedTransactionId =
            args.data.linkedCollectedTransactionId ?? null;
        }
        if (args.data.filledOn !== undefined) {
          fuelLog.filledOn = new Date(String(args.data.filledOn));
        }
        if (args.data.odometerKm !== undefined) {
          fuelLog.odometerKm = Number(args.data.odometerKm);
        }
        if (args.data.liters !== undefined) {
          fuelLog.liters = Number(args.data.liters);
        }
        if (args.data.amountWon !== undefined) {
          fuelLog.amountWon = Number(args.data.amountWon);
        }
        if (args.data.unitPriceWon !== undefined) {
          fuelLog.unitPriceWon = Number(args.data.unitPriceWon);
        }
        if (args.data.isFullTank !== undefined) {
          fuelLog.isFullTank = args.data.isFullTank;
        }

        return {
          ...fuelLog,
          vehicleId: vehicle.id,
          vehicle: args.include?.vehicle
            ? {
                ...(args.include.vehicle.select?.id ? { id: vehicle.id } : {}),
                ...(args.include.vehicle.select?.name
                  ? { name: vehicle.name }
                  : {})
              }
            : vehicle,
          linkedCollectedTransaction: args.include?.linkedCollectedTransaction
            ? projectLinkedCollectedTransaction(
                state,
                fuelLog.linkedCollectedTransactionId ?? null,
                args.include.linkedCollectedTransaction.select
              )
            : undefined
        };
      },
      delete: async (args: { where: { id: string } }) => {
        const vehicle =
          state.vehicles.find((candidate) =>
            candidate.fuelLogs.some((fuelLog) => fuelLog.id === args.where.id)
          ) ?? null;

        if (!vehicle) {
          throw new Error('Vehicle fuel log not found');
        }

        const fuelLog =
          vehicle.fuelLogs.find(
            (candidate) => candidate.id === args.where.id
          ) ?? null;

        if (!fuelLog) {
          throw new Error('Vehicle fuel log not found');
        }

        vehicle.fuelLogs = vehicle.fuelLogs.filter(
          (candidate) => candidate.id !== args.where.id
        );

        return {
          ...fuelLog,
          vehicleId: vehicle.id
        };
      }
    }
  };
}

function projectLinkedCollectedTransaction(
  state: RequestPrismaMockContext['state'],
  collectedTransactionId: string | null,
  select:
    | {
        id?: boolean;
        fundingAccountId?: boolean;
        categoryId?: boolean;
        status?: boolean;
        matchedPlanItemId?: boolean;
        postedJournalEntry?: {
          select?: {
            id?: boolean;
            entryNumber?: boolean;
          };
        };
      }
    | undefined
) {
  if (!collectedTransactionId) {
    return null;
  }

  const collectedTransaction =
    state.collectedTransactions.find(
      (candidate) => candidate.id === collectedTransactionId
    ) ?? null;

  if (!collectedTransaction) {
    return null;
  }

  const postedJournalEntry =
    state.journalEntries.find(
      (candidate) =>
        candidate.sourceCollectedTransactionId === collectedTransaction.id
    ) ?? null;

  return {
    ...(select?.id ? { id: collectedTransaction.id } : {}),
    ...(select?.fundingAccountId
      ? { fundingAccountId: collectedTransaction.fundingAccountId }
      : {}),
    ...(select?.categoryId
      ? { categoryId: collectedTransaction.categoryId }
      : {}),
    ...(select?.status ? { status: collectedTransaction.status } : {}),
    ...(select?.matchedPlanItemId
      ? { matchedPlanItemId: collectedTransaction.matchedPlanItemId }
      : {}),
    ...(select?.postedJournalEntry
      ? {
          postedJournalEntry: postedJournalEntry
            ? {
                ...(select.postedJournalEntry.select?.id
                  ? { id: postedJournalEntry.id }
                  : {}),
                ...(select.postedJournalEntry.select?.entryNumber
                  ? { entryNumber: postedJournalEntry.entryNumber }
                  : {})
              }
            : null
        }
      : {})
  };
}
