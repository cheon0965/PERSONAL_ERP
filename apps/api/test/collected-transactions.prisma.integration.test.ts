import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { AccountType, CategoryKind, TransactionType } from '@prisma/client';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { CreateCollectedTransactionUseCase } from '../src/modules/collected-transactions/application/use-cases/create-collected-transaction.use-case';
import { ListCollectedTransactionsUseCase } from '../src/modules/collected-transactions/application/use-cases/list-collected-transactions.use-case';
import { PrismaReferenceOwnershipAdapter } from '../src/modules/collected-transactions/infrastructure/prisma/prisma-reference-ownership.adapter';
import { PrismaCollectedTransactionStoreAdapter } from '../src/modules/collected-transactions/infrastructure/prisma/prisma-collected-transaction-store.adapter';
import { ensurePhase1BackboneForUser } from '../prisma/phase1-backbone';
import {
  getPrismaIntegrationMissingDatabaseMessage,
  getPrismaIntegrationUnreachableMessage,
  resolvePrismaIntegrationDatabaseEnv,
  shouldRunPrismaIntegration
} from './prisma-integration-env';

async function safeDisconnect(prisma: PrismaService) {
  try {
    await prisma.$disconnect();
  } catch {
    // Ignore disconnect failures during test cleanup.
  }
}

