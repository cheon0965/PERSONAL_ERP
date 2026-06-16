import { Module } from '@nestjs/common';
import { DemoMaintenanceService } from './services/demo-maintenance.service';

@Module({
  providers: [DemoMaintenanceService]
})
export class DemoMaintenanceModule {}
