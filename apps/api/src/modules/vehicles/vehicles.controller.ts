import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import {
  assertWorkspaceActionAllowed,
  readAllowedWorkspaceRoles
} from '../../common/auth/workspace-action.policy';
import type { RequestWithContext } from '../../common/infrastructure/operational/request-context';
import { SecurityEventLogger } from '../../common/infrastructure/operational/security-event.logger';
import {
  logWorkspaceActionDenied,
  logWorkspaceActionSucceeded
} from '../../common/infrastructure/operational/workspace-action.audit';
import { CreateVehicleFuelLogDto } from './dto/create-vehicle-fuel-log.dto';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { CreateVehicleMaintenanceLogDto } from './dto/create-vehicle-maintenance-log.dto';
import { UpdateVehicleFuelLogDto } from './dto/update-vehicle-fuel-log.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { UpdateVehicleMaintenanceLogDto } from './dto/update-vehicle-maintenance-log.dto';
import { VehiclesService } from './vehicles.service';

@ApiTags('vehicles')
@ApiBearerAuth()
@Controller('vehicles')
export class VehiclesController {
  constructor(
    private readonly vehiclesService: VehiclesService,
    private readonly securityEvents: SecurityEventLogger
  ) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.vehiclesService.findAll(user);
  }

  @Get('operating-summary')
  findOperatingSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.vehiclesService.findOperatingSummary(user);
  }

  @Get('fuel-logs')
  findFuelLogs(@CurrentUser() user: AuthenticatedUser) {
    return this.vehiclesService.findFuelLogs(user);
  }

  @Get('maintenance-logs')
  findMaintenanceLogs(@CurrentUser() user: AuthenticatedUser) {
    return this.vehiclesService.findMaintenanceLogs(user);
  }

  @Post()
  async create(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateVehicleDto
  ) {
    const workspace = requireCurrentWorkspace(user);

    try {
      assertWorkspaceActionAllowed(workspace.membershipRole, 'vehicle.create');

      const created = await this.vehiclesService.create(user, dto);

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'vehicle.create',
        request,
        workspace,
        details: {
          vehicleId: created.id
        }
      });

      return created;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'vehicle.create',
          request,
          workspace,
          details: {
            requiredRoles: readAllowedWorkspaceRoles('vehicle.create').join(',')
          }
        });
      }

      throw error;
    }
  }

  @Patch(':id')
  async update(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') vehicleId: string,
    @Body() dto: UpdateVehicleDto
  ) {
    const workspace = requireCurrentWorkspace(user);

    try {
      assertWorkspaceActionAllowed(workspace.membershipRole, 'vehicle.update');

      const updated = await this.vehiclesService.update(user, vehicleId, dto);

      if (!updated) {
        throw new NotFoundException('Vehicle not found');
      }

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'vehicle.update',
        request,
        workspace,
        details: {
          vehicleId: updated.id
        }
      });

      return updated;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'vehicle.update',
          request,
          workspace,
          details: {
            vehicleId,
            requiredRoles: readAllowedWorkspaceRoles('vehicle.update').join(',')
          }
        });
      }

      throw error;
    }
  }

  @Post(':id/fuel-logs')
  async createFuelLog(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') vehicleId: string,
    @Body() dto: CreateVehicleFuelLogDto
  ) {
    const workspace = requireCurrentWorkspace(user);

    try {
      assertWorkspaceActionAllowed(
        workspace.membershipRole,
        'vehicle_fuel.create'
      );

      const created = await this.vehiclesService.createFuelLog(
        user,
        vehicleId,
        dto
      );

      if (!created) {
        throw new NotFoundException('Vehicle not found');
      }

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'vehicle_fuel.create',
        request,
        workspace,
        details: {
          vehicleId,
          fuelLogId: created.id
        }
      });

      return created;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'vehicle_fuel.create',
          request,
          workspace,
          details: {
            vehicleId,
            requiredRoles: readAllowedWorkspaceRoles(
              'vehicle_fuel.create'
            ).join(',')
          }
        });
      }

      throw error;
    }
  }

  @Patch(':vehicleId/fuel-logs/:fuelLogId')
  async updateFuelLog(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('vehicleId') vehicleId: string,
    @Param('fuelLogId') fuelLogId: string,
    @Body() dto: UpdateVehicleFuelLogDto
  ) {
    const workspace = requireCurrentWorkspace(user);

    try {
      assertWorkspaceActionAllowed(
        workspace.membershipRole,
        'vehicle_fuel.update'
      );

      const updated = await this.vehiclesService.updateFuelLog(
        user,
        vehicleId,
        fuelLogId,
        dto
      );

      if (!updated) {
        throw new NotFoundException('Vehicle fuel log not found');
      }

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'vehicle_fuel.update',
        request,
        workspace,
        details: {
          vehicleId,
          fuelLogId: updated.id
        }
      });

      return updated;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'vehicle_fuel.update',
          request,
          workspace,
          details: {
            vehicleId,
            fuelLogId,
            requiredRoles: readAllowedWorkspaceRoles(
              'vehicle_fuel.update'
            ).join(',')
          }
        });
      }

      throw error;
    }
  }

  @Delete(':vehicleId/fuel-logs/:fuelLogId')
  @HttpCode(204)
  async deleteFuelLog(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('vehicleId') vehicleId: string,
    @Param('fuelLogId') fuelLogId: string
  ) {
    const workspace = requireCurrentWorkspace(user);

    try {
      assertWorkspaceActionAllowed(
        workspace.membershipRole,
        'vehicle_fuel.delete'
      );

      const deleted = await this.vehiclesService.deleteFuelLog(
        user,
        vehicleId,
        fuelLogId
      );

      if (!deleted) {
        throw new NotFoundException('Vehicle fuel log not found');
      }

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'vehicle_fuel.delete',
        request,
        workspace,
        details: {
          vehicleId,
          fuelLogId
        }
      });
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'vehicle_fuel.delete',
          request,
          workspace,
          details: {
            vehicleId,
            fuelLogId,
            requiredRoles: readAllowedWorkspaceRoles(
              'vehicle_fuel.delete'
            ).join(',')
          }
        });
      }

      throw error;
    }
  }

  @Post(':id/maintenance-logs')
  async createMaintenanceLog(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') vehicleId: string,
    @Body() dto: CreateVehicleMaintenanceLogDto
  ) {
    const workspace = requireCurrentWorkspace(user);

    try {
      assertWorkspaceActionAllowed(
        workspace.membershipRole,
        'vehicle_maintenance.create'
      );

      const created = await this.vehiclesService.createMaintenanceLog(
        user,
        vehicleId,
        dto
      );

      if (!created) {
        throw new NotFoundException('Vehicle not found');
      }

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'vehicle_maintenance.create',
        request,
        workspace,
        details: {
          vehicleId,
          maintenanceLogId: created.id
        }
      });

      return created;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'vehicle_maintenance.create',
          request,
          workspace,
          details: {
            vehicleId,
            requiredRoles: readAllowedWorkspaceRoles(
              'vehicle_maintenance.create'
            ).join(',')
          }
        });
      }

      throw error;
    }
  }

  @Patch(':vehicleId/maintenance-logs/:maintenanceLogId')
  async updateMaintenanceLog(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('vehicleId') vehicleId: string,
    @Param('maintenanceLogId') maintenanceLogId: string,
    @Body() dto: UpdateVehicleMaintenanceLogDto
  ) {
    const workspace = requireCurrentWorkspace(user);

    try {
      assertWorkspaceActionAllowed(
        workspace.membershipRole,
        'vehicle_maintenance.update'
      );

      const updated = await this.vehiclesService.updateMaintenanceLog(
        user,
        vehicleId,
        maintenanceLogId,
        dto
      );

      if (!updated) {
        throw new NotFoundException('Vehicle maintenance log not found');
      }

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'vehicle_maintenance.update',
        request,
        workspace,
        details: {
          vehicleId,
          maintenanceLogId: updated.id
        }
      });

      return updated;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'vehicle_maintenance.update',
          request,
          workspace,
          details: {
            vehicleId,
            maintenanceLogId,
            requiredRoles: readAllowedWorkspaceRoles(
              'vehicle_maintenance.update'
            ).join(',')
          }
        });
      }

      throw error;
    }
  }

  @Delete(':vehicleId/maintenance-logs/:maintenanceLogId')
  @HttpCode(204)
  async deleteMaintenanceLog(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('vehicleId') vehicleId: string,
    @Param('maintenanceLogId') maintenanceLogId: string
  ) {
    const workspace = requireCurrentWorkspace(user);

    try {
      assertWorkspaceActionAllowed(
        workspace.membershipRole,
        'vehicle_maintenance.delete'
      );

      const deleted = await this.vehiclesService.deleteMaintenanceLog(
        user,
        vehicleId,
        maintenanceLogId
      );

      if (!deleted) {
        throw new NotFoundException('Vehicle maintenance log not found');
      }

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'vehicle_maintenance.delete',
        request,
        workspace,
        details: {
          vehicleId,
          maintenanceLogId
        }
      });
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'vehicle_maintenance.delete',
          request,
          workspace,
          details: {
            vehicleId,
            maintenanceLogId,
            requiredRoles: readAllowedWorkspaceRoles(
              'vehicle_maintenance.delete'
            ).join(',')
          }
        });
      }

      throw error;
    }
  }
}
