import { Injectable } from '@nestjs/common';
import type {
  CreateVehicleRequest,
  CreateVehicleMaintenanceLogRequest,
  UpdateVehicleRequest
} from '@personal-erp/contracts';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class VehiclesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllInWorkspace(tenantId: string, ledgerId: string) {
    return this.prisma.vehicle.findMany({
      where: { tenantId, ledgerId },
      include: { fuelLogs: { orderBy: { filledOn: 'asc' } } },
      orderBy: [{ createdAt: 'asc' }, { name: 'asc' }]
    });
  }

  findByIdInWorkspace(vehicleId: string, tenantId: string, ledgerId: string) {
    return this.prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        tenantId,
        ledgerId
      },
      include: {
        fuelLogs: { orderBy: { filledOn: 'asc' } }
      }
    });
  }

  createInWorkspace(
    userId: string,
    tenantId: string,
    ledgerId: string,
    input: CreateVehicleRequest
  ) {
    return this.prisma.vehicle.create({
      data: {
        userId,
        tenantId,
        ledgerId,
        name: input.name,
        manufacturer: input.manufacturer,
        fuelType: input.fuelType,
        initialOdometerKm: input.initialOdometerKm,
        monthlyExpenseWon: input.monthlyExpenseWon,
        estimatedFuelEfficiencyKmPerLiter:
          input.estimatedFuelEfficiencyKmPerLiter
      },
      include: {
        fuelLogs: { orderBy: { filledOn: 'asc' } }
      }
    });
  }

  updateInWorkspace(vehicleId: string, input: UpdateVehicleRequest) {
    return this.prisma.vehicle.update({
      where: {
        id: vehicleId
      },
      data: {
        name: input.name,
        manufacturer: input.manufacturer,
        fuelType: input.fuelType,
        initialOdometerKm: input.initialOdometerKm,
        monthlyExpenseWon: input.monthlyExpenseWon,
        estimatedFuelEfficiencyKmPerLiter:
          input.estimatedFuelEfficiencyKmPerLiter
      },
      include: {
        fuelLogs: { orderBy: { filledOn: 'asc' } }
      }
    });
  }

  findMaintenanceLogsInWorkspace(tenantId: string, ledgerId: string) {
    return this.prisma.vehicleMaintenanceLog.findMany({
      where: {
        vehicle: {
          is: {
            tenantId,
            ledgerId
          }
        }
      },
      include: {
        vehicle: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [{ performedOn: 'desc' }, { createdAt: 'desc' }]
    });
  }

  findMaintenanceLogInWorkspace(
    maintenanceLogId: string,
    vehicleId: string,
    tenantId: string,
    ledgerId: string
  ) {
    return this.prisma.vehicleMaintenanceLog.findFirst({
      where: {
        id: maintenanceLogId,
        vehicleId,
        vehicle: {
          is: {
            tenantId,
            ledgerId
          }
        }
      },
      include: {
        vehicle: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
  }

  createMaintenanceLogForVehicle(
    vehicleId: string,
    input: CreateVehicleMaintenanceLogRequest
  ) {
    return this.prisma.vehicleMaintenanceLog.create({
      data: {
        vehicleId,
        performedOn: new Date(`${input.performedOn}T00:00:00.000Z`),
        odometerKm: input.odometerKm,
        category: input.category,
        vendor: input.vendor,
        description: input.description,
        amountWon: input.amountWon,
        memo: input.memo
      },
      include: {
        vehicle: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
  }

  updateMaintenanceLog(
    maintenanceLogId: string,
    input: CreateVehicleMaintenanceLogRequest
  ) {
    return this.prisma.vehicleMaintenanceLog.update({
      where: {
        id: maintenanceLogId
      },
      data: {
        performedOn: new Date(`${input.performedOn}T00:00:00.000Z`),
        odometerKm: input.odometerKm,
        category: input.category,
        vendor: input.vendor,
        description: input.description,
        amountWon: input.amountWon,
        memo: input.memo
      },
      include: {
        vehicle: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
  }
}
