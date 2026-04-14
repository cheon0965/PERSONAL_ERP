import { Module } from '@nestjs/common';
import { AdminAuditEventsService } from './admin-audit-events.service';
import { AdminController } from './admin.controller';
import { AdminMembersService } from './admin-members.service';
import { AdminPolicyService } from './admin-policy.service';

@Module({
  controllers: [AdminController],
  providers: [AdminMembersService, AdminAuditEventsService, AdminPolicyService],
  exports: [AdminAuditEventsService]
})
export class AdminModule {}
