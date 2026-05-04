import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { resetDemoUserAndOwnedWorkspaces } from '../prisma/demo-reset';

type DemoUserFixture = {
  id: string;
  memberships: Array<{
    tenantId: string;
  }>;
};

type TenantIdFilterArgs = {
  where: {
    id: {
      in: string[];
    };
  };
};

function createResetPrismaMock(input: {
  demoUser: DemoUserFixture | null;
  nonDemoMemberCountsByTenantId: Record<string, number>;
}) {
  const state = {
    defaultLedgerClearedTenantIds: [] as string[],
    cleanupCalls: [] as string[],
    deletedTenantIds: [] as string[],
    foreignKeyCheckStatements: [] as string[],
    deletedUserId: null as string | null
  };
  const createCleanupDelegate = (modelName: string) => ({
    deleteMany: async () => {
      state.cleanupCalls.push(modelName);
      return { count: 1 };
    }
  });
  const transactionClient = {
    user: {
      findUnique: async () => input.demoUser,
      delete: async (args: { where: { id: string } }) => {
        state.deletedUserId = args.where.id;
        return input.demoUser;
      }
    },
    tenantMembership: {
      count: async (args: { where: { tenantId: string } }) =>
        input.nonDemoMemberCountsByTenantId[args.where.tenantId] ?? 0,
      deleteMany: async () => {
        state.cleanupCalls.push('tenantMembership');
        return { count: 1 };
      }
    },
    tenant: {
      updateMany: async (args: TenantIdFilterArgs) => {
        state.defaultLedgerClearedTenantIds.push(...args.where.id.in);
        return { count: args.where.id.in.length };
      },
      deleteMany: async (args: TenantIdFilterArgs) => {
        state.deletedTenantIds.push(...args.where.id.in);
        return { count: args.where.id.in.length };
      }
    },
    importBatchCollectionJobRow: createCleanupDelegate(
      'importBatchCollectionJobRow'
    ),
    importBatchCollectionLock: createCleanupDelegate(
      'importBatchCollectionLock'
    ),
    importBatchCollectionJob: createCleanupDelegate('importBatchCollectionJob'),
    workspaceNavigationMenuRole: createCleanupDelegate(
      'workspaceNavigationMenuRole'
    ),
    workspaceNavigationMenuItem: {
      findMany: async () => [
        { id: 'nav-root', parentId: null },
        { id: 'nav-child', parentId: 'nav-root' },
        { id: 'nav-grandchild', parentId: 'nav-child' }
      ],
      deleteMany: async (args: { where: { id: { in: string[] } } }) => {
        state.cleanupCalls.push(
          `workspaceNavigationMenuItem:${args.where.id.in.join(',')}`
        );
        return { count: args.where.id.in.length };
      }
    },
    balanceSnapshotLine: createCleanupDelegate('balanceSnapshotLine'),
    journalLine: createCleanupDelegate('journalLine'),
    liabilityRepaymentSchedule: createCleanupDelegate(
      'liabilityRepaymentSchedule'
    ),
    fuelLog: createCleanupDelegate('fuelLog'),
    vehicleMaintenanceLog: createCleanupDelegate('vehicleMaintenanceLog'),
    carryForwardRecord: createCleanupDelegate('carryForwardRecord'),
    financialStatementSnapshot: createCleanupDelegate(
      'financialStatementSnapshot'
    ),
    closingSnapshot: createCleanupDelegate('closingSnapshot'),
    openingBalanceSnapshot: createCleanupDelegate('openingBalanceSnapshot'),
    workspaceOperationalNote: createCleanupDelegate('workspaceOperationalNote'),
    journalEntry: createCleanupDelegate('journalEntry'),
    liabilityAgreement: createCleanupDelegate('liabilityAgreement'),
    vehicle: createCleanupDelegate('vehicle'),
    insurancePolicy: createCleanupDelegate('insurancePolicy'),
    collectedTransaction: createCleanupDelegate('collectedTransaction'),
    planItem: createCleanupDelegate('planItem'),
    importedRow: createCleanupDelegate('importedRow'),
    importBatch: createCleanupDelegate('importBatch'),
    recurringRule: createCleanupDelegate('recurringRule'),
    periodStatusHistory: createCleanupDelegate('periodStatusHistory'),
    accountingPeriod: createCleanupDelegate('accountingPeriod'),
    accountSubject: createCleanupDelegate('accountSubject'),
    ledgerTransactionType: createCleanupDelegate('ledgerTransactionType'),
    category: createCleanupDelegate('category'),
    account: createCleanupDelegate('account'),
    ledger: createCleanupDelegate('ledger'),
    tenantMembershipInvitation: createCleanupDelegate(
      'tenantMembershipInvitation'
    ),
    workspaceAuditEvent: createCleanupDelegate('workspaceAuditEvent'),
    $executeRaw: async (query: TemplateStringsArray) => {
      state.foreignKeyCheckStatements.push(query[0] ?? '');
      return 0;
    }
  };
  const prisma = {
    $transaction: async <T>(
      callback: (tx: typeof transactionClient) => Promise<T>
    ) => callback(transactionClient)
  } as unknown as PrismaClient;

  return { prisma, state };
}

