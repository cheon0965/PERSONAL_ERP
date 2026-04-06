import type { Prisma, PrismaClient } from '@prisma/client';

const confirmationCollectedTransactionInclude = {
  period: {
    select: {
      id: true,
      year: true,
      month: true,
      status: true
    }
  },
  fundingAccount: {
    select: {
      id: true,
      name: true
    }
  },
  ledgerTransactionType: {
    select: {
      postingPolicyKey: true
    }
  },
  postedJournalEntry: {
    select: {
      id: true
    }
  }
} satisfies Prisma.CollectedTransactionInclude;

export type ConfirmationWorkspaceScope = {
  tenantId: string;
  ledgerId: string;
};

export type ConfirmationCollectedTransaction =
  Prisma.CollectedTransactionGetPayload<{
    include: typeof confirmationCollectedTransactionInclude;
  }>;

export async function readCollectedTransactionForConfirmation(
  prisma: PrismaClient,
  scope: ConfirmationWorkspaceScope,
  collectedTransactionId: string
) {
  return prisma.collectedTransaction.findFirst({
    where: {
      id: collectedTransactionId,
      tenantId: scope.tenantId,
      ledgerId: scope.ledgerId
    },
    include: confirmationCollectedTransactionInclude
  });
}

export async function readLatestCollectedTransactionForConfirmation(
  tx: Prisma.TransactionClient,
  scope: ConfirmationWorkspaceScope,
  collectedTransactionId: string
) {
  return tx.collectedTransaction.findFirst({
    where: {
      id: collectedTransactionId,
      tenantId: scope.tenantId,
      ledgerId: scope.ledgerId
    },
    include: confirmationCollectedTransactionInclude
  });
}

export async function readCurrentCollectedTransactionForConfirmation(
  tx: Prisma.TransactionClient,
  scope: ConfirmationWorkspaceScope,
  collectedTransactionId: string
) {
  return tx.collectedTransaction.findFirst({
    where: {
      id: collectedTransactionId,
      tenantId: scope.tenantId,
      ledgerId: scope.ledgerId
    },
    include: {
      period: {
        select: {
          id: true,
          year: true,
          month: true,
          status: true
        }
      },
      postedJournalEntry: {
        select: {
          id: true
        }
      }
    }
  });
}

export async function readActiveConfirmAccountSubjects(
  prisma: PrismaClient,
  scope: ConfirmationWorkspaceScope,
  codes: readonly string[]
) {
  return prisma.accountSubject.findMany({
    where: {
      tenantId: scope.tenantId,
      ledgerId: scope.ledgerId,
      code: {
        in: [...codes]
      },
      isActive: true
    },
    select: {
      id: true,
      code: true
    }
  });
}
