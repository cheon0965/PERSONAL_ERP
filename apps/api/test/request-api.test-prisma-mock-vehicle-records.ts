import type { RequestPrismaMockContext } from './request-api.test-prisma-mock-shared';

export function createVehicleRecordsPrismaMock(
  context: RequestPrismaMockContext
): Record<string, unknown> {
  const { state } = context;

  return {
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

        return items;
      },
      create: async (args: {
        data: {
          userId: string;
          tenantId: string;
          ledgerId: string;
          name: string;
          normalizedName?: string;
          manufacturer?: string | null;
          fuelType: 'GASOLINE' | 'DIESEL' | 'LPG' | 'HYBRID' | 'ELECTRIC';
          initialOdometerKm: number;
          estimatedFuelEfficiencyKmPerLiter?: number | null;
        };
      }) => {
        const created = {
          id: `vehicle-generated-${state.vehicles.length + 1}`,
          userId: args.data.userId,
          tenantId: args.data.tenantId,
          ledgerId: args.data.ledgerId,
          name: args.data.name,
          normalizedName: args.data.normalizedName,
          manufacturer: args.data.manufacturer ?? null,
          fuelType: args.data.fuelType,
          initialOdometerKm: Number(args.data.initialOdometerKm),
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
          normalizedName?: string;
          manufacturer?: string | null;
          fuelType?: 'GASOLINE' | 'DIESEL' | 'LPG' | 'HYBRID' | 'ELECTRIC';
          initialOdometerKm?: number;
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
        if (args.data.normalizedName !== undefined) {
          vehicle.normalizedName = args.data.normalizedName;
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
        if ('estimatedFuelEfficiencyKmPerLiter' in args.data) {
          vehicle.estimatedFuelEfficiencyKmPerLiter =
            args.data.estimatedFuelEfficiencyKmPerLiter ?? null;
        }

        return vehicle;
      }
    }
  };
}
