import assert from 'node:assert/strict';
import test from 'node:test';

process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api';
process.env.NEXT_PUBLIC_ENABLE_DEMO_FALLBACK = 'false';

type CapturedRequest = {
  url: string;
  method: string | undefined;
  credentials: RequestCredentials | undefined;
  cache: RequestCache | undefined;
  contentType: string | null;
  body: unknown;
};

test('auth API helpers call the registration and verification endpoints', async () => {
  const capturedRequests: CapturedRequest[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    const rawBody = typeof init?.body === 'string' ? init.body : null;
    capturedRequests.push({
      url: String(input),
      method: init?.method,
      credentials: init?.credentials,
      cache: init?.cache,
      contentType: headers.get('Content-Type'),
      body: rawBody ? (JSON.parse(rawBody) as unknown) : null
    });

    const path = new URL(String(input)).pathname;
    const responseBody = path.endsWith('/verify-email')
      ? { status: 'verified' }
      : path.endsWith('/accept-invitation')
        ? { status: 'accepted' }
        : { status: 'verification_sent' };

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    const {
      acceptInvitation,
      registerWithPassword,
      resendVerificationEmail,
      verifyEmail
    } = await import('../src/features/auth/auth.api');

    assert.deepEqual(
      await registerWithPassword({
        email: 'owner@example.com',
        password: 'Owner1234!',
        name: 'Owner User',
        termsAccepted: true,
        privacyConsentAccepted: true
      }),
      { status: 'verification_sent' }
    );
    assert.deepEqual(await verifyEmail({ token: 'token-123' }), {
      status: 'verified'
    });
    assert.deepEqual(
      await resendVerificationEmail({ email: 'owner@example.com' }),
      { status: 'verification_sent' }
    );
    assert.deepEqual(
      await acceptInvitation({ token: 'invitation-token-123' }),
      {
        status: 'accepted'
      }
    );

    assert.deepEqual(capturedRequests, [
      {
        url: 'http://localhost:4000/api/auth/register',
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        contentType: 'application/json',
        body: {
          email: 'owner@example.com',
          password: 'Owner1234!',
          name: 'Owner User',
          termsAccepted: true,
          privacyConsentAccepted: true
        }
      },
      {
        url: 'http://localhost:4000/api/auth/verify-email',
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        contentType: 'application/json',
        body: {
          token: 'token-123'
        }
      },
      {
        url: 'http://localhost:4000/api/auth/resend-verification',
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        contentType: 'application/json',
        body: {
          email: 'owner@example.com'
        }
      },
      {
        url: 'http://localhost:4000/api/auth/accept-invitation',
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        contentType: 'application/json',
        body: {
          token: 'invitation-token-123'
        }
      }
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('auth API helper calls the protected workspace creation and deletion endpoints', async () => {
  const capturedRequests: Array<{
    url: string;
    method: string | undefined;
    authorization: string | null;
    credentials: RequestCredentials | undefined;
    cache: RequestCache | undefined;
    contentType: string | null;
    body: unknown;
  }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    const rawBody = typeof init?.body === 'string' ? init.body : null;
    capturedRequests.push({
      url: String(input),
      method: init?.method,
      authorization: headers.get('Authorization'),
      credentials: init?.credentials,
      cache: init?.cache,
      contentType: headers.get('Content-Type'),
      body: rawBody ? (JSON.parse(rawBody) as unknown) : null
    });

    return new Response(
      JSON.stringify({
        user: {
          id: 'user-1',
          email: 'owner@example.com',
          name: 'Owner User',
          currentWorkspace: null
        },
        workspaces: []
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  };

  try {
    const { setStoredAccessToken, clearStoredAccessToken } =
      await import('../src/shared/auth/auth-session-store');
    const { createWorkspace, deleteWorkspace } =
      await import('../src/features/auth/auth.api');

    setStoredAccessToken('token-workspace');

    assert.deepEqual(
      await createWorkspace({
        tenantName: 'Second Workspace',
        tenantSlug: 'second-workspace',
        ledgerName: 'Second Ledger',
        baseCurrency: 'KRW',
        timezone: 'Asia/Seoul',
        openedFromYearMonth: '2026-05'
      }),
      {
        user: {
          id: 'user-1',
          email: 'owner@example.com',
          name: 'Owner User',
          currentWorkspace: null
        },
        workspaces: []
      }
    );
    assert.deepEqual(await deleteWorkspace('tenant-delete'), {
      user: {
        id: 'user-1',
        email: 'owner@example.com',
        name: 'Owner User',
        currentWorkspace: null
      },
      workspaces: []
    });

    assert.deepEqual(capturedRequests, [
      {
        url: 'http://localhost:4000/api/auth/workspaces',
        method: 'POST',
        authorization: 'Bearer token-workspace',
        credentials: 'include',
        cache: 'no-store',
        contentType: 'application/json',
        body: {
          tenantName: 'Second Workspace',
          tenantSlug: 'second-workspace',
          ledgerName: 'Second Ledger',
          baseCurrency: 'KRW',
          timezone: 'Asia/Seoul',
          openedFromYearMonth: '2026-05'
        }
      },
      {
        url: 'http://localhost:4000/api/auth/workspaces/tenant-delete',
        method: 'DELETE',
        authorization: 'Bearer token-workspace',
        credentials: 'include',
        cache: 'no-store',
        contentType: null,
        body: null
      }
    ]);

    clearStoredAccessToken();
  } finally {
    globalThis.fetch = originalFetch;
  }
});
