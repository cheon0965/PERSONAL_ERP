import { ConflictException, Injectable } from '@nestjs/common';
import type {
  AuthenticatedUser,
  CreateVehicleRequest,
  CreateVehicleFuelLogRequest,
  CreateVehicleMaintenanceLogRequest,
  UpdateVehicleFuelLogRequest,
  UpdateVehicleMaintenanceLogRequest,
  UpdateVehicleRequest,
  VehicleFuelLogItem,
  VehicleItem,
  VehicleMaintenanceLogItem,
  VehicleOperatingSummaryView
} from '@personal-erp/contracts';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import {
  mapVehicleFuelLogToItem,
  mapVehicleMaintenanceLogToItem,
  mapVehicleToItem
} from './vehicles.mapper';
import { buildVehicleOperatingSummaryView } from './vehicle-operating-summary.projection';
import { VehiclesRepository } from './vehicles.repository';
import {
  normalizeFuelLogInput,
  normalizeMaintenanceLogInput,
  normalizeVehicleInput
} from './vehicles.normalization';

@Injectable()
export class VehiclesService {
  constructor(private readonly vehiclesRepository: VehiclesRepository) {}

  async findAll(user: AuthenticatedUser): Promise<VehicleItem[]> {
    const workspace = requireCurrentWorkspace(user);
    const items = await this.vehiclesRepository.findAllInWorkspace(
      workspace.tenantId,
      workspace.ledgerId
    );
    return items.map(mapVehicleToItem);
  }

  async findOperatingSummary(
    user: AuthenticatedUser
  ): Promise<VehicleOperatingSummaryView> {
    const workspace = requireCurrentWorkspace(user);
    const [vehicles, fuelLogs, maintenanceLogs] = await Promise.all([
      this.vehiclesRepository
        .findAllInWorkspace(workspace.tenantId, workspace.ledgerId)
        .then((items) => items.map(mapVehicleToItem)),
      this.vehiclesRepository
        .findFuelLogsInWorkspace(workspace.tenantId, workspace.ledgerId)
        .then((items) => items.map(mapVehicleFuelLogToItem)),
      this.vehiclesRepository
        .findMaintenanceLogsInWorkspace(workspace.tenantId, workspace.ledgerId)
        .then((items) => items.map(mapVehicleMaintenanceLogToItem))
    ]);

    return buildVehicleOperatingSummaryView({
      vehicles,
      fuelLogs,
      maintenanceLogs
    });
  }

  async create(
    user: AuthenticatedUser,
    input: CreateVehicleRequest
  ): Promise<VehicleItem> {
    const workspace = requireCurrentWorkspace(user);
    const normalizedInput = normalizeVehicleInput(input);

    await this.assertNoDuplicateVehicle({
      tenantId: workspace.tenantId,
      ledgerId: workspace.ledgerId,
      name: normalizedInput.name
    });

    const created = await this.vehiclesRepository.createInWorkspace(
      workspace.userId,
      workspace.tenantId,
      workspace.ledgerId,
      normalizedInput
    );

    return mapVehicleToItem(created);
  }

  async update(
    user: AuthenticatedUser,
    vehicleId: string,
    input: UpdateVehicleRequest
  ): Promise<VehicleItem | null> {
    const workspace = requireCurrentWorkspace(user);
    const existing = await this.vehiclesRepository.findByIdInWorkspace(
      vehicleId,
      workspace.tenantId,
      workspace.ledgerId
    );

    if (!existing) {
      return null;
    }

    const normalizedInput = normalizeVehicleInput(input);

    await this.assertNoDuplicateVehicle({
      tenantId: workspace.tenantId,
      ledgerId: workspace.ledgerId,
      name: normalizedInput.name,
      excludeVehicleId: existing.id
    });

    const updated = await this.vehiclesRepository.updateInWorkspace(
      vehicleId,
      normalizedInput
    );

    return mapVehicleToItem(updated);
  }

  async findFuelLogs(user: AuthenticatedUser): Promise<VehicleFuelLogItem[]> {
    const workspace = requireCurrentWorkspace(user);
    const items = await this.vehiclesRepository.findFuelLogsInWorkspace(
      workspace.tenantId,
      workspace.ledgerId
    );

    return items.map(mapVehicleFuelLogToItem);
  }

