import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRequestTestContext,
  type RequestTestContext
} from './request-api.test-support';

test('GET /admin/members returns members only in the current workspace', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.users.push({
      id: 'user-3',
      email: 'manager@example.com',
      name: 'Manager User',
      passwordHash: context.state.users[0]!.passwordHash,
      emailVerifiedAt: new Date('2026-03-02T00:00:00.000Z'),
      createdAt: new Date('2026-03-02T00:00:00.000Z'),
      settings: {
        minimumReserveWon: 400_000,
        monthlySinkingFundWon: 140_000,
        timezone: 'Asia/Seoul'
      }
    });
    context.state.memberships.push({
      id: 'membership-3',
      tenantId: 'tenant-1',
      userId: 'user-3',
      role: 'MANAGER',
      status: 'ACTIVE',
      joinedAt: new Date('2026-03-02T00:00:00.000Z'),
      invitedByMembershipId: 'membership-1',
      lastAccessAt: null
    });

    const response = await context.request('/admin/members', {
      headers: context.authHeaders()
    });

    assert.equal(response.status, 200);
    assert.deepEqual(
      (response.body as Array<{ id: string; email: string }>).map((member) => ({
        id: member.id,
        email: member.email
      })),
      [
        {
          id: 'membership-1',
          email: 'demo@example.com'
        },
        {
          id: 'membership-3',
          email: 'manager@example.com'
        }
      ]
    );
  } finally {
    await context.close();
  }
});

test('GET /admin/members returns every tenant member for system admins', async () => {
  const context = await createRequestTestContext();

  try {
    addSystemAdminUser(context);

    const response = await context.request('/admin/members', {
      headers: context.authHeaders('system-admin-user')
    });

    assert.equal(response.status, 200);
    assert.deepEqual(
      (response.body as Array<{ id: string; tenant?: { id: string } }>).map(
        (member) => ({
          id: member.id,
          tenantId: member.tenant?.id
        })
      ),
      [
        {
          id: 'membership-1',
          tenantId: 'tenant-1'
        },
        {
          id: 'membership-2',
          tenantId: 'tenant-2'
        }
      ]
    );
  } finally {
    await context.close();
  }
});

test('GET /admin/tenants and /admin/users are restricted to system admins', async () => {
  const context = await createRequestTestContext();

  try {
    addSystemAdminUser(context);

    const deniedResponse = await context.request('/admin/tenants', {
      headers: context.authHeaders()
    });
    assert.equal(deniedResponse.status, 403);

    const tenantResponse = await context.request('/admin/tenants', {
      headers: context.authHeaders('system-admin-user')
    });
    assert.equal(tenantResponse.status, 200);
    assert.deepEqual(
      (
        tenantResponse.body as Array<{
          id: string;
          activeMemberCount: number;
        }>
      ).map((tenant) => ({
        id: tenant.id,
        activeMemberCount: tenant.activeMemberCount
      })),
      [
        {
          id: 'tenant-1',
          activeMemberCount: 1
        },
        {
          id: 'tenant-2',
          activeMemberCount: 1
        }
      ]
    );

    const userResponse = await context.request('/admin/users', {
      headers: context.authHeaders('system-admin-user')
    });
    assert.equal(userResponse.status, 200);
    assert.equal(
      (userResponse.body as Array<{ id: string; isSystemAdmin: boolean }>)[0]
        ?.id,
      'system-admin-user'
    );
    assert.equal(
      (userResponse.body as Array<{ id: string; isSystemAdmin: boolean }>)[0]
        ?.isSystemAdmin,
      true
    );
  } finally {
    await context.close();
  }
});

