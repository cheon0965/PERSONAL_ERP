import { Module } from '@nestjs/common';
import { AccountingPeriodsModule } from '../accounting-periods/public';
import { VehiclesController } from './vehicles.controller';
import { VehiclesRepository } from './vehicles.repository';
import { VehiclesService } from './vehicles.service';

@Module({
  imports: [AccountingPeriodsModule],
  controllers: [VehiclesController],
  providers: [VehiclesService, VehiclesRepository]
})
export class VehiclesModule {}