function restoreEnvVar(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

test(
  'Collected transactions Prisma integration persists and reads through the real MySQL boundary',
  {
    skip: shouldRunPrismaIntegration
      ? false
      : 'Run `npm run test:prisma` to execute this test against a configured MySQL database.'
  },
  async (t) => {
    const resolvedDatabaseEnv = resolvePrismaIntegrationDatabaseEnv();
    if (!resolvedDatabaseEnv.databaseUrl) {
      t.skip(getPrismaIntegrationMissingDatabaseMessage());
      return;
    }

    const previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = resolvedDatabaseEnv.databaseUrl;
    const prisma = new PrismaService();

    try {
      try {
        await prisma.$connect();
      } catch {
        t.skip(getPrismaIntegrationUnreachableMessage(resolvedDatabaseEnv));
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

        const ownerBackbone = await ensurePhase1BackboneForUser(
          prisma,
          owner.id
        );
        const outsiderBackbone = await ensurePhase1BackboneForUser(
          prisma,
          outsider.id
        );

        const ownerAccount = await prisma.account.create({
          data: {
            userId: owner.id,
            tenantId: ownerBackbone.tenantId,
            ledgerId: ownerBackbone.ledgerId,
            name: 'Integration Main Account',
            type: AccountType.BANK,
            balanceWon: 500000,
            sortOrder: 1
          }
        });
        const outsiderAccount = await prisma.account.create({
          data: {
            userId: outsider.id,
            tenantId: outsiderBackbone.tenantId,
            ledgerId: outsiderBackbone.ledgerId,
            name: 'Integration Outsider Account',
            type: AccountType.BANK,
            balanceWon: 200000,
            sortOrder: 1
          }
        });
        const ownerCategory = await prisma.category.create({
          data: {
            userId: owner.id,
            tenantId: ownerBackbone.tenantId,
            ledgerId: ownerBackbone.ledgerId,
            name: 'Integration Fuel',
            kind: CategoryKind.EXPENSE,
            sortOrder: 1
          }
        });
        const outsiderCategory = await prisma.category.create({
          data: {
            userId: outsider.id,
            tenantId: outsiderBackbone.tenantId,
            ledgerId: outsiderBackbone.ledgerId,
            name: 'Integration Outsider Category',
            kind: CategoryKind.EXPENSE,
            sortOrder: 1
          }
        });

        const ownerPeriod = await prisma.accountingPeriod.create({
          data: {
            tenantId: ownerBackbone.tenantId,
            ledgerId: ownerBackbone.ledgerId,
            year: 2026,
            month: 3,
            startDate: new Date('2026-03-01T00:00:00.000Z'),
            endDate: new Date('2026-04-01T00:00:00.000Z')
          }
        });

        const ownerExpenseType =
          await prisma.ledgerTransactionType.findUniqueOrThrow({
            where: {
              ledgerId_code: {
                ledgerId: ownerBackbone.ledgerId,
                code: 'EXPENSE_BASIC'
              }
            },
            select: {
              id: true
            }
          });
        const outsiderExpenseType =
          await prisma.ledgerTransactionType.findUniqueOrThrow({
            where: {
              ledgerId_code: {
                ledgerId: outsiderBackbone.ledgerId,
                code: 'EXPENSE_BASIC'
              }
            },
            select: {
              id: true
            }
          });

        await prisma.collectedTransaction.create({
          data: {
            tenantId: ownerBackbone.tenantId,
            ledgerId: ownerBackbone.ledgerId,
            periodId: ownerPeriod.id,
            ledgerTransactionTypeId: ownerExpenseType.id,
            fundingAccountId: ownerAccount.id,
            categoryId: ownerCategory.id,
            title: 'Parking',
            occurredOn: new Date('2026-03-01T00:00:00.000Z'),
            amount: 12000,
            status: 'COLLECTED'
          }
        });
        await prisma.collectedTransaction.create({
          data: {
            tenantId: outsiderBackbone.tenantId,
            ledgerId: outsiderBackbone.ledgerId,
            ledgerTransactionTypeId: outsiderExpenseType.id,
            fundingAccountId: outsiderAccount.id,
            categoryId: outsiderCategory.id,
            title: 'Outsider purchase',
            occurredOn: new Date('2026-03-05T00:00:00.000Z'),
            amount: 99000,
            status: 'COLLECTED'
          }
        });

        const referenceOwnership = new PrismaReferenceOwnershipAdapter(prisma);
        const transactionStore = new PrismaCollectedTransactionStoreAdapter(
          prisma
        );
        const createTransactionUseCase = new CreateCollectedTransactionUseCase(
          transactionStore,
          referenceOwnership
        );
        const listTransactionsUseCase = new ListCollectedTransactionsUseCase(
          transactionStore
        );

        assert.equal(
          await referenceOwnership.fundingAccountExistsInWorkspace(
            ownerBackbone.tenantId,
            ownerBackbone.ledgerId,
            ownerAccount.id
          ),
          true
        );
        assert.equal(
          await referenceOwnership.fundingAccountExistsInWorkspace(
            ownerBackbone.tenantId,
            ownerBackbone.ledgerId,
            outsiderAccount.id
          ),
          false
        );
        assert.equal(
          await referenceOwnership.categoryExistsInWorkspace(
            ownerBackbone.tenantId,
            ownerBackbone.ledgerId,
            ownerCategory.id
          ),
          true
        );
        assert.equal(
          await referenceOwnership.categoryExistsInWorkspace(
            ownerBackbone.tenantId,
            ownerBackbone.ledgerId,
            outsiderCategory.id
          ),
          false
        );

        const created = await createTransactionUseCase.execute({
          userId: owner.id,
          tenantId: ownerBackbone.tenantId,
          ledgerId: ownerBackbone.ledgerId,
          periodId: ownerPeriod.id,
          title: 'Fuel refill',
          type: TransactionType.EXPENSE,
          amountWon: 84000,
          businessDate: '2026-03-03',
          fundingAccountId: ownerAccount.id,
          categoryId: ownerCategory.id,
          memo: 'Full tank'
        });

        assert.deepEqual(created, {
          id: created.id,
          businessDate: '2026-03-03',
          title: 'Fuel refill',
          type: TransactionType.EXPENSE,
          amountWon: 84000,
          fundingAccountName: 'Integration Main Account',
          categoryName: 'Integration Fuel',
          sourceKind: 'MANUAL',
          postingStatus: 'READY_TO_POST',
          postedJournalEntryId: null,
          postedJournalEntryNumber: null
        });

        const transactions = await listTransactionsUseCase.execute({
          tenantId: ownerBackbone.tenantId,
          ledgerId: ownerBackbone.ledgerId
        });

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
        await prisma.collectedTransaction.deleteMany({
          where: {
            tenant: {
              memberships: {
                some: {
                  user: {
                    email: {
                      in: userEmails
                    }
                  }
                }
              }
            }
          }
        });
        await prisma.accountingPeriod.deleteMany({
          where: {
            tenant: {
              memberships: {
                some: {
                  user: {
                    email: {
                      in: userEmails
                    }
                  }
                }
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
        await prisma.tenant.deleteMany({
          where: {
            memberships: {
              some: {
                user: {
                  email: {
                    in: userEmails
                  }
                }
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
      }
    } finally {
      await safeDisconnect(prisma);
      restoreEnvVar('DATABASE_URL', previousDatabaseUrl);
    }
  }
);
