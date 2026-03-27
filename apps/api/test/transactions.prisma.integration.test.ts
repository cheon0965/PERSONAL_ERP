import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
  AccountType,
  CategoryKind,
  TransactionOrigin,
  TransactionStatus,
  TransactionType
} from '@prisma/client';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { CreateTransactionUseCase } from '../src/modules/transactions/application/use-cases/create-transaction.use-case';
import { ListTransactionsUseCase } from '../src/modules/transactions/application/use-cases/list-transactions.use-case';
import { PrismaReferenceOwnershipAdapter } from '../src/modules/transactions/infrastructure/prisma/prisma-reference-ownership.adapter';
import { PrismaTransactionStoreAdapter } from '../src/modules/transactions/infrastructure/prisma/prisma-transaction-store.adapter';

const shouldRunPrismaIntegration = process.env.RUN_PRISMA_INTEGRATION === '1';

async function safeDisconnect(prisma: PrismaService) {
  try {
    await prisma.$disconnect();
  } catch {
    // Ignore disconnect failures during test cleanup.
  }
}

test(
  'Transactions Prisma integration persists and reads through the real MySQL boundary',
  {
    skip: shouldRunPrismaIntegration
      ? false
      : 'Run `npm run test:prisma` to execute this test against a configured MySQL database.'
  },
  async (t) => {
    const prisma = new PrismaService();

    try {
      await prisma.$connect();
    } catch {
      t.skip(
        'Skipping Prisma integration test because DATABASE_URL is not reachable from this environment.'
      );
      await safeDisconnect(prisma);
      return;
    }

    const suffix = randomUUID();
    const userEmails: [string, string] = [
      `prisma-owner-${suffix}@example.com`,
      `prisma-outsider-${suffix}@example.com`
    ];

    try {
      const owner = await prisma.user.create({
        data: {
          email: userEmails[0],
          name: 'Prisma Integration Owner',
          passwordHash: 'integration-test-password-hash'
        }
      });
      const outsider = await prisma.user.create({
        data: {
          email: userEmails[1],
          name: 'Prisma Integration Outsider',
          passwordHash: 'integration-test-password-hash'
        }
      });

      const ownerAccount = await prisma.account.create({
        data: {
          userId: owner.id,
          name: 'Integration Main Account',
          type: AccountType.BANK,
          balanceWon: 500000,
          sortOrder: 1
        }
      });
      const outsiderAccount = await prisma.account.create({
        data: {
          userId: outsider.id,
          name: 'Integration Outsider Account',
          type: AccountType.BANK,
          balanceWon: 200000,
          sortOrder: 1
        }
      });
      const ownerCategory = await prisma.category.create({
        data: {
          userId: owner.id,
          name: 'Integration Fuel',
          kind: CategoryKind.EXPENSE,
          sortOrder: 1
        }
      });
      const outsiderCategory = await prisma.category.create({
        data: {
          userId: outsider.id,
          name: 'Integration Outsider Category',
          kind: CategoryKind.EXPENSE,
          sortOrder: 1
        }
      });

      await prisma.transaction.create({
        data: {
          userId: owner.id,
          title: 'Parking',
          type: TransactionType.EXPENSE,
          amountWon: 12000,
          businessDate: new Date('2026-03-01T00:00:00.000Z'),
          accountId: ownerAccount.id,
          categoryId: ownerCategory.id,
          origin: TransactionOrigin.MANUAL,
          status: TransactionStatus.POSTED
        }
      });
      await prisma.transaction.create({
        data: {
          userId: outsider.id,
          title: 'Outsider purchase',
          type: TransactionType.EXPENSE,
          amountWon: 99000,
          businessDate: new Date('2026-03-05T00:00:00.000Z'),
          accountId: outsiderAccount.id,
          categoryId: outsiderCategory.id,
          origin: TransactionOrigin.MANUAL,
          status: TransactionStatus.POSTED
        }
      });

      const referenceOwnership = new PrismaReferenceOwnershipAdapter(prisma);
      const transactionStore = new PrismaTransactionStoreAdapter(prisma);
      const createTransactionUseCase = new CreateTransactionUseCase(
        transactionStore,
        referenceOwnership
      );
      const listTransactionsUseCase = new ListTransactionsUseCase(
        transactionStore
      );

      assert.equal(
        await referenceOwnership.accountExistsForUser(
          owner.id,
          ownerAccount.id
        ),
        true
      );
      assert.equal(
        await referenceOwnership.accountExistsForUser(
          owner.id,
          outsiderAccount.id
        ),
        false
      );
      assert.equal(
        await referenceOwnership.categoryExistsForUser(
          owner.id,
          ownerCategory.id
        ),
        true
      );
      assert.equal(
        await referenceOwnership.categoryExistsForUser(
          owner.id,
          outsiderCategory.id
        ),
        false
      );

      const created = await createTransactionUseCase.execute({
        userId: owner.id,
        title: 'Fuel refill',
        type: TransactionType.EXPENSE,
        amountWon: 84000,
        businessDate: '2026-03-03',
        accountId: ownerAccount.id,
        categoryId: ownerCategory.id,
        memo: 'Full tank'
      });

      assert.deepEqual(created, {
        id: created.id,
        businessDate: '2026-03-03',
        title: 'Fuel refill',
        type: TransactionType.EXPENSE,
        amountWon: 84000,
        accountName: 'Integration Main Account',
        categoryName: 'Integration Fuel',
        origin: TransactionOrigin.MANUAL,
        status: TransactionStatus.POSTED
      });

      const transactions = await listTransactionsUseCase.execute(owner.id);

      assert.equal(transactions.length, 2);
      assert.deepEqual(
        transactions.map((transaction) => transaction.title),
        ['Fuel refill', 'Parking']
      );
      assert.deepEqual(
        transactions.map((transaction) => transaction.businessDate),
        ['2026-03-03', '2026-03-01']
      );
      assert.equal(
        transactions.some(
          (transaction) => transaction.title === 'Outsider purchase'
        ),
        false
      );
    } finally {
      await prisma.transaction.deleteMany({
        where: {
          user: {
            email: {
              in: userEmails
            }
          }
        }
      });
      await prisma.category.deleteMany({
        where: {
          user: {
            email: {
              in: userEmails
            }
          }
        }
      });
      await prisma.account.deleteMany({
        where: {
          user: {
            email: {
              in: userEmails
            }
          }
        }
      });
      await prisma.user.deleteMany({
        where: {
          email: {
            in: userEmails
          }
        }
      });
      await safeDisconnect(prisma);
    }
  }
);
