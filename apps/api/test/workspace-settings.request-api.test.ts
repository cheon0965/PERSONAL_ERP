import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequestTestContext } from './request-api.test-support';

test('GET /settings/workspace returns the current workspace settings', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/settings/workspace', {
      headers: context.authHeaders()
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      tenant: {
        id: 'tenant-1',
        name: 'Demo Workspace',
        slug: 'demo-tenant',
        status: 'ACTIVE'
      },
      ledger: {
        id: 'ledger-1',
        name: '사업 장부',
        baseCurrency: 'KRW',
        timezone: 'Asia/Seoul',
        status: 'ACTIVE',
        openedFromYearMonth: '2026-01',
        closedThroughYearMonth: null
      },
      membershipRole: 'OWNER',
      canManage: true
    });
  } finally {
    await context.close();
  }
});

test('PATCH /settings/workspace updates tenant and default ledger settings', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/settings/workspace', {
      method: 'PATCH',
      headers: context.authHeaders(),
      body: {
        tenantName: 'Ops Workspace',
        tenantSlug: 'ops-workspace',
        tenantStatus: 'SUSPENDED',
        ledgerName: '운영 장부',
        baseCurrency: 'USD',
        timezone: 'Asia/Tokyo'
      }
    });

    assert.equal(response.status, 200);
    assert.equal(context.state.tenants[0]?.name, 'Ops Workspace');
    assert.equal(context.state.tenants[0]?.slug, 'ops-workspace');
    assert.equal(context.state.tenants[0]?.status, 'SUSPENDED');
    assert.equal(context.state.ledgers[0]?.name, '운영 장부');
    assert.equal(context.state.ledgers[0]?.baseCurrency, 'USD');
    assert.equal(context.state.ledgers[0]?.timezone, 'Asia/Tokyo');
    assert.equal(
      context.state.workspaceAuditEvents.some(
        (event) =>
          event.action === 'workspace_settings.update' &&
          event.result === 'SUCCESS'
      ),
      true
    );

    const meResponse = await context.request('/auth/me', {
      headers: context.authHeaders()
    });
    assert.equal(
      (meResponse.body as { currentWorkspace: { tenant: { name: string } } })
        .currentWorkspace.tenant.name,
      'Ops Workspace'
    );
  } finally {
    await context.close();
  }
});

test('PATCH /settings/workspace denies viewers', async () => {
  const context = await createRequestTestContext();

  try {
    const membership = context.state.memberships.find(
      (candidate) => candidate.id === 'membership-1'
    );
    assert.ok(membership);
    membership.role = 'VIEWER';

    const response = await context.request('/settings/workspace', {
      method: 'PATCH',
      headers: context.authHeaders(),
      body: {
        tenantName: 'Blocked Workspace',
        tenantSlug: 'blocked-workspace',
        tenantStatus: 'ACTIVE',
        ledgerName: '차단 장부',
        baseCurrency: 'KRW',
        timezone: 'Asia/Seoul'
      }
    });

    assert.equal(response.status, 403);
    assert.equal(
      context.state.workspaceAuditEvents.some(
        (event) =>
          event.action === 'workspace_settings.update' &&
          event.result === 'DENIED'
      ),
      true
    );
  } finally {
    await context.close();
  }
});
