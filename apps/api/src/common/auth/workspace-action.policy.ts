import { ForbiddenException } from '@nestjs/common';
import type { RequiredWorkspaceContext } from './required-workspace.util';

export type WorkspaceMembershipRole =
  RequiredWorkspaceContext['membershipRole'];

export type WorkspaceAction =
  | 'accounting_period.open'
  | 'accounting_period.close'
  | 'accounting_period.reopen'
  | 'recurring_rule.create'
  | 'plan_item.generate'
  | 'collected_transaction.create'
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
  'accounting_period.open': ['OWNER', 'MANAGER'],
  'accounting_period.close': ['OWNER'],
  'accounting_period.reopen': ['OWNER'],
  'recurring_rule.create': ['OWNER', 'MANAGER'],
  'plan_item.generate': ['OWNER', 'MANAGER'],
  'collected_transaction.create': ['OWNER', 'MANAGER', 'EDITOR'],
  'collected_transaction.confirm': ['OWNER', 'MANAGER', 'EDITOR'],
  'financial_statement.generate': ['OWNER', 'MANAGER'],
  'carry_forward.generate': ['OWNER', 'MANAGER'],
  'journal_entry.reverse': ['OWNER', 'MANAGER'],
  'journal_entry.correct': ['OWNER', 'MANAGER'],
  'import_batch.upload': ['OWNER', 'MANAGER', 'EDITOR']
};

const workspaceActionDeniedMessages: Record<WorkspaceAction, string> = {
  'accounting_period.open':
    'Only owners and managers can open accounting periods.',
  'accounting_period.close':
    'Only owners can close accounting periods.',
  'accounting_period.reopen':
    'Only owners can reopen accounting periods.',
  'recurring_rule.create':
    'Only owners and managers can create recurring rules.',
  'plan_item.generate':
    'Only owners and managers can generate plan items.',
  'collected_transaction.create':
    'Only owners, managers, and editors can create collected transactions.',
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
