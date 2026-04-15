import { Module } from '@nestjs/common';
import { NavigationModule } from '../navigation/public';
import { AdminAuditEventsService } from './admin-audit-events.service';
import { AdminController } from './admin.controller';
import { AdminMembersService } from './admin-members.service';
import { AdminPolicyService } from './admin-policy.service';

@Module({
  imports: [NavigationModule],
  controllers: [AdminController],
  providers: [AdminMembersService, AdminAuditEventsService, AdminPolicyService],
  exports: [AdminAuditEventsService]
})
export class AdminModule {}
