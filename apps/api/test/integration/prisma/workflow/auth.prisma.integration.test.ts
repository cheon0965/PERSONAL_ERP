import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
  createRealApiPrismaIntegrationContext,
  type RealApiPrismaIntegrationContext
} from '../../../support/prisma/context';
import {
  cleanupRegisteredIntegrationUser,
  readEmailVerificationToken
} from './fixtures';

test('Real API/DB integration covers register -> verify-email -> login -> auth/me', async (t) => {
  let context: RealApiPrismaIntegrationContext | null = null;
  const email = `prisma-register-${randomUUID()}@example.com`;
  const password = 'Saffron73!Vault';

  try {
    context = await createRealApiPrismaIntegrationContext(t);
    if (!context) {
      return;
    }

    const registerResponse = await context.request('/auth/register', {
      method: 'POST',
      body: {
        email,
        password,
        name: 'Prisma Register Owner',
        termsAccepted: true,
        privacyConsentAccepted: true
      }
    });

    assert.equal(registerResponse.status, 200);
    assert.deepEqual(registerResponse.body, { status: 'verification_sent' });
    assert.equal(context.sentEmails.length, 1);
    assert.equal(context.sentEmails[0]?.to, email);

    const registeredUser = await context.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        emailVerifiedAt: true
      }
    });
    assert.ok(registeredUser);
    assert.equal(registeredUser.emailVerifiedAt, null);

    const loginBeforeVerification = await context.request('/auth/login', {
      method: 'POST',
      body: {
        email,
        password
      }
    });

    assert.equal(loginBeforeVerification.status, 401);

    const token = readEmailVerificationToken(context.sentEmails[0]?.text);
    const verifyResponse = await context.request('/auth/verify-email', {
      method: 'POST',
      body: { token }
    });

    assert.equal(verifyResponse.status, 200);
    assert.deepEqual(verifyResponse.body, { status: 'verified', email });

    const verifiedUser = await context.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        emailVerifiedAt: true
      }
    });
    assert.ok(verifiedUser?.emailVerifiedAt);

    const membership = await context.prisma.tenantMembership.findFirst({
      where: { userId: verifiedUser.id },
      select: {
        id: true,
        role: true,
        status: true,
        tenantId: true,
        tenant: {
          select: {
            defaultLedgerId: true
          }
        }
      }
    });
    assert.ok(membership);
    assert.equal(membership.role, 'OWNER');
    assert.equal(membership.status, 'ACTIVE');
    assert.ok(membership.tenant.defaultLedgerId);

    assert.equal(
      await context.prisma.accountSubject.count({
        where: { ledgerId: membership.tenant.defaultLedgerId }
      }),
      5
    );
    assert.equal(
      await context.prisma.ledgerTransactionType.count({
        where: { ledgerId: membership.tenant.defaultLedgerId }
      }),
      7
    );

    const { accessToken } = await context.login(email, password);
    const meResponse = await context.request('/auth/me', {
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    });
    const me = meResponse.body as {
      email: string;
      currentWorkspace?: {
        membership?: { role: string; status: string };
        ledger?: { id: string };
      };
    };

    assert.equal(meResponse.status, 200);
    assert.equal(me.email, email);
    assert.equal(me.currentWorkspace?.membership?.role, 'OWNER');
    assert.equal(me.currentWorkspace?.membership?.status, 'ACTIVE');
    assert.equal(
      me.currentWorkspace?.ledger?.id,
      membership.tenant.defaultLedgerId
    );
  } finally {
    if (context) {
      await cleanupRegisteredIntegrationUser(context, email);
      await context.close();
    }
  }
});