test('system admins can manage users, tenants, support context, and operations status', async () => {
  const context = await createRequestTestContext();

  try {
    addSystemAdminUser(context);

    const userDetailResponse = await context.request('/admin/users/user-2', {
      headers: context.authHeaders('system-admin-user')
    });
    assert.equal(userDetailResponse.status, 200);
    assert.equal(
      (userDetailResponse.body as { id: string; status: string }).status,
      'ACTIVE'
    );

    const lockResponse = await context.request('/admin/users/user-2/status', {
      method: 'PATCH',
      headers: context.authHeaders('system-admin-user'),
      body: {
        status: 'LOCKED',
        reason: '테스트 잠금'
      }
    });
    assert.equal(lockResponse.status, 200);
    assert.equal(
      (lockResponse.body as { status: string; lockedReason: string }).status,
      'LOCKED'
    );
    assert.equal(
      context.state.users.find((user) => user.id === 'user-2')?.lockedReason,
      '테스트 잠금'
    );

    const revokeResponse = await context.request(
      '/admin/users/user-2/revoke-sessions',
      {
        method: 'POST',
        headers: context.authHeaders('system-admin-user')
      }
    );
    assert.equal(revokeResponse.status, 201);
    assert.equal(
      (revokeResponse.body as { revokedCount: number }).revokedCount,
      1
    );

    const tenantDetailResponse = await context.request(
      '/admin/tenants/tenant-1',
      {
        headers: context.authHeaders('system-admin-user')
      }
    );
    assert.equal(tenantDetailResponse.status, 200);
    assert.equal(
      (tenantDetailResponse.body as { ledgerCount: number }).ledgerCount,
      1
    );

    const tenantStatusResponse = await context.request(
      '/admin/tenants/tenant-1/status',
      {
        method: 'PATCH',
        headers: context.authHeaders('system-admin-user'),
        body: {
          status: 'SUSPENDED'
        }
      }
    );
    assert.equal(tenantStatusResponse.status, 200);
    assert.equal(
      (tenantStatusResponse.body as { status: string }).status,
      'SUSPENDED'
    );

    const supportResponse = await context.request('/admin/support-context', {
      method: 'POST',
      headers: context.authHeaders('system-admin-user'),
      body: {
        tenantId: 'tenant-2',
        ledgerId: 'ledger-2'
      }
    });
    assert.equal(supportResponse.status, 201);
    assert.equal((supportResponse.body as { enabled: boolean }).enabled, true);

    const meResponse = await context.request('/auth/me', {
      headers: context.authHeaders('system-admin-user')
    });
    assert.equal(meResponse.status, 200);
    assert.equal(
      (
        meResponse.body as {
          currentWorkspace: {
            tenant: { id: string };
            supportContext?: unknown;
          };
        }
      ).currentWorkspace.tenant.id,
      'tenant-2'
    );

    const operationsResponse = await context.request(
      '/admin/operations/status',
      {
        headers: context.authHeaders('system-admin-user')
      }
    );
    assert.equal(operationsResponse.status, 200);
    assert.equal(
      (operationsResponse.body as { metrics: { totalUsers: number } }).metrics
        .totalUsers,
      3
    );
  } finally {
    await context.close();
  }
});

test('GET /admin/security-threats returns filtered threat events for system admins', async () => {
  const context = await createRequestTestContext();

  try {
    addSystemAdminUser(context);
    context.state.securityThreatEvents.push(
      {
        id: 'security-threat-event-1',
        severity: 'HIGH',
        eventCategory: 'AUTHENTICATION',
        eventName: 'auth.login_rate_limited',
        source: 'api',
        requestId: 'request-login-1',
        path: '/api/auth/login',
        clientIpHash: 'ip-hash-1',
        userId: null,
        sessionId: null,
        reason: 'too_many_attempts',
        metadata: {
          email: 'blocked@example.com',
          attempts: 8
        },
        occurredAt: new Date('2026-04-19T09:00:00.000Z')
      },
      {
        id: 'security-threat-event-2',
        severity: 'MEDIUM',
        eventCategory: 'REGISTRATION',
        eventName: 'auth.register_existing_email',
        source: 'api',
        requestId: 'request-register-1',
        path: '/api/auth/register',
        clientIpHash: 'ip-hash-2',
        userId: null,
        sessionId: null,
        reason: null,
        metadata: null,
        occurredAt: new Date('2026-04-19T08:00:00.000Z')
      }
    );

    const deniedResponse = await context.request('/admin/security-threats', {
      headers: context.authHeaders()
    });
    assert.equal(deniedResponse.status, 403);

    const response = await context.request(
      '/admin/security-threats?severity=HIGH',
      {
        headers: context.authHeaders('system-admin-user')
      }
    );

    assert.equal(response.status, 200);
    const body = response.body as {
      total: number;
      items: Array<{
        id: string;
        severity: string;
        eventCategory: string;
        eventName: string;
        requestId: string;
        clientIpHash: string;
        metadata: Record<string, string | number>;
      }>;
    };
    assert.equal(body.total, 1);
    assert.equal(body.items[0]?.id, 'security-threat-event-1');
    assert.equal(body.items[0]?.severity, 'HIGH');
    assert.equal(body.items[0]?.eventCategory, 'AUTHENTICATION');
    assert.equal(body.items[0]?.eventName, 'auth.login_rate_limited');
    assert.equal(body.items[0]?.requestId, 'request-login-1');
    assert.equal(body.items[0]?.clientIpHash, 'ip-hash-1');
    assert.deepEqual(body.items[0]?.metadata, {
      email: 'blocked@example.com',
      attempts: 8
    });
  } finally {
    await context.close();
  }
});

