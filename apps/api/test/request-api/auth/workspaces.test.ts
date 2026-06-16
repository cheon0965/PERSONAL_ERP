import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequestTestContext } from '../../support/request-api/index';
import { addWorkspaceFixture } from './fixtures';

test('GET /auth/workspaces returns active workspace memberships with current marker', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.memberships.push({
      id: 'membership-user-1-other',
      tenantId: 'tenant-2',
      userId: 'user-1',
      role: 'VIEWER',
      status: 'ACTIVE',
      joinedAt: new Date('2026-03-15T00:00:00.000Z'),
      invitedByMembershipId: 'membership-2',
      lastAccessAt: null
    });

    const response = await context.request('/auth/workspaces', {
      headers: context.authHeaders()
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      items: [
        {
          tenant: {
            id: 'tenant-1',
            slug: 'demo-tenant',
            name: 'Demo Workspace',
            status: 'ACTIVE'
          },
          membership: {
            id: 'membership-1',
            role: 'OWNER',
            status: 'ACTIVE'
          },
          ledger: {
            id: 'ledger-1',
            name: '사업 장부',
            baseCurrency: 'KRW',
            timezone: 'Asia/Seoul',
            status: 'ACTIVE'
          },
          isCurrent: true
        },
        {
          tenant: {
            id: 'tenant-2',
            slug: 'other-tenant',
            name: 'Other Workspace',
            status: 'ACTIVE'
          },
          membership: {
            id: 'membership-user-1-other',
            role: 'VIEWER',
            status: 'ACTIVE'
          },
          ledger: {
            id: 'ledger-2',
            name: 'Other Ledger',
            baseCurrency: 'KRW',
            timezone: 'Asia/Seoul',
            status: 'ACTIVE'
          },
          isCurrent: false
        }
      ]
    });
    assert.equal(response.headers.get('cache-control'), 'no-store');
  } finally {
    await context.close();
  }
});

test('POST /auth/workspaces creates an additional owner workspace and switches the session', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/auth/workspaces', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        tenantName: 'Second Workspace',
        tenantSlug: 'second-workspace',
        ledgerName: 'Second Ledger',
        baseCurrency: 'KRW',
        timezone: 'Asia/Seoul',
        openedFromYearMonth: '2026-05'
      }
    });

    assert.equal(response.status, 201);

    const createdTenant = context.state.tenants.find(
      (candidate) => candidate.slug === 'second-workspace'
    );
    assert.ok(createdTenant);

    const createdLedger = context.state.ledgers.find(
      (candidate) => candidate.tenantId === createdTenant.id
    );
    assert.ok(createdLedger);
    assert.equal(createdLedger.name, 'Second Ledger');
    assert.equal(createdTenant.defaultLedgerId, createdLedger.id);

    const createdMembership = context.state.memberships.find(
      (candidate) =>
        candidate.tenantId === createdTenant.id && candidate.userId === 'user-1'
    );
    assert.ok(createdMembership);
    assert.equal(createdMembership.role, 'OWNER');
    assert.equal(createdMembership.status, 'ACTIVE');

    assert.equal(
      context.state.authSessions.find(
        (candidate) => candidate.id === 'session-user-1'
      )?.currentTenantId,
      createdTenant.id
    );
    assert.equal(
      context.state.authSessions.find(
        (candidate) => candidate.id === 'session-user-1'
      )?.currentLedgerId,
      createdLedger.id
    );

    assert.equal(
      (
        response.body as {
          user: { currentWorkspace: { tenant: { slug: string } } };
        }
      ).user.currentWorkspace.tenant.slug,
      'second-workspace'
    );
    assert.equal(
      (
        response.body as {
          workspaces: Array<{ tenant: { slug: string }; isCurrent: boolean }>;
        }
      ).workspaces.find(
        (workspace) => workspace.tenant.slug === 'second-workspace'
      )?.isCurrent,
      true
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'auth.workspace_created' &&
          candidate.details.tenantId === createdTenant.id
      )
    );
  } finally {
    await context.close();
  }
});

test('DELETE /auth/workspaces/:tenantId removes an owner workspace and switches away when current', async () => {
  const context = await createRequestTestContext();

  try {
    const workspace = addWorkspaceFixture(context.state, {
      tenantSlug: 'delete-workspace',
      tenantName: 'Delete Workspace'
    });
    const session = context.state.authSessions.find(
      (candidate) => candidate.id === 'session-user-1'
    );
    assert.ok(session);
    session.currentTenantId = workspace.tenantId;
    session.currentLedgerId = workspace.ledgerId;

    const response = await context.request(
      `/auth/workspaces/${workspace.tenantId}`,
      {
        method: 'DELETE',
        headers: context.authHeaders()
      }
    );

    assert.equal(response.status, 200);
    assert.equal(
      context.state.tenants.some(
        (candidate) => candidate.id === workspace.tenantId
      ),
      false
    );
    assert.equal(
      context.state.ledgers.some(
        (candidate) => candidate.id === workspace.ledgerId
      ),
      false
    );
    assert.equal(
      context.state.memberships.some(
        (candidate) => candidate.id === workspace.membershipId
      ),
      false
    );
    assert.equal(
      context.state.authSessions.find(
        (candidate) => candidate.id === 'session-user-1'
      )?.currentTenantId,
      'tenant-1'
    );
    assert.equal(
      context.state.authSessions.find(
        (candidate) => candidate.id === 'session-user-1'
      )?.currentLedgerId,
      'ledger-1'
    );
    assert.equal(
      (
        response.body as {
          user: { currentWorkspace: { tenant: { id: string } } };
        }
      ).user.currentWorkspace.tenant.id,
      'tenant-1'
    );
    assert.equal(
      (
        response.body as {
          workspaces: Array<{ tenant: { id: string }; isCurrent: boolean }>;
        }
      ).workspaces.find((item) => item.tenant.id === 'tenant-1')?.isCurrent,
      true
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'auth.workspace_deleted' &&
          candidate.details.tenantId === workspace.tenantId
      )
    );
  } finally {
    await context.close();
  }
});

