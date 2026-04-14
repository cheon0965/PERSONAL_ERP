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
        name: 'Owner User'
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
          name: 'Owner User'
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
