import type { RequestPrismaMockContext } from './request-api.test-prisma-mock-shared';

export function createVehicleMaintenanceLogsPrismaMock(
  context: RequestPrismaMockContext
): Record<string, unknown> {
  const { state } = context;

  return {
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
