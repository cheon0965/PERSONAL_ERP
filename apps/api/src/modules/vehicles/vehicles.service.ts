import {
  BadRequestException,
  ConflictException,
  Injectable
} from '@nestjs/common';
import type {
  AuthenticatedUser,
  CreateVehicleRequest,
  CreateVehicleMaintenanceLogRequest,
  UpdateVehicleMaintenanceLogRequest,
  UpdateVehicleRequest,
  VehicleItem,
  VehicleMaintenanceLogItem
} from '@personal-erp/contracts';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import {
  mapVehicleMaintenanceLogToItem,
  mapVehicleToItem
} from './vehicles.mapper';
import { VehiclesRepository } from './vehicles.repository';

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
    const created = await this.vehiclesRepository.createMaintenanceLogForVehicle(
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

function normalizeVehicleInput(
  input: CreateVehicleRequest | UpdateVehicleRequest
) {
  return {
    name: normalizeRequiredText(input.name, '차량 이름을 입력해 주세요.'),
    manufacturer: normalizeOptionalText(input.manufacturer),
    fuelType: input.fuelType,
    initialOdometerKm: input.initialOdometerKm,
    monthlyExpenseWon: input.monthlyExpenseWon,
    estimatedFuelEfficiencyKmPerLiter: normalizeOptionalPositiveNumber(
      input.estimatedFuelEfficiencyKmPerLiter
    )
  };
}

function normalizeRequiredText(value: string, message: string) {
  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new BadRequestException(message);
  }

  return normalizedValue;
}

function normalizeOptionalText(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length === 0 ? null : normalizedValue;
}

function normalizeOptionalPositiveNumber(value?: number | null) {
  if (value === undefined || value === null) {
    return null;
  }

  if (!Number.isFinite(value) || value <= 0) {
    throw new BadRequestException('예상 연비는 0보다 커야 합니다.');
  }

  return value;
}

function normalizeMaintenanceLogInput(
  input: CreateVehicleMaintenanceLogRequest | UpdateVehicleMaintenanceLogRequest,
  vehicle: {
    initialOdometerKm: number;
  }
) {
  const performedOn = normalizeRequiredDateOnlyString(
    input.performedOn,
    '정비일을 입력해 주세요.'
  );
  const description = normalizeRequiredText(
    input.description,
    '정비 내용을 입력해 주세요.'
  );
  const vendor = normalizeOptionalText(input.vendor);
  const memo = normalizeOptionalText(input.memo);

  if (input.odometerKm < vehicle.initialOdometerKm) {
    throw new BadRequestException(
      '정비 주행거리는 차량 초기 주행거리보다 작을 수 없습니다.'
    );
  }

  return {
    performedOn,
    odometerKm: input.odometerKm,
    category: input.category,
    vendor,
    description,
    amountWon: input.amountWon,
    memo
  };
}

function normalizeRequiredDateOnlyString(value: string, message: string) {
  const normalizedValue = value.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    throw new BadRequestException(message);
  }

  const parsed = new Date(`${normalizedValue}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(message);
  }

  return normalizedValue;
}
