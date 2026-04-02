import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser, VehicleItem } from '@personal-erp/contracts';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { mapVehicleToItem } from './vehicles.mapper';
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
}
