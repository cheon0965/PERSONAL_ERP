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
    deletedTenantIds: [] as string[],
    deletedUserId: null as string | null
  };
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
        input.nonDemoMemberCountsByTenantId[args.where.tenantId] ?? 0
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
  assert.deepEqual(state.deletedTenantIds, ['demo-tenant']);
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
  assert.deepEqual(state.deletedTenantIds, []);
  assert.equal(state.deletedUserId, null);
});