  async createFuelLog(
    user: AuthenticatedUser,
    vehicleId: string,
    input: CreateVehicleFuelLogRequest
  ): Promise<VehicleFuelLogItem | null> {
    const workspace = requireCurrentWorkspace(user);
    const vehicle = await this.vehiclesRepository.findByIdInWorkspace(
      vehicleId,
      workspace.tenantId,
      workspace.ledgerId
    );

    if (!vehicle) {
      return null;
    }

    const normalizedInput = normalizeFuelLogInput(input, vehicle);
    const created = await this.vehiclesRepository.createFuelLogForVehicle(
      vehicleId,
      normalizedInput
    );

    return mapVehicleFuelLogToItem(created);
  }

  async updateFuelLog(
    user: AuthenticatedUser,
    vehicleId: string,
    fuelLogId: string,
    input: UpdateVehicleFuelLogRequest
  ): Promise<VehicleFuelLogItem | null> {
    const workspace = requireCurrentWorkspace(user);
    const vehicle = await this.vehiclesRepository.findByIdInWorkspace(
      vehicleId,
      workspace.tenantId,
      workspace.ledgerId
    );

    if (!vehicle) {
      return null;
    }

    const existingFuelLog =
      await this.vehiclesRepository.findFuelLogInWorkspace(
        fuelLogId,
        vehicleId,
        workspace.tenantId,
        workspace.ledgerId
      );

    if (!existingFuelLog) {
      return null;
    }

    const normalizedInput = normalizeFuelLogInput(input, vehicle);
    const updated = await this.vehiclesRepository.updateFuelLog(
      fuelLogId,
      normalizedInput
    );

    return mapVehicleFuelLogToItem(updated);
  }

  async findMaintenanceLogs(
    user: AuthenticatedUser
  ): Promise<VehicleMaintenanceLogItem[]> {
    const workspace = requireCurrentWorkspace(user);
    const items = await this.vehiclesRepository.findMaintenanceLogsInWorkspace(
      workspace.tenantId,
      workspace.ledgerId
    );

    return items.map(mapVehicleMaintenanceLogToItem);
  }

  async createMaintenanceLog(
    user: AuthenticatedUser,
    vehicleId: string,
    input: CreateVehicleMaintenanceLogRequest
  ): Promise<VehicleMaintenanceLogItem | null> {
    const workspace = requireCurrentWorkspace(user);
    const vehicle = await this.vehiclesRepository.findByIdInWorkspace(
      vehicleId,
      workspace.tenantId,
      workspace.ledgerId
    );

    if (!vehicle) {
      return null;
    }

    const normalizedInput = normalizeMaintenanceLogInput(input, vehicle);
    const created =
      await this.vehiclesRepository.createMaintenanceLogForVehicle(
        vehicleId,
        normalizedInput
      );

    return mapVehicleMaintenanceLogToItem(created);
  }

  async updateMaintenanceLog(
    user: AuthenticatedUser,
    vehicleId: string,
    maintenanceLogId: string,
    input: UpdateVehicleMaintenanceLogRequest
  ): Promise<VehicleMaintenanceLogItem | null> {
    const workspace = requireCurrentWorkspace(user);
    const vehicle = await this.vehiclesRepository.findByIdInWorkspace(
      vehicleId,
      workspace.tenantId,
      workspace.ledgerId
    );

    if (!vehicle) {
      return null;
    }

    const existingMaintenanceLog =
      await this.vehiclesRepository.findMaintenanceLogInWorkspace(
        maintenanceLogId,
        vehicleId,
        workspace.tenantId,
        workspace.ledgerId
      );

    if (!existingMaintenanceLog) {
      return null;
    }

    const normalizedInput = normalizeMaintenanceLogInput(input, vehicle);
    const updated = await this.vehiclesRepository.updateMaintenanceLog(
      maintenanceLogId,
      normalizedInput
    );

    return mapVehicleMaintenanceLogToItem(updated);
  }

  private async assertNoDuplicateVehicle(input: {
    tenantId: string;
    ledgerId: string;
    name: string;
    excludeVehicleId?: string;
  }) {
    const items = await this.vehiclesRepository.findAllInWorkspace(
      input.tenantId,
      input.ledgerId
    );
    const duplicate = items.find(
      (candidate) =>
        candidate.id !== input.excludeVehicleId &&
        candidate.name.trim().toLowerCase() === input.name.toLowerCase()
    );

    if (!duplicate) {
      return;
    }

    throw new ConflictException('같은 이름의 차량이 이미 있습니다.');
  }
}
