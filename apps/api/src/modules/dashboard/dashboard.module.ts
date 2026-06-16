import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardReadRepository } from './repositories/dashboard-read.repository';
import { DashboardReadService } from './services/dashboard-read.service';

@Module({
  controllers: [DashboardController],
  providers: [DashboardReadService, DashboardReadRepository]
})
export class DashboardModule {}
