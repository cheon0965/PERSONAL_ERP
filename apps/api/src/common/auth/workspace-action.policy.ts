import { ForbiddenException } from '@nestjs/common';
import type { RequiredWorkspaceContext } from './required-workspace.util';

export type WorkspaceMembershipRole =
  RequiredWorkspaceContext['membershipRole'];

export type WorkspaceAction =
  | 'admin_member.read'
  | 'admin_member.invite'
  | 'admin_member.update_role'
  | 'admin_member.update_status'
  | 'admin_member.remove'
  | 'admin_audit_log.read'
  | 'funding_account.create'
  | 'funding_account.update'
  | 'category.create'
  | 'category.update'
  | 'insurance_policy.create'
  | 'insurance_policy.update'
  | 'insurance_policy.delete'
  | 'vehicle.create'
  | 'vehicle.update'
  | 'vehicle_fuel.create'
  | 'vehicle_fuel.update'
  | 'vehicle_maintenance.create'
  | 'vehicle_maintenance.update'
  | 'accounting_period.open'
  | 'accounting_period.close'
  | 'accounting_period.reopen'
  | 'recurring_rule.create'
  | 'recurring_rule.update'
  | 'recurring_rule.delete'
  | 'plan_item.generate'
  | 'collected_transaction.create'
  | 'collected_transaction.update'
  | 'collected_transaction.delete'
  | 'collected_transaction.confirm'
  | 'financial_statement.generate'
  | 'carry_forward.generate'
  | 'journal_entry.reverse'
  | 'journal_entry.correct'
  | 'import_batch.upload';

const workspaceActionAllowedRoles: Record<
  WorkspaceAction,
  readonly WorkspaceMembershipRole[]
> = {
  'admin_member.read': ['OWNER', 'MANAGER'],
  'admin_member.invite': ['OWNER'],
  'admin_member.update_role': ['OWNER'],
  'admin_member.update_status': ['OWNER'],
  'admin_member.remove': ['OWNER'],
  'admin_audit_log.read': ['OWNER'],
  'funding_account.create': ['OWNER', 'MANAGER'],
  'funding_account.update': ['OWNER', 'MANAGER'],
  'category.create': ['OWNER', 'MANAGER'],
  'category.update': ['OWNER', 'MANAGER'],
  'insurance_policy.create': ['OWNER', 'MANAGER'],
  'insurance_policy.update': ['OWNER', 'MANAGER'],
  'insurance_policy.delete': ['OWNER', 'MANAGER'],
  'vehicle.create': ['OWNER', 'MANAGER'],
  'vehicle.update': ['OWNER', 'MANAGER'],
  'vehicle_fuel.create': ['OWNER', 'MANAGER'],
  'vehicle_fuel.update': ['OWNER', 'MANAGER'],
  'vehicle_maintenance.create': ['OWNER', 'MANAGER'],
  'vehicle_maintenance.update': ['OWNER', 'MANAGER'],
  'accounting_period.open': ['OWNER', 'MANAGER'],
  'accounting_period.close': ['OWNER'],
  'accounting_period.reopen': ['OWNER'],
  'recurring_rule.create': ['OWNER', 'MANAGER'],
  'recurring_rule.update': ['OWNER', 'MANAGER'],
  'recurring_rule.delete': ['OWNER', 'MANAGER'],
  'plan_item.generate': ['OWNER', 'MANAGER'],
  'collected_transaction.create': ['OWNER', 'MANAGER', 'EDITOR'],
  'collected_transaction.update': ['OWNER', 'MANAGER', 'EDITOR'],
  'collected_transaction.delete': ['OWNER', 'MANAGER', 'EDITOR'],
  'collected_transaction.confirm': ['OWNER', 'MANAGER', 'EDITOR'],
  'financial_statement.generate': ['OWNER', 'MANAGER'],
  'carry_forward.generate': ['OWNER', 'MANAGER'],
  'journal_entry.reverse': ['OWNER', 'MANAGER'],
  'journal_entry.correct': ['OWNER', 'MANAGER'],
  'import_batch.upload': ['OWNER', 'MANAGER', 'EDITOR']
};

const workspaceActionDeniedMessages: Record<WorkspaceAction, string> = {
  'admin_member.read': 'Only owners and managers can read workspace members.',
  'admin_member.invite': 'Only owners can invite workspace members.',
  'admin_member.update_role': 'Only owners can update workspace member roles.',
  'admin_member.update_status':
    'Only owners can update workspace member statuses.',
  'admin_member.remove': 'Only owners can remove workspace members.',
  'admin_audit_log.read': 'Only owners can read workspace audit logs.',
  'funding_account.create':
    'Only owners and managers can create funding accounts.',
  'funding_account.update':
    'Only owners and managers can update funding accounts.',
  'category.create': 'Only owners and managers can create categories.',
  'category.update': 'Only owners and managers can update categories.',
  'insurance_policy.create':
    'Only owners and managers can create insurance policies.',
  'insurance_policy.update':
    'Only owners and managers can update insurance policies.',
  'insurance_policy.delete':
    'Only owners and managers can delete insurance policies.',
  'vehicle.create': 'Only owners and managers can create vehicles.',
  'vehicle.update': 'Only owners and managers can update vehicles.',
  'vehicle_fuel.create':
    'Only owners and managers can create vehicle fuel logs.',
  'vehicle_fuel.update':
    'Only owners and managers can update vehicle fuel logs.',
  'vehicle_maintenance.create':
    'Only owners and managers can create vehicle maintenance logs.',
  'vehicle_maintenance.update':
    'Only owners and managers can update vehicle maintenance logs.',
  'accounting_period.open':
    'Only owners and managers can open accounting periods.',
  'accounting_period.close': 'Only owners can close accounting periods.',
  'accounting_period.reopen': 'Only owners can reopen accounting periods.',
  'recurring_rule.create':
    'Only owners and managers can create recurring rules.',
  'recurring_rule.update':
    'Only owners and managers can update recurring rules.',
  'recurring_rule.delete':
    'Only owners and managers can delete recurring rules.',
  'plan_item.generate': 'Only owners and managers can generate plan items.',
  'collected_transaction.create':
    'Only owners, managers, and editors can create collected transactions.',
  'collected_transaction.update':
    'Only owners, managers, and editors can update collected transactions.',
  'collected_transaction.delete':
    'Only owners, managers, and editors can delete collected transactions.',
  'collected_transaction.confirm':
    'Only owners, managers, and editors can confirm collected transactions.',
  'financial_statement.generate':
    'Only owners and managers can generate financial statements.',
  'carry_forward.generate':
    'Only owners and managers can generate carry-forward records.',
  'journal_entry.reverse':
    'Only owners and managers can create reversal journal entries.',
  'journal_entry.correct':
    'Only owners and managers can create correction journal entries.',
  'import_batch.upload':
    'Only owners, managers, and editors can upload import batches.'
};

export function readAllowedWorkspaceRoles(
  action: WorkspaceAction
): readonly WorkspaceMembershipRole[] {
  return workspaceActionAllowedRoles[action];
}

export function canExecuteWorkspaceAction(
  role: WorkspaceMembershipRole,
  action: WorkspaceAction
): boolean {
  return workspaceActionAllowedRoles[action].includes(role);
}

export function assertWorkspaceActionAllowed(
  role: WorkspaceMembershipRole,
  action: WorkspaceAction
): void {
  if (canExecuteWorkspaceAction(role, action)) {
    return;
  }

  throw new ForbiddenException(workspaceActionDeniedMessages[action]);
}