test('PATCH /admin/members/:membershipId/role lets system admins manage another tenant', async () => {
  const context = await createRequestTestContext();

  try {
    addSystemAdminUser(context);
    context.state.memberships.push({
      id: 'membership-system-owner-backstop',
      tenantId: 'tenant-2',
      userId: 'user-1',
      role: 'OWNER',
      status: 'ACTIVE',
      joinedAt: new Date('2026-03-03T00:00:00.000Z'),
      invitedByMembershipId: null,
      lastAccessAt: null
    });

    const response = await context.request('/admin/members/membership-2/role', {
      method: 'PATCH',
      headers: context.authHeaders('system-admin-user'),
      body: {
        role: 'MANAGER'
      }
    });

    assert.equal(response.status, 200);
    assert.equal(
      context.state.memberships.find(
        (membership) => membership.id === 'membership-2'
      )?.role,
      'MANAGER'
    );
    assert.equal(
      context.state.workspaceAuditEvents.some(
        (event) =>
          event.action === 'admin_member.update_role' &&
          event.actorUserId === 'system-admin-user' &&
          event.actorRole === 'SYSTEM_ADMIN' &&
          event.tenantId === 'tenant-2'
      ),
      true
    );
  } finally {
    await context.close();
  }
});

test('POST /admin/members/invitations sends an invitation and records an audit event', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/admin/members/invitations', {
      method: 'POST',
      headers: context.authHeaders(),
      body: {
        email: 'other@example.com',
        role: 'EDITOR'
      }
    });

    assert.equal(response.status, 201);
    assert.equal(
      (response.body as { email: string; role: string }).email,
      'other@example.com'
    );
    assert.equal(
      (response.body as { email: string; role: string }).role,
      'EDITOR'
    );
    assert.equal(context.state.sentEmails.length, 1);
    assert.equal(context.state.sentEmails[0]?.to, 'other@example.com');
    assert.match(
      context.state.sentEmails[0]?.text ?? '',
      /accept-invitation\?token=/
    );
    assert.equal(context.state.tenantMembershipInvitations.length, 1);
    assert.doesNotMatch(
      context.state.tenantMembershipInvitations[0]?.tokenHash ?? '',
      /accept-invitation/
    );
    assert.equal(
      context.state.memberships.some(
        (membership) =>
          membership.tenantId === 'tenant-1' &&
          membership.userId === 'user-2' &&
          membership.status === 'INVITED' &&
          membership.role === 'EDITOR'
      ),
      true
    );
    assert.equal(
      context.state.workspaceAuditEvents.some(
        (event) =>
          event.action === 'admin_member.invite' &&
          event.result === 'SUCCESS' &&
          event.resourceId === context.state.tenantMembershipInvitations[0]?.id
      ),
      true
    );

    const token = readInvitationToken(context.state.sentEmails[0]?.text);
    const acceptResponse = await context.request('/auth/accept-invitation', {
      method: 'POST',
      body: { token }
    });

    assert.equal(acceptResponse.status, 200);
    assert.deepEqual(acceptResponse.body, { status: 'accepted' });
    assert.equal(
      context.state.memberships.some(
        (membership) =>
          membership.tenantId === 'tenant-1' &&
          membership.userId === 'user-2' &&
          membership.status === 'ACTIVE' &&
          membership.role === 'EDITOR'
      ),
      true
    );
    assert.ok(context.state.tenantMembershipInvitations[0]?.acceptedAt);
  } finally {
    await context.close();
  }
});

function readInvitationToken(text: string | undefined): string {
  assert.ok(text);
  const match = text.match(/token=([A-Za-z0-9_-]+)/);
  assert.ok(match?.[1]);
  return match[1];
}

