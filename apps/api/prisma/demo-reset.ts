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

    await deleteTenantScopedRows(prisma, deletedTenantIds);

    await deleteTenantsByIdAfterManualCleanup(prisma, deletedTenantIds);
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

async function deleteTenantScopedRows(
  prisma: DemoResetPrismaClient,
  tenantIds: string[]
): Promise<void> {
  const tenantIdFilter = {
    in: tenantIds
  };

  await prisma.importBatchCollectionJobRow.deleteMany({
    where: {
      job: {
        tenantId: tenantIdFilter
      }
    }
  });

  await prisma.importBatchCollectionLock.deleteMany({
    where: {
      tenantId: tenantIdFilter
    }
  });

  await prisma.importBatchCollectionJob.deleteMany({
    where: {
      tenantId: tenantIdFilter
    }
  });

  await prisma.workspaceNavigationMenuRole.deleteMany({
    where: {
      menuItem: {
        tenantId: tenantIdFilter
      }
    }
  });

  await deleteWorkspaceNavigationMenuItems(prisma, tenantIds);

  await prisma.balanceSnapshotLine.deleteMany({
    where: {
      OR: [
        {
          openingSnapshot: {
            tenantId: tenantIdFilter
          }
        },
        {
          closingSnapshot: {
            tenantId: tenantIdFilter
          }
        }
      ]
    }
  });

  await prisma.journalLine.deleteMany({
    where: {
      journalEntry: {
        tenantId: tenantIdFilter
      }
    }
  });

  await prisma.liabilityRepaymentSchedule.deleteMany({
    where: {
      tenantId: tenantIdFilter
    }
  });

  await prisma.fuelLog.deleteMany({
    where: {
      vehicle: {
        tenantId: tenantIdFilter
      }
    }
  });

  await prisma.vehicleMaintenanceLog.deleteMany({
    where: {
      vehicle: {
        tenantId: tenantIdFilter
      }
    }
  });

  await prisma.carryForwardRecord.deleteMany({
    where: {
      tenantId: tenantIdFilter
    }
  });

  await prisma.financialStatementSnapshot.deleteMany({
    where: {
      tenantId: tenantIdFilter
    }
  });

  await prisma.closingSnapshot.deleteMany({
    where: {
      tenantId: tenantIdFilter
    }
  });

  await prisma.openingBalanceSnapshot.deleteMany({
    where: {
      tenantId: tenantIdFilter
    }
  });

  await prisma.workspaceOperationalNote.deleteMany({
    where: {
      tenantId: tenantIdFilter
    }
  });

  await prisma.journalEntry.deleteMany({
    where: {
      tenantId: tenantIdFilter
    }
  });

  await prisma.liabilityAgreement.deleteMany({
    where: {
      tenantId: tenantIdFilter
    }
  });

  await prisma.vehicle.deleteMany({
    where: {
      tenantId: tenantIdFilter
    }
  });

  await prisma.insurancePolicy.deleteMany({
    where: {
      tenantId: tenantIdFilter
    }
  });

  await prisma.collectedTransaction.deleteMany({
    where: {
      tenantId: tenantIdFilter
    }
  });

  await prisma.planItem.deleteMany({
    where: {
      tenantId: tenantIdFilter
    }
  });

  await prisma.importedRow.deleteMany({
    where: {
      batch: {
        tenantId: tenantIdFilter
      }
    }
  });

  await prisma.importBatch.deleteMany({
    where: {
      tenantId: tenantIdFilter
    }
  });

  await prisma.recurringRule.deleteMany({
    where: {
      tenantId: tenantIdFilter
    }
  });

  await prisma.periodStatusHistory.deleteMany({
    where: {
      tenantId: tenantIdFilter
    }
  });

  await prisma.accountingPeriod.deleteMany({
    where: {
      tenantId: tenantIdFilter
    }
  });

  await prisma.accountSubject.deleteMany({
    where: {
      tenantId: tenantIdFilter
    }
  });

  await prisma.ledgerTransactionType.deleteMany({
    where: {
      tenantId: tenantIdFilter
    }
  });

  await prisma.category.deleteMany({
    where: {
      tenantId: tenantIdFilter
    }
  });

  await prisma.account.deleteMany({
    where: {
      tenantId: tenantIdFilter
    }
  });

  await prisma.ledger.deleteMany({
    where: {
      tenantId: tenantIdFilter
    }
  });

  await prisma.tenantMembershipInvitation.deleteMany({
    where: {
      tenantId: tenantIdFilter
    }
  });

  await prisma.tenantMembership.deleteMany({
    where: {
      tenantId: tenantIdFilter
    }
  });

  await prisma.workspaceAuditEvent.deleteMany({
    where: {
      tenantId: tenantIdFilter
    }
  });
}

async function deleteWorkspaceNavigationMenuItems(
  prisma: DemoResetPrismaClient,
  tenantIds: string[]
): Promise<void> {
  const items = await prisma.workspaceNavigationMenuItem.findMany({
    where: {
      tenantId: {
        in: tenantIds
      }
    },
    select: {
      id: true,
      parentId: true
    }
  });

  if (items.length === 0) {
    return;
  }

  const parentIdById = new Map(
    items.map((item) => [item.id, item.parentId] as const)
  );
  const depthById = new Map<string, number>();

  const readDepth = (id: string, visiting: Set<string>): number => {
    const cached = depthById.get(id);
    if (cached !== undefined) {
      return cached;
    }

    const parentId = parentIdById.get(id);
    if (!parentId || !parentIdById.has(parentId) || visiting.has(parentId)) {
      depthById.set(id, 0);
      return 0;
    }

    visiting.add(id);
    const depth = readDepth(parentId, visiting) + 1;
    visiting.delete(id);
    depthById.set(id, depth);
    return depth;
  };

  const idsByDepthDescending = [...items]
    .map((item) => ({
      id: item.id,
      depth: readDepth(item.id, new Set())
    }))
    .sort((left, right) => right.depth - left.depth);

  let currentDepth: number | null = null;
  let currentIds: string[] = [];

  const deleteCurrentDepth = async () => {
    if (currentIds.length === 0) {
      return;
    }

    await prisma.workspaceNavigationMenuItem.deleteMany({
      where: {
        id: {
          in: currentIds
        }
      }
    });
  };

  for (const item of idsByDepthDescending) {
    if (currentDepth !== null && item.depth !== currentDepth) {
      await deleteCurrentDepth();
      currentIds = [];
    }

    currentDepth = item.depth;
    currentIds.push(item.id);
  }

  await deleteCurrentDepth();
}

async function deleteTenantsByIdAfterManualCleanup(
  prisma: DemoResetPrismaClient,
  tenantIds: string[]
): Promise<void> {
  await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 0`;

  try {
    await prisma.tenant.deleteMany({
      where: {
        id: {
          in: tenantIds
        }
      }
    });
  } finally {
    await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 1`;
  }
}