test('DELETE /auth/workspaces/:tenantId rejects the last active workspace for the user', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/auth/workspaces/tenant-1', {
      method: 'DELETE',
      headers: context.authHeaders()
    });

    assert.equal(response.status, 400);
    assert.equal(
      context.state.tenants.some((candidate) => candidate.id === 'tenant-1'),
      true
    );
  } finally {
    await context.close();
  }
});

test('DELETE /auth/workspaces/:tenantId rejects non-owner membership', async () => {
  const context = await createRequestTestContext();

  try {
    const workspace = addWorkspaceFixture(context.state, {
      tenantId: 'tenant-delete-viewer',
      tenantSlug: 'delete-viewer',
      ledgerId: 'ledger-delete-viewer',
      membershipId: 'membership-delete-viewer',
      role: 'VIEWER'
    });

    const response = await context.request(
      `/auth/workspaces/${workspace.tenantId}`,
      {
        method: 'DELETE',
        headers: context.authHeaders()
      }
    );

    assert.equal(response.status, 403);
    assert.equal(
      context.state.tenants.some(
        (candidate) => candidate.id === workspace.tenantId
      ),
      true
    );
  } finally {
    await context.close();
  }
});

test('DELETE /auth/workspaces/:tenantId rejects deletion while other active members remain', async () => {
  const context = await createRequestTestContext();

  try {
    const workspace = addWorkspaceFixture(context.state, {
      tenantId: 'tenant-delete-shared',
      tenantSlug: 'delete-shared',
      ledgerId: 'ledger-delete-shared',
      membershipId: 'membership-delete-shared'
    });
    context.state.memberships.push({
      id: 'membership-delete-shared-other',
      tenantId: workspace.tenantId,
      userId: 'user-2',
      role: 'VIEWER',
      status: 'ACTIVE',
      joinedAt: new Date('2026-03-16T00:00:00.000Z'),
      invitedByMembershipId: workspace.membershipId,
      lastAccessAt: null
    });

    const response = await context.request(
      `/auth/workspaces/${workspace.tenantId}`,
      {
        method: 'DELETE',
        headers: context.authHeaders()
      }
    );

    assert.equal(response.status, 409);
    assert.equal(
      context.state.tenants.some(
        (candidate) => candidate.id === workspace.tenantId
      ),
      true
    );
  } finally {
    await context.close();
  }
});

test('POST /auth/current-workspace stores the selected workspace on the current session', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.memberships.push({
      id: 'membership-user-1-other',
      tenantId: 'tenant-2',
      userId: 'user-1',
      role: 'VIEWER',
      status: 'ACTIVE',
      joinedAt: new Date('2026-03-15T00:00:00.000Z'),
      invitedByMembershipId: 'membership-2',
      lastAccessAt: null
    });

    const switchResponse = await context.request('/auth/current-workspace', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        tenantId: 'tenant-2'
      }
    });

    assert.equal(switchResponse.status, 201);
    assert.equal(
      (
        switchResponse.body as {
          user: { currentWorkspace: { tenant: { id: string } } };
        }
      ).user.currentWorkspace.tenant.id,
      'tenant-2'
    );
    assert.equal(
      context.state.authSessions.find(
        (candidate) => candidate.id === 'session-user-1'
      )?.currentTenantId,
      'tenant-2'
    );

    const meResponse = await context.request('/auth/me', {
      headers: context.authHeaders()
    });

    assert.equal(meResponse.status, 200);
    assert.equal(
      (meResponse.body as { currentWorkspace: { tenant: { id: string } } })
        .currentWorkspace.tenant.id,
      'tenant-2'
    );
    assert.equal(
      (
        meResponse.body as {
          currentWorkspace: { membership: { role: string } };
        }
      ).currentWorkspace.membership.role,
      'VIEWER'
    );
    assert.ok(
      context.securityEvents.some(
        (candidate) =>
          candidate.level === 'log' &&
          candidate.event === 'auth.workspace_switched' &&
          candidate.details.tenantId === 'tenant-2'
      )
    );
  } finally {
    await context.close();
  }
});

test('POST /auth/current-workspace rejects a workspace without active membership', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/auth/current-workspace', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        tenantId: 'tenant-2'
      }
    });

    assert.equal(response.status, 403);
  } finally {
    await context.close();
  }
});