function addSystemAdminUser(context: RequestTestContext) {
  context.state.users.push({
    id: 'system-admin-user',
    email: 'system-admin@example.com',
    name: 'System Admin',
    passwordHash: context.state.users[0]!.passwordHash,
    isSystemAdmin: true,
    emailVerifiedAt: new Date('2026-03-02T00:00:00.000Z'),
    createdAt: new Date('2026-03-02T00:00:00.000Z'),
    settings: {
      minimumReserveWon: 400_000,
      monthlySinkingFundWon: 140_000,
      timezone: 'Asia/Seoul'
    }
  });
  context.state.authSessions.push({
    id: 'session-system-admin-user',
    userId: 'system-admin-user',
    refreshTokenHash: 'existing-session-hash',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    revokedAt: null,
    createdAt: new Date('2026-03-02T00:00:00.000Z'),
    updatedAt: new Date('2026-03-02T00:00:00.000Z')
  });
}

test('PATCH /admin/members/:membershipId/role updates a member role and exposes the audit log', async () => {
  const context = await createRequestTestContext();

  try {
    context.state.users.push({
      id: 'user-3',
      email: 'manager@example.com',
      name: 'Manager User',
      passwordHash: context.state.users[0]!.passwordHash,
      emailVerifiedAt: new Date('2026-03-02T00:00:00.000Z'),
      createdAt: new Date('2026-03-02T00:00:00.000Z')
    });
    context.state.memberships.push({
      id: 'membership-3',
      tenantId: 'tenant-1',
      userId: 'user-3',
      role: 'MANAGER',
      status: 'ACTIVE',
      joinedAt: new Date('2026-03-02T00:00:00.000Z'),
      invitedByMembershipId: 'membership-1',
      lastAccessAt: null
    });

    const updateResponse = await context.request(
      '/admin/members/membership-3/role',
      {
        method: 'PATCH',
        headers: context.authHeaders(),
        body: {
          role: 'EDITOR'
        }
      }
    );

    assert.equal(updateResponse.status, 200);
    assert.equal(
      (updateResponse.body as { id: string; role: string }).role,
      'EDITOR'
    );
    assert.equal(
      context.state.memberships.find(
        (membership) => membership.id === 'membership-3'
      )?.role,
      'EDITOR'
    );

    const auditResponse = await context.request(
      '/admin/audit-events?action=admin_member.update_role',
      {
        headers: context.authHeaders()
      }
    );

    assert.equal(auditResponse.status, 200);
    const auditBody = auditResponse.body as {
      total: number;
      items: Array<{
        action: string;
        resourceId: string;
        result: string;
        metadata: Record<string, string>;
      }>;
    };
    assert.equal(auditBody.total, 1);
    assert.equal(auditBody.items[0]?.action, 'admin_member.update_role');
    assert.equal(auditBody.items[0]?.resourceId, 'membership-3');
    assert.equal(auditBody.items[0]?.result, 'SUCCESS');
    assert.deepEqual(auditBody.items[0]?.metadata, {
      previousRole: 'MANAGER',
      nextRole: 'EDITOR'
    });
  } finally {
    await context.close();
  }
});

test('PATCH /admin/members/:membershipId/role blocks demoting the last active owner', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/admin/members/membership-1/role', {
      method: 'PATCH',
      headers: context.authHeaders(),
      body: {
        role: 'MANAGER'
      }
    });

    assert.equal(response.status, 400);
    assert.equal(
      (response.body as { message: string }).message,
      '최소 1명의 활성 소유자가 남아 있어야 합니다.'
    );
    assert.equal(
      context.state.memberships.find(
        (membership) => membership.id === 'membership-1'
      )?.role,
      'OWNER'
    );
  } finally {
    await context.close();
  }
});

test('GET /admin/audit-events records a denied event for non-owner users', async () => {
  const context = await createRequestTestContext();

  try {
    const ownerMembership = context.state.memberships.find(
      (membership) => membership.id === 'membership-1'
    );
    assert.ok(ownerMembership);
    ownerMembership.role = 'VIEWER';

    const response = await context.request('/admin/audit-events', {
      headers: context.authHeaders()
    });

    assert.equal(response.status, 403);
    assert.equal(
      context.state.workspaceAuditEvents.some(
        (event) =>
          event.eventName === 'authorization.action_denied' &&
          event.action === 'admin_audit_log.read' &&
          event.result === 'DENIED'
      ),
      true
    );
  } finally {
    await context.close();
  }
});

