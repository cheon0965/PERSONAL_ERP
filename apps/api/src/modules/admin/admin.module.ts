import { Module } from '@nestjs/common';
import { NavigationModule } from '../navigation/public';
import { AdminMemberCommandSupportService } from './admin-member-command.support';
import { InviteTenantMemberUseCase } from './application/use-cases/invite-tenant-member.use-case';
import { RemoveTenantMemberUseCase } from './application/use-cases/remove-tenant-member.use-case';
import { UpdateTenantMemberRoleUseCase } from './application/use-cases/update-tenant-member-role.use-case';
import { UpdateTenantMemberStatusUseCase } from './application/use-cases/update-tenant-member-status.use-case';
import { AdminAuditEventsService } from './admin-audit-events.service';
import { AdminController } from './admin.controller';
import { AdminMemberQueryService } from './admin-member-query.service';
import { AdminPolicyService } from './admin-policy.service';
import { AdminSecurityThreatEventsService } from './admin-security-threat-events.service';
import { AdminSystemService } from './admin-system.service';

@Module({
  imports: [NavigationModule],
  controllers: [AdminController],
  providers: [
    AdminMemberCommandSupportService,
    AdminMemberQueryService,
    InviteTenantMemberUseCase,
    UpdateTenantMemberRoleUseCase,
    UpdateTenantMemberStatusUseCase,
    RemoveTenantMemberUseCase,
    AdminAuditEventsService,
    AdminSecurityThreatEventsService,
    AdminPolicyService,
    AdminSystemService
  ],
  exports: [AdminAuditEventsService]
})
export class AdminModule {}
