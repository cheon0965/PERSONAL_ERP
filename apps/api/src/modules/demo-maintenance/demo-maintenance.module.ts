import { Module } from '@nestjs/common';
import { DemoMaintenanceService } from './demo-maintenance.service';

@Module({
  providers: [DemoMaintenanceService]
})
export class DemoMaintenanceModule {}
