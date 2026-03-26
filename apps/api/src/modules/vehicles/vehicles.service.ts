import { Injectable } from '@nestjs/common';
import type { VehicleItem } from '@personal-erp/contracts';
import { mapVehicleToItem } from './vehicles.mapper';
import { VehiclesRepository } from './vehicles.repository';

@Injectable()
export class VehiclesService {
  constructor(private readonly vehiclesRepository: VehiclesRepository) {}

  async findAll(userId: string): Promise<VehicleItem[]> {
    const items = await this.vehiclesRepository.findAllByUserId(userId);
    return items.map(mapVehicleToItem);
  }
}
