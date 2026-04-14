import { Module } from '@nestjs/common';
import { AdminAuditEventsService } from './admin-audit-events.service';
import { AdminController } from './admin.controller';
import { AdminMembersService } from './admin-members.service';

@Module({
  controllers: [AdminController],
  providers: [AdminMembersService, AdminAuditEventsService],
  exports: [AdminAuditEventsService]
})
export class AdminModule {}