test('resetDemoUserAndOwnedWorkspaces deletes only demo-owned tenants', async () => {
  const { prisma, state } = createResetPrismaMock({
    demoUser: {
      id: 'demo-user',
      memberships: [{ tenantId: 'demo-tenant' }, { tenantId: 'shared-tenant' }]
    },
    nonDemoMemberCountsByTenantId: {
      'demo-tenant': 0,
      'shared-tenant': 1
    }
  });

  const summary = await resetDemoUserAndOwnedWorkspaces(
    prisma,
    'demo@example.com'
  );

  assert.deepEqual(summary.deletedTenantIds, ['demo-tenant']);
  assert.deepEqual(summary.protectedTenantIds, ['shared-tenant']);
  assert.deepEqual(state.defaultLedgerClearedTenantIds, ['demo-tenant']);
  assert.deepEqual(state.cleanupCalls, [
    'importBatchCollectionJobRow',
    'importBatchCollectionLock',
    'importBatchCollectionJob',
    'workspaceNavigationMenuRole',
    'workspaceNavigationMenuItem:nav-grandchild',
    'workspaceNavigationMenuItem:nav-child',
    'workspaceNavigationMenuItem:nav-root',
    'balanceSnapshotLine',
    'journalLine',
    'liabilityRepaymentSchedule',
    'fuelLog',
    'vehicleMaintenanceLog',
    'carryForwardRecord',
    'financialStatementSnapshot',
    'closingSnapshot',
    'openingBalanceSnapshot',
    'workspaceOperationalNote',
    'journalEntry',
    'liabilityAgreement',
    'vehicle',
    'insurancePolicy',
    'collectedTransaction',
    'planItem',
    'importedRow',
    'importBatch',
    'recurringRule',
    'periodStatusHistory',
    'accountingPeriod',
    'accountSubject',
    'ledgerTransactionType',
    'category',
    'account',
    'ledger',
    'tenantMembershipInvitation',
    'tenantMembership',
    'workspaceAuditEvent'
  ]);
  assert.deepEqual(state.deletedTenantIds, ['demo-tenant']);
  assert.deepEqual(state.foreignKeyCheckStatements, [
    'SET FOREIGN_KEY_CHECKS = 0',
    'SET FOREIGN_KEY_CHECKS = 1'
  ]);
  assert.equal(state.deletedUserId, 'demo-user');
});

test('resetDemoUserAndOwnedWorkspaces is a no-op when demo user is missing', async () => {
  const { prisma, state } = createResetPrismaMock({
    demoUser: null,
    nonDemoMemberCountsByTenantId: {}
  });

  const summary = await resetDemoUserAndOwnedWorkspaces(
    prisma,
    'demo@example.com'
  );

  assert.equal(summary.userDeleted, false);
  assert.deepEqual(summary.deletedTenantIds, []);
  assert.deepEqual(summary.protectedTenantIds, []);
  assert.deepEqual(state.cleanupCalls, []);
  assert.deepEqual(state.foreignKeyCheckStatements, []);
  assert.deepEqual(state.deletedTenantIds, []);
  assert.equal(state.deletedUserId, null);
});
