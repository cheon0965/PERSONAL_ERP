import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardReadRepository } from './dashboard-read.repository';
import { DashboardReadService } from './dashboard-read.service';

@Module({
  controllers: [DashboardController],
  providers: [DashboardReadService, DashboardReadRepository]
})
export class DashboardModule {}
