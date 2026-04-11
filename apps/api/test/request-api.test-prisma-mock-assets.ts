import type { RequestPrismaMockContext } from './request-api.test-prisma-mock-shared';
import type { RequestTestState } from './request-api.test-types';

export function createAssetsPrismaMock(
  context: RequestPrismaMockContext
): Record<string, unknown> {
  const { state, resolveAccount, resolveCategory } = context;

  const projectInsurancePolicy = (
    candidate: RequestTestState['insurancePolicies'][number],
    include?: { account?: boolean; category?: boolean }
  ) => {
    const account = candidate.accountId
      ? resolveAccount(candidate.accountId)
      : null;
    const category = candidate.categoryId
      ? resolveCategory(candidate.categoryId)
      : null;

    return {
      ...candidate,
      ...(include
        ? {
            account: include.account ? account : undefined,
            category: include.category ? category : undefined
          }
        : {})
    };
  };

  return {
    insurancePolicy: {
      findFirst: async (args: {
        where?: {
          id?: string;
          userId?: string;
          tenantId?: string;
          ledgerId?: string;
          isActive?: boolean;
        };
        include?: { account?: boolean; category?: boolean };
      }) => {
        const candidate =
          state.insurancePolicies.find((item) => {
            const matchesId = !args.where?.id || item.id === args.where.id;
            const matchesUser =
              !args.where?.userId || item.userId === args.where.userId;
            const matchesTenant =
              !args.where?.tenantId || item.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where?.ledgerId || item.ledgerId === args.where.ledgerId;
            const matchesActive =
              args.where?.isActive === undefined ||
              item.isActive === args.where.isActive;

            return (
              matchesId &&
              matchesUser &&
              matchesTenant &&
              matchesLedger &&
              matchesActive
            );
          }) ?? null;

        if (!candidate) {
          return null;
        }

        return projectInsurancePolicy(candidate, args.include);
      },
      findMany: async (args: {
        where?: {
          userId?: string;
          tenantId?: string;
          ledgerId?: string;
          isActive?: boolean;
        };
        orderBy?: Array<{
          isActive?: 'asc' | 'desc';
          paymentDay?: 'asc' | 'desc';
          provider?: 'asc' | 'desc';
          productName?: 'asc' | 'desc';
        }>;
        select?: { monthlyPremiumWon?: boolean };
        include?: { account?: boolean; category?: boolean };
      }) => {
        const items = state.insurancePolicies
          .filter((candidate) => {
            const matchesUser =
              !args.where?.userId || candidate.userId === args.where.userId;
            const matchesTenant =
              !args.where?.tenantId ||
              candidate.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where?.ledgerId ||
              candidate.ledgerId === args.where.ledgerId;
            const matchesActive =
              args.where?.isActive === undefined ||
              candidate.isActive === args.where.isActive;
            return (
              matchesUser && matchesTenant && matchesLedger && matchesActive
            );
          })
          .sort((left, right) => {
            for (const order of args.orderBy ?? []) {
              if (order.isActive) {
                const activeDiff =
                  Number(right.isActive) - Number(left.isActive);
                if (activeDiff !== 0) {
                  return order.isActive === 'asc' ? -activeDiff : activeDiff;
                }
              }

              if (order.paymentDay) {
                const paymentDayDiff = left.paymentDay - right.paymentDay;
                if (paymentDayDiff !== 0) {
                  return order.paymentDay === 'asc'
                    ? paymentDayDiff
                    : -paymentDayDiff;
                }
              }

              if (order.provider) {
                const providerDiff = left.provider.localeCompare(
                  right.provider
                );
                if (providerDiff !== 0) {
                  return order.provider === 'asc'
                    ? providerDiff
                    : -providerDiff;
                }
              }

              if (order.productName) {
                const productNameDiff = left.productName.localeCompare(
                  right.productName
                );
                if (productNameDiff !== 0) {
                  return order.productName === 'asc'
                    ? productNameDiff
                    : -productNameDiff;
                }
              }
            }

            if (left.isActive !== right.isActive) {
              return Number(right.isActive) - Number(left.isActive);
            }

            const paymentDayDiff = left.paymentDay - right.paymentDay;
            if (paymentDayDiff !== 0) {
              return paymentDayDiff;
            }

            const providerDiff = left.provider.localeCompare(right.provider);
            if (providerDiff !== 0) {
              return providerDiff;
            }

            return left.productName.localeCompare(right.productName);
          });

        if (args.select?.monthlyPremiumWon) {
          return items.map((candidate) => ({
            monthlyPremiumWon: candidate.monthlyPremiumWon
          }));
        }

        return items.map((candidate) =>
          projectInsurancePolicy(candidate, args.include)
        );
      },
      create: async (args: {
        data: {
          userId: string;
          tenantId: string;
          ledgerId: string;
          accountId?: string | null;
          categoryId?: string | null;
          recurringStartDate?: string | Date | null;
          linkedRecurringRuleId?: string | null;
          provider: string;
          productName: string;
          monthlyPremiumWon: number;
          paymentDay: number;
          cycle: 'MONTHLY' | 'YEARLY';
          renewalDate?: string | Date | null;
          maturityDate?: string | Date | null;
          isActive?: boolean;
        };
        include?: { account?: boolean; category?: boolean };
      }) => {
        const created = {
          id: `policy-generated-${state.insurancePolicies.length + 1}`,
          userId: args.data.userId,
          tenantId: args.data.tenantId,
          ledgerId: args.data.ledgerId,
          accountId: args.data.accountId ?? null,
          categoryId: args.data.categoryId ?? null,
          recurringStartDate: args.data.recurringStartDate
            ? new Date(String(args.data.recurringStartDate))
            : null,
          linkedRecurringRuleId: args.data.linkedRecurringRuleId ?? null,
          provider: args.data.provider,
          productName: args.data.productName,
          monthlyPremiumWon: Number(args.data.monthlyPremiumWon),
          paymentDay: Number(args.data.paymentDay),
          cycle: args.data.cycle,
          renewalDate: args.data.renewalDate
            ? new Date(String(args.data.renewalDate))
            : null,
          maturityDate: args.data.maturityDate
            ? new Date(String(args.data.maturityDate))
            : null,
          isActive: args.data.isActive ?? true
        };

        state.insurancePolicies.push(created);
        return projectInsurancePolicy(created, args.include);
      },
      update: async (args: {
        where: { id: string };
        data: {
          accountId?: string | null;
          categoryId?: string | null;
          recurringStartDate?: string | Date | null;
          linkedRecurringRuleId?: string | null;
          provider?: string;
          productName?: string;
          monthlyPremiumWon?: number;
          paymentDay?: number;
          cycle?: 'MONTHLY' | 'YEARLY';
          renewalDate?: string | Date | null;
          maturityDate?: string | Date | null;
          isActive?: boolean;
        };
        include?: { account?: boolean; category?: boolean };
      }) => {
        const insurancePolicy = state.insurancePolicies.find(
          (candidate) => candidate.id === args.where.id
        );

        if (!insurancePolicy) {
          throw new Error('Insurance policy not found');
        }

        if ('accountId' in args.data) {
          insurancePolicy.accountId = args.data.accountId ?? null;
        }
        if ('categoryId' in args.data) {
          insurancePolicy.categoryId = args.data.categoryId ?? null;
        }
        if ('recurringStartDate' in args.data) {
          insurancePolicy.recurringStartDate = args.data.recurringStartDate
            ? new Date(String(args.data.recurringStartDate))
            : null;
        }
        if ('linkedRecurringRuleId' in args.data) {
          insurancePolicy.linkedRecurringRuleId =
            args.data.linkedRecurringRuleId ?? null;
        }
        if (args.data.provider !== undefined) {
          insurancePolicy.provider = args.data.provider;
        }
        if (args.data.productName !== undefined) {
          insurancePolicy.productName = args.data.productName;
        }
        if (args.data.monthlyPremiumWon !== undefined) {
          insurancePolicy.monthlyPremiumWon = Number(
            args.data.monthlyPremiumWon
          );
        }
        if (args.data.paymentDay !== undefined) {
          insurancePolicy.paymentDay = Number(args.data.paymentDay);
        }
        if (args.data.cycle !== undefined) {
          insurancePolicy.cycle = args.data.cycle;
        }
        if ('renewalDate' in args.data) {
          insurancePolicy.renewalDate = args.data.renewalDate
            ? new Date(String(args.data.renewalDate))
            : null;
        }
        if ('maturityDate' in args.data) {
          insurancePolicy.maturityDate = args.data.maturityDate
            ? new Date(String(args.data.maturityDate))
            : null;
        }
        if (args.data.isActive !== undefined) {
          insurancePolicy.isActive = args.data.isActive;
        }

        return projectInsurancePolicy(insurancePolicy, args.include);
      },
      deleteMany: async (args: {
        where?: {
          id?: string;
          tenantId?: string;
          ledgerId?: string;
        };
      }) => {
        const deletedIds = state.insurancePolicies
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
          .map((candidate) => candidate.id);

        if (deletedIds.length === 0) {
          return { count: 0 };
        }

        state.insurancePolicies = state.insurancePolicies.filter(
          (candidate) => !deletedIds.includes(candidate.id)
        );

        return {
          count: deletedIds.length
        };
      }
    },
    vehicle: {
      findFirst: async (args: {
        where?: {
          id?: string;
          userId?: string;
          tenantId?: string;
          ledgerId?: string;
        };
      }) => {
        const candidate =
          state.vehicles.find((item) => {
            const matchesId = !args.where?.id || item.id === args.where.id;
            const matchesUser =
              !args.where?.userId || item.userId === args.where.userId;
            const matchesTenant =
              !args.where?.tenantId || item.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where?.ledgerId || item.ledgerId === args.where.ledgerId;

            return matchesId && matchesUser && matchesTenant && matchesLedger;
          }) ?? null;

        if (!candidate) {
          return null;
        }

        return candidate;
      },
      findMany: async (args: {
        where?: {
          userId?: string;
          tenantId?: string;
          ledgerId?: string;
        };
        select?: { monthlyExpenseWon?: boolean };
      }) => {
        const items = state.vehicles.filter((candidate) => {
          const matchesUser =
            !args.where?.userId || candidate.userId === args.where.userId;
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;

          return matchesUser && matchesTenant && matchesLedger;
        });

        if (args.select?.monthlyExpenseWon) {
          return items.map((candidate) => ({
            monthlyExpenseWon: candidate.monthlyExpenseWon
          }));
        }

        return items;
      },
      create: async (args: {
        data: {
          userId: string;
          tenantId: string;
          ledgerId: string;
          name: string;
          manufacturer?: string | null;
          fuelType: 'GASOLINE' | 'DIESEL' | 'LPG' | 'HYBRID' | 'ELECTRIC';
          initialOdometerKm: number;
          monthlyExpenseWon: number;
          estimatedFuelEfficiencyKmPerLiter?: number | null;
        };
      }) => {
        const created = {
          id: `vehicle-generated-${state.vehicles.length + 1}`,
          userId: args.data.userId,
          tenantId: args.data.tenantId,
          ledgerId: args.data.ledgerId,
          name: args.data.name,
          manufacturer: args.data.manufacturer ?? null,
          fuelType: args.data.fuelType,
          initialOdometerKm: Number(args.data.initialOdometerKm),
          monthlyExpenseWon: Number(args.data.monthlyExpenseWon),
          estimatedFuelEfficiencyKmPerLiter:
            args.data.estimatedFuelEfficiencyKmPerLiter ?? null,
          createdAt: new Date(),
          fuelLogs: []
        };

        state.vehicles.push(created);

        return created;
      },
      update: async (args: {
        where: { id: string };
        data: {
          name?: string;
          manufacturer?: string | null;
          fuelType?: 'GASOLINE' | 'DIESEL' | 'LPG' | 'HYBRID' | 'ELECTRIC';
          initialOdometerKm?: number;
          monthlyExpenseWon?: number;
          estimatedFuelEfficiencyKmPerLiter?: number | null;
        };
      }) => {
        const vehicle = state.vehicles.find(
          (candidate) => candidate.id === args.where.id
        );

        if (!vehicle) {
          throw new Error('Vehicle not found');
        }

        if (args.data.name !== undefined) {
          vehicle.name = args.data.name;
        }
        if ('manufacturer' in args.data) {
          vehicle.manufacturer = args.data.manufacturer ?? null;
        }
        if (args.data.fuelType !== undefined) {
          vehicle.fuelType = args.data.fuelType;
        }
        if (args.data.initialOdometerKm !== undefined) {
          vehicle.initialOdometerKm = Number(args.data.initialOdometerKm);
        }
        if (args.data.monthlyExpenseWon !== undefined) {
          vehicle.monthlyExpenseWon = Number(args.data.monthlyExpenseWon);
        }
        if ('estimatedFuelEfficiencyKmPerLiter' in args.data) {
          vehicle.estimatedFuelEfficiencyKmPerLiter =
            args.data.estimatedFuelEfficiencyKmPerLiter ?? null;
        }

        return vehicle;
      }
    },
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
            : candidate.vehicle
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
              : candidate.vehicle
          }));
      },
      create: async (args: {
        data: {
          vehicleId: string;
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
            : vehicle
        };
      },
      update: async (args: {
        where: { id: string };
        data: {
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
            : vehicle
        };
      }
    },
    vehicleMaintenanceLog: {
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
        };
      }) => {
        const candidate =
          state.vehicleMaintenanceLogs.find((item) => {
            const matchesId = !args.where?.id || item.id === args.where.id;
            const matchesVehicleId =
              !args.where?.vehicleId || item.vehicleId === args.where.vehicleId;
            const vehicle =
              state.vehicles.find(
                (vehicleCandidate) => vehicleCandidate.id === item.vehicleId
              ) ?? null;
            const matchesTenant =
              !args.where?.vehicle?.is?.tenantId ||
              vehicle?.tenantId === args.where.vehicle.is.tenantId;
            const matchesLedger =
              !args.where?.vehicle?.is?.ledgerId ||
              vehicle?.ledgerId === args.where.vehicle.is.ledgerId;

            return (
              matchesId && matchesVehicleId && matchesTenant && matchesLedger
            );
          }) ?? null;

        if (!candidate) {
          return null;
        }

        const vehicle =
          state.vehicles.find(
            (vehicleCandidate) => vehicleCandidate.id === candidate.vehicleId
          ) ?? null;

        return {
          ...candidate,
          vehicle:
            args.include?.vehicle && vehicle
              ? {
                  ...(args.include.vehicle.select?.id
                    ? { id: vehicle.id }
                    : {}),
                  ...(args.include.vehicle.select?.name
                    ? { name: vehicle.name }
                    : {})
                }
              : vehicle
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
        };
        orderBy?: Array<{
          performedOn?: 'asc' | 'desc';
          createdAt?: 'asc' | 'desc';
        }>;
      }) => {
        return [...state.vehicleMaintenanceLogs]
          .filter((candidate) => {
            const matchesVehicleId =
              !args.where?.vehicleId ||
              candidate.vehicleId === args.where.vehicleId;
            const vehicle =
              state.vehicles.find(
                (vehicleCandidate) =>
                  vehicleCandidate.id === candidate.vehicleId
              ) ?? null;
            const matchesTenant =
              !args.where?.vehicle?.is?.tenantId ||
              vehicle?.tenantId === args.where.vehicle.is.tenantId;
            const matchesLedger =
              !args.where?.vehicle?.is?.ledgerId ||
              vehicle?.ledgerId === args.where.vehicle.is.ledgerId;

            return matchesVehicleId && matchesTenant && matchesLedger;
          })
          .sort((left, right) => {
            for (const order of args.orderBy ?? []) {
              if (order.performedOn) {
                const diff =
                  left.performedOn.getTime() - right.performedOn.getTime();
                if (diff !== 0) {
                  return order.performedOn === 'asc' ? diff : -diff;
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

            return right.performedOn.getTime() - left.performedOn.getTime();
          })
          .map((candidate) => {
            const vehicle =
              state.vehicles.find(
                (vehicleCandidate) =>
                  vehicleCandidate.id === candidate.vehicleId
              ) ?? null;

            return {
              ...candidate,
              vehicle:
                args.include?.vehicle && vehicle
                  ? {
                      ...(args.include.vehicle.select?.id
                        ? { id: vehicle.id }
                        : {}),
                      ...(args.include.vehicle.select?.name
                        ? { name: vehicle.name }
                        : {})
                    }
                  : vehicle
            };
          });
      },
      create: async (args: {
        data: {
          vehicleId: string;
          performedOn: Date;
          odometerKm: number;
          category:
            | 'INSPECTION'
            | 'REPAIR'
            | 'CONSUMABLE'
            | 'TIRE'
            | 'ACCIDENT'
            | 'OTHER';
          vendor?: string | null;
          description: string;
          amountWon: number;
          memo?: string | null;
        };
        include?: {
          vehicle?: {
            select?: {
              id?: boolean;
              name?: boolean;
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
          id: `maintenance-generated-${state.vehicleMaintenanceLogs.length + 1}`,
          vehicleId: args.data.vehicleId,
          performedOn: new Date(String(args.data.performedOn)),
          odometerKm: Number(args.data.odometerKm),
          category: args.data.category,
          vendor: args.data.vendor ?? null,
          description: args.data.description,
          amountWon: Number(args.data.amountWon),
          memo: args.data.memo ?? null,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        state.vehicleMaintenanceLogs.push(created);

        return {
          ...created,
          vehicle: args.include?.vehicle
            ? {
                ...(args.include.vehicle.select?.id ? { id: vehicle.id } : {}),
                ...(args.include.vehicle.select?.name
                  ? { name: vehicle.name }
                  : {})
              }
            : vehicle
        };
      },
      update: async (args: {
        where: { id: string };
        data: {
          performedOn?: Date;
          odometerKm?: number;
          category?:
            | 'INSPECTION'
            | 'REPAIR'
            | 'CONSUMABLE'
            | 'TIRE'
            | 'ACCIDENT'
            | 'OTHER';
          vendor?: string | null;
          description?: string;
          amountWon?: number;
          memo?: string | null;
        };
        include?: {
          vehicle?: {
            select?: {
              id?: boolean;
              name?: boolean;
            };
          };
        };
      }) => {
        const maintenanceLog = state.vehicleMaintenanceLogs.find(
          (candidate) => candidate.id === args.where.id
        );

        if (!maintenanceLog) {
          throw new Error('Vehicle maintenance log not found');
        }

        if (args.data.performedOn !== undefined) {
          maintenanceLog.performedOn = new Date(String(args.data.performedOn));
        }
        if (args.data.odometerKm !== undefined) {
          maintenanceLog.odometerKm = Number(args.data.odometerKm);
        }
        if (args.data.category !== undefined) {
          maintenanceLog.category = args.data.category;
        }
        if ('vendor' in args.data) {
          maintenanceLog.vendor = args.data.vendor ?? null;
        }
        if (args.data.description !== undefined) {
          maintenanceLog.description = args.data.description;
        }
        if (args.data.amountWon !== undefined) {
          maintenanceLog.amountWon = Number(args.data.amountWon);
        }
        if ('memo' in args.data) {
          maintenanceLog.memo = args.data.memo ?? null;
        }
        maintenanceLog.updatedAt = new Date();

        const vehicle =
          state.vehicles.find(
            (candidate) => candidate.id === maintenanceLog.vehicleId
          ) ?? null;

        return {
          ...maintenanceLog,
          vehicle:
            args.include?.vehicle && vehicle
              ? {
                  ...(args.include.vehicle.select?.id
                    ? { id: vehicle.id }
                    : {}),
                  ...(args.include.vehicle.select?.name
                    ? { name: vehicle.name }
                    : {})
                }
              : vehicle
        };
      }
    }
  };
}
