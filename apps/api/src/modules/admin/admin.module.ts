import { Module } from '@nestjs/common';
import { NavigationModule } from '../navigation/public';
import { AdminMemberCommandSupportService } from './infrastructure/services/admin-member-command.support';
import { AdminMemberCommandPort } from './application/ports/admin-member-command.port';
import { InviteTenantMemberUseCase } from './application/use-cases/invite-tenant-member.use-case';
import { RemoveTenantMemberUseCase } from './application/use-cases/remove-tenant-member.use-case';
import { UpdateTenantMemberRoleUseCase } from './application/use-cases/update-tenant-member-role.use-case';
import { UpdateTenantMemberStatusUseCase } from './application/use-cases/update-tenant-member-status.use-case';
import { AdminAuditEventsService } from './infrastructure/services/admin-audit-events.service';
import { AdminController } from './admin.controller';
import { AdminMemberQueryService } from './infrastructure/services/admin-member-query.service';
import { AdminPolicyService } from './infrastructure/services/admin-policy.service';
import { AdminSecurityThreatEventsService } from './infrastructure/services/admin-security-threat-events.service';
import { AdminSystemService } from './infrastructure/services/admin-system.service';
import { AdminMemberCommandAdapter } from './infrastructure/services/admin-member-command.adapter';
import { InviteTenantMemberHandler } from './infrastructure/services/invite-tenant-member.handler';
import { RemoveTenantMemberHandler } from './infrastructure/services/remove-tenant-member.handler';
import { UpdateTenantMemberRoleHandler } from './infrastructure/services/update-tenant-member-role.handler';
import { UpdateTenantMemberStatusHandler } from './infrastructure/services/update-tenant-member-status.handler';

@Module({
  imports: [NavigationModule],
  controllers: [AdminController],
  providers: [
    AdminMemberCommandSupportService,
    InviteTenantMemberHandler,
    UpdateTenantMemberRoleHandler,
    UpdateTenantMemberStatusHandler,
    RemoveTenantMemberHandler,
    AdminMemberCommandAdapter,
    {
      provide: AdminMemberCommandPort,
      useExisting: AdminMemberCommandAdapter
    },
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
