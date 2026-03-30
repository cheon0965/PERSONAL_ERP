import { AuditActorType } from '@prisma/client';
import type { RequiredWorkspaceContext } from './required-workspace.util';

type WorkspaceActorRef = {
  actorType: AuditActorType;
  actorMembershipId: string;
};

type WorkspaceCreatedByActorRef = {
  createdByActorType: AuditActorType;
  createdByMembershipId: string;
};

export function readWorkspaceActorRef(
  workspace: RequiredWorkspaceContext
): WorkspaceActorRef {
  return {
    actorType: AuditActorType.TENANT_MEMBERSHIP,
    actorMembershipId: workspace.membershipId
  };
}

export function readWorkspaceCreatedByActorRef(
  workspace: RequiredWorkspaceContext
): WorkspaceCreatedByActorRef {
  return {
    createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
    createdByMembershipId: workspace.membershipId
  };
}
