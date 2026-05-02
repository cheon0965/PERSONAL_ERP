import type { Prisma, PrismaClient } from '@prisma/client';

type DemoResetPrismaClient = PrismaClient | Prisma.TransactionClient;

export type DemoDataResetSummary = {
  demoEmail: string;
  userDeleted: boolean;
  deletedTenantIds: string[];
  protectedTenantIds: string[];
};

export async function resetDemoUserAndOwnedWorkspaces(
  prisma: PrismaClient,
  demoEmail: string
): Promise<DemoDataResetSummary> {
  const normalizedDemoEmail = demoEmail.trim();

  if (!normalizedDemoEmail) {
    throw new Error('[demo reset] DEMO_EMAIL must not be empty.');
  }

  return prisma.$transaction(async (tx) =>
    resetDemoUserAndOwnedWorkspacesInTransaction(tx, normalizedDemoEmail)
  );
}

async function resetDemoUserAndOwnedWorkspacesInTransaction(
  prisma: DemoResetPrismaClient,
  demoEmail: string
): Promise<DemoDataResetSummary> {
  const demoUser = await prisma.user.findUnique({
    where: { email: demoEmail },
    select: {
      id: true,
      memberships: {
        select: {
          tenantId: true
        }
      }
    }
  });

  if (!demoUser) {
    return {
      demoEmail,
      userDeleted: false,
      deletedTenantIds: [],
      protectedTenantIds: []
    };
  }

  const tenantIds = [
    ...new Set(demoUser.memberships.map((membership) => membership.tenantId))
  ];
  const deletedTenantIds: string[] = [];
  const protectedTenantIds: string[] = [];

  for (const tenantId of tenantIds) {
    // 데모 사용자가 속해 있어도 다른 사용자가 함께 있는 테넌트는 운영 데이터로 보고 절대 삭제하지 않는다.
    const nonDemoMemberCount = await prisma.tenantMembership.count({
      where: {
        tenantId,
        userId: {
          not: demoUser.id
        }
      }
    });

    if (nonDemoMemberCount > 0) {
      protectedTenantIds.push(tenantId);
      continue;
    }

    deletedTenantIds.push(tenantId);
  }

  if (deletedTenantIds.length > 0) {
    await prisma.tenant.updateMany({
      where: {
        id: {
          in: deletedTenantIds
        }
      },
      data: {
        defaultLedgerId: null
      }
    });

    await prisma.tenant.deleteMany({
      where: {
        id: {
          in: deletedTenantIds
        }
      }
    });
  }

  await prisma.user.delete({
    where: {
      id: demoUser.id
    }
  });

  return {
    demoEmail,
    userDeleted: true,
    deletedTenantIds,
    protectedTenantIds
  };
}
