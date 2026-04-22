import {
  BadRequestException,
  ConflictException,
  Injectable
} from '@nestjs/common';
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
import { requirePositiveMoneyWon } from '../../common/money/money-won';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { AccountingPeriodWriteGuardPort } from '../accounting-periods/public';
import { normalizeCaseInsensitiveText } from '../../common/utils/normalize-unique-key.util';
import {
  mapVehicleFuelLogToItem,
  mapVehicleMaintenanceLogToItem,
  mapVehicleToItem
} from './vehicles.mapper';
import { buildVehicleOperatingSummaryView } from './vehicle-operating-summary.projection';
import { VehiclesRepository } from './vehicles.repository';
import {
  normalizeFuelLogInput,
  normalizeVehicleLogAccountingLinkInput,
  normalizeMaintenanceLogInput,
  normalizeVehicleInput
} from './vehicles.normalization';

@Injectable()
export class VehiclesService {
  constructor(
    private readonly vehiclesRepository: VehiclesRepository,
    private readonly accountingPeriodWriteGuard: AccountingPeriodWriteGuardPort
  ) {}

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
    await this.vehiclesRepository.assertVehicleDefaultReferencesInWorkspace({
      workspace: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      defaultFundingAccountId: normalizedInput.defaultFundingAccountId,
      defaultFuelCategoryId: normalizedInput.defaultFuelCategoryId,
      defaultMaintenanceCategoryId: normalizedInput.defaultMaintenanceCategoryId
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
    await this.vehiclesRepository.assertVehicleDefaultReferencesInWorkspace({
      workspace: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      defaultFundingAccountId: normalizedInput.defaultFundingAccountId,
      defaultFuelCategoryId: normalizedInput.defaultFuelCategoryId,
      defaultMaintenanceCategoryId: normalizedInput.defaultMaintenanceCategoryId
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
    const normalizedAccountingLink = normalizeVehicleLogAccountingLinkInput(
      input.accountingLink
    );
    const accountingLink = normalizedAccountingLink
      ? await this.resolveVehicleLogAccountingLink({
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          businessDate: normalizedInput.filledOn,
          amountWon: normalizedInput.amountWon,
          accountingLink: normalizedAccountingLink
        })
      : null;
    const created = await this.vehiclesRepository.createFuelLogForVehicle({
      vehicleId,
      vehicleName: vehicle.name,
      workspace: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      log: normalizedInput,
      accountingLink
    });

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
    const normalizedAccountingLink = normalizeVehicleLogAccountingLinkInput(
      input.accountingLink
    );
    const accountingLink = normalizedAccountingLink
      ? await this.resolveVehicleLogAccountingLink({
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          businessDate: normalizedInput.filledOn,
          amountWon: normalizedInput.amountWon,
          accountingLink: normalizedAccountingLink
        })
      : null;
    const updated = await this.vehiclesRepository.updateFuelLog({
      fuelLogId,
      vehicleId,
      vehicleName: vehicle.name,
      workspace: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      log: normalizedInput,
      accountingLink
    });

    return mapVehicleFuelLogToItem(updated);
  }

  async deleteFuelLog(
    user: AuthenticatedUser,
    vehicleId: string,
    fuelLogId: string
  ): Promise<boolean> {
    const workspace = requireCurrentWorkspace(user);
    const vehicle = await this.vehiclesRepository.findByIdInWorkspace(
      vehicleId,
      workspace.tenantId,
      workspace.ledgerId
    );

    if (!vehicle) {
      return false;
    }

    const existingFuelLog =
      await this.vehiclesRepository.findFuelLogInWorkspace(
        fuelLogId,
        vehicleId,
        workspace.tenantId,
        workspace.ledgerId
      );

    if (!existingFuelLog) {
      return false;
    }

    await this.vehiclesRepository.deleteFuelLog({
      fuelLogId,
      vehicleId,
      workspace: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      }
    });

    return true;
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
    const normalizedAccountingLink = normalizeVehicleLogAccountingLinkInput(
      input.accountingLink
    );
    const accountingLink = normalizedAccountingLink
      ? await this.resolveVehicleLogAccountingLink({
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          businessDate: normalizedInput.performedOn,
          amountWon: normalizedInput.amountWon,
          accountingLink: normalizedAccountingLink
        })
      : null;
    const created =
      await this.vehiclesRepository.createMaintenanceLogForVehicle({
        vehicleId,
        vehicleName: vehicle.name,
        workspace: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId
        },
        log: normalizedInput,
        accountingLink
      });

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
    const normalizedAccountingLink = normalizeVehicleLogAccountingLinkInput(
      input.accountingLink
    );
    const accountingLink = normalizedAccountingLink
      ? await this.resolveVehicleLogAccountingLink({
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          businessDate: normalizedInput.performedOn,
          amountWon: normalizedInput.amountWon,
          accountingLink: normalizedAccountingLink
        })
      : null;
    const updated = await this.vehiclesRepository.updateMaintenanceLog({
      maintenanceLogId,
      vehicleId,
      vehicleName: vehicle.name,
      workspace: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      log: normalizedInput,
      accountingLink
    });

    return mapVehicleMaintenanceLogToItem(updated);
  }

  async deleteMaintenanceLog(
    user: AuthenticatedUser,
    vehicleId: string,
    maintenanceLogId: string
  ): Promise<boolean> {
    const workspace = requireCurrentWorkspace(user);
    const vehicle = await this.vehiclesRepository.findByIdInWorkspace(
      vehicleId,
      workspace.tenantId,
      workspace.ledgerId
    );

    if (!vehicle) {
      return false;
    }

    const existingMaintenanceLog =
      await this.vehiclesRepository.findMaintenanceLogInWorkspace(
        maintenanceLogId,
        vehicleId,
        workspace.tenantId,
        workspace.ledgerId
      );

    if (!existingMaintenanceLog) {
      return false;
    }

    await this.vehiclesRepository.deleteMaintenanceLog({
      maintenanceLogId,
      vehicleId,
      workspace: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      }
    });

    return true;
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
        normalizeCaseInsensitiveText(candidate.name) ===
          normalizeCaseInsensitiveText(input.name)
    );

    if (!duplicate) {
      return;
    }

    throw new ConflictException('같은 이름의 차량이 이미 있습니다.');
  }

  private async resolveVehicleLogAccountingLink(input: {
    tenantId: string;
    ledgerId: string;
    businessDate: string;
    amountWon: number;
    accountingLink: {
      fundingAccountId: string;
      categoryId: string | null;
    };
  }) {
    if (input.amountWon <= 0) {
      throw new BadRequestException(
        '회계 연동을 켠 차량 운영비는 0보다 큰 금액이어야 합니다.'
      );
    }

    requirePositiveMoneyWon(
      input.amountWon,
      '회계 연동 거래 금액은 0보다 큰 안전한 정수여야 합니다.'
    );

    const period =
      await this.accountingPeriodWriteGuard.assertCollectingDateAllowed(
        {
          tenantId: input.tenantId,
          ledgerId: input.ledgerId
        },
        input.businessDate
      );

    return {
      periodId: period.id,
      fundingAccountId: input.accountingLink.fundingAccountId,
      categoryId: input.accountingLink.categoryId
    };
  }
}