test('GET /admin/policy returns the current policy summary for owners and managers', async () => {
  const context = await createRequestTestContext();

  try {
    const response = await context.request('/admin/policy', {
      headers: context.authHeaders()
    });

    assert.equal(response.status, 200);
    const body = response.body as {
      items: Array<{ key: string; allowedRoles: string[] }>;
    };
    assert.equal(
      body.items.some((item) => item.key === 'settings-workspace'),
      true
    );
    assert.equal(
      body.items.some(
        (item) =>
          item.key === 'admin-logs' && item.allowedRoles.includes('OWNER')
      ),
      true
    );
    assert.equal(
      body.items.some(
        (item) =>
          item.key === 'reference-data-lookups' &&
          item.allowedRoles.includes('VIEWER')
      ),
      true
    );
  } finally {
    await context.close();
  }
});

test('GET /admin/navigation inherits legacy policies for newly split child menus', async () => {
  const context = await createRequestTestContext();

  try {
    const seedResponse = await context.request('/admin/navigation', {
      headers: context.authHeaders()
    });
    assert.equal(seedResponse.status, 200);

    setMenuPolicy(context, 'settings-account', {
      isVisible: false,
      roles: ['OWNER']
    });
    setMenuPolicy(context, 'reference-data-manage', {
      isVisible: false,
      roles: ['OWNER']
    });
    setMenuPolicy(context, 'plan-items', {
      isVisible: false,
      roles: ['OWNER']
    });

    removeMenuItemByKey(context, 'settings-account-password');
    removeMenuItemByKey(context, 'settings-account-sessions');
    removeMenuItemByKey(context, 'settings-account-events');
    removeMenuItemByKey(context, 'reference-data-categories');
    removeMenuItemByKey(context, 'reference-data-lookups');
    removeMenuItemByKey(context, 'plan-items-generate');

    const response = await context.request('/admin/navigation', {
      headers: context.authHeaders()
    });
    assert.equal(response.status, 200);

    const body = response.body as { items: NavigationTreeItem[] };
    const itemsByKey = new Map(
      flattenNavigationItems(body.items).map((item) => [item.key, item])
    );

    assertInheritedMenu(itemsByKey, 'settings-account-password');
    assertInheritedMenu(itemsByKey, 'settings-account-sessions');
    assertInheritedMenu(itemsByKey, 'settings-account-events');
    assertInheritedMenu(itemsByKey, 'reference-data-categories');
    assertInheritedMenu(itemsByKey, 'reference-data-lookups');
    assertInheritedMenu(itemsByKey, 'plan-items-generate');
  } finally {
    await context.close();
  }
});

type NavigationTreeItem = {
  key: string;
  isVisible: boolean;
  allowedRoles: string[];
  children: NavigationTreeItem[];
};

function flattenNavigationItems(
  items: NavigationTreeItem[]
): NavigationTreeItem[] {
  return items.flatMap((item) => [
    item,
    ...flattenNavigationItems(item.children)
  ]);
}

function removeMenuItemByKey(context: RequestTestContext, key: string) {
  const item = context.state.workspaceNavigationMenuItems.find(
    (candidate) => candidate.key === key
  );
  assert.ok(item);

  context.state.workspaceNavigationMenuItems =
    context.state.workspaceNavigationMenuItems.filter(
      (candidate) => candidate.id !== item.id
    );
  context.state.workspaceNavigationMenuRoles =
    context.state.workspaceNavigationMenuRoles.filter(
      (candidate) => candidate.menuItemId !== item.id
    );
}

function setMenuPolicy(
  context: RequestTestContext,
  key: string,
  input: {
    isVisible: boolean;
    roles: RequestTestContext['state']['workspaceNavigationMenuRoles'][number]['role'][];
  }
) {
  const item = context.state.workspaceNavigationMenuItems.find(
    (candidate) => candidate.key === key
  );
  assert.ok(item);

  item.isVisible = input.isVisible;
  context.state.workspaceNavigationMenuRoles =
    context.state.workspaceNavigationMenuRoles.filter(
      (candidate) => candidate.menuItemId !== item.id
    );
  context.state.workspaceNavigationMenuRoles.push(
    ...input.roles.map((role) => ({
      menuItemId: item.id,
      role
    }))
  );
}

function assertInheritedMenu(
  itemsByKey: Map<string, NavigationTreeItem>,
  key: string
) {
  const item = itemsByKey.get(key);
  assert.ok(
    item,
    `Missing menu key ${key}. Keys: ${Array.from(itemsByKey.keys()).join(', ')}`
  );
  assert.equal(item.isVisible, false);
  assert.deepEqual(item.allowedRoles, ['OWNER']);
}
