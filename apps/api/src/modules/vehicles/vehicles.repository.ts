import { Injectable } from '@nestjs/common';
import type {
  CreateVehicleRequest,
  CreateVehicleFuelLogRequest,
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
      orderBy: [{ createdAt: 'asc' }, { name: 'asc' }]
    });
  }

  findByIdInWorkspace(vehicleId: string, tenantId: string, ledgerId: string) {
    return this.prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        tenantId,
        ledgerId
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
      }
    });
  }

  findFuelLogsInWorkspace(tenantId: string, ledgerId: string) {
    return this.prisma.fuelLog.findMany({
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
      orderBy: [{ filledOn: 'desc' }, { createdAt: 'desc' }]
    });
  }

  findFuelLogInWorkspace(
    fuelLogId: string,
    vehicleId: string,
    tenantId: string,
    ledgerId: string
  ) {
    return this.prisma.fuelLog.findFirst({
      where: {
        id: fuelLogId,
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

  createFuelLogForVehicle(
    vehicleId: string,
    input: CreateVehicleFuelLogRequest
  ) {
    return this.prisma.fuelLog.create({
      data: {
        vehicleId,
        filledOn: new Date(`${input.filledOn}T00:00:00.000Z`),
        odometerKm: input.odometerKm,
        liters: input.liters,
        amountWon: input.amountWon,
        unitPriceWon: input.unitPriceWon,
        isFullTank: input.isFullTank
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

  updateFuelLog(fuelLogId: string, input: CreateVehicleFuelLogRequest) {
    return this.prisma.fuelLog.update({
      where: {
        id: fuelLogId
      },
      data: {
        filledOn: new Date(`${input.filledOn}T00:00:00.000Z`),
        odometerKm: input.odometerKm,
        liters: input.liters,
        amountWon: input.amountWon,
        unitPriceWon: input.unitPriceWon,
        isFullTank: input.isFullTank
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
