import assert from 'node:assert/strict';
import {
  cleanupIntegrationWorkspaceFixture,
  type RealApiPrismaIntegrationContext
} from '../../../support/prisma/context';

export function readEmailVerificationToken(text: string | undefined): string {
  assert.ok(text);
  const match = text.match(/token=([A-Za-z0-9_-]+)/);
  assert.ok(match?.[1]);
  return match[1];
}

export async function cleanupRegisteredIntegrationUser(
  context: RealApiPrismaIntegrationContext,
  email: string
): Promise<void> {
  const membership = await context.prisma.tenantMembership.findFirst({
    where: {
      user: { email }
    },
    select: {
      userId: true,
      tenantId: true,
      tenant: {
        select: {
          defaultLedgerId: true
        }
      }
    }
  });

  if (membership?.tenant.defaultLedgerId) {
    await cleanupIntegrationWorkspaceFixture(context.prisma, {
      userId: membership.userId,
      tenantId: membership.tenantId,
      ledgerId: membership.tenant.defaultLedgerId
    });
    return;
  }

  const user = await context.prisma.user.findUnique({
    where: { email },
    select: { id: true }
  });

  if (!user) {
    return;
  }

  await context.prisma.emailVerificationToken.deleteMany({
    where: { userId: user.id }
  });
  await context.prisma.userSetting.deleteMany({
    where: { userId: user.id }
  });
  await context.prisma.user.delete({
    where: { id: user.id }
  });
}
