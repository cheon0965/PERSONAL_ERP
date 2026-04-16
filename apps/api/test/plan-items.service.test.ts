import assert from 'node:assert/strict';
import test from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '@personal-erp/contracts';
import {
  AccountingPeriodStatus,
  CollectedTransactionStatus,
  CategoryKind,
  PlanItemStatus,
  Prisma
} from '@prisma/client';
import { PlanItemGenerationPort } from '../src/modules/plan-items/application/ports/plan-item-generation.port';
import { GeneratePlanItemsUseCase } from '../src/modules/plan-items/generate-plan-items.use-case';
import { PrismaPlanItemGenerationAdapter } from '../src/modules/plan-items/infrastructure/prisma/prisma-plan-item-generation.adapter';
import { PlanItemsService } from '../src/modules/plan-items/plan-items.service';

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'demo@example.com',
  name: 'Demo User',
  currentWorkspace: {
    tenant: {
      id: 'tenant-1',
      slug: 'demo-tenant',
      name: 'Demo Workspace',
      status: 'ACTIVE'
    },
    membership: {
      id: 'membership-1',
      role: 'OWNER',
      status: 'ACTIVE'
    },
    ledger: {
      id: 'ledger-1',
      name: '사업 장부',
      baseCurrency: 'KRW',
      timezone: 'Asia/Seoul',
      status: 'ACTIVE'
    }
  }
};

test('GeneratePlanItemsUseCase generates plan items for recurring rules inside the selected period', async () => {
  const period = createPeriod({
    id: 'period-2026-03',
    year: 2026,
    month: 3
  });
  const state = createPlanItemTestState({
    recurringRules: [
      {
        id: 'rr-1',
        accountId: 'acc-1',
        categoryId: 'cat-expense',
        title: '휴대폰 요금',
        amountWon: 75_000,
        frequency: 'MONTHLY',
        dayOfMonth: 10,
        startDate: new Date('2026-01-10T00:00:00.000Z'),
        endDate: null,
        account: {
          id: 'acc-1',
          name: '주거래 통장'
        },
        category: {
          id: 'cat-expense',
          name: '통신비',
          kind: CategoryKind.EXPENSE
        },
        ledgerTransactionType: null
      }
    ],
    planItems: []
  });

  const prisma = createPrismaMock(period, state);
  const useCase = new GeneratePlanItemsUseCase(
    new PrismaPlanItemGenerationAdapter(prisma as never),
    new PlanItemsService(prisma as never)
  );
  const result = await useCase.execute(user, { periodId: period.id });

  assert.equal(result.generation.createdCount, 1);
  assert.equal(result.generation.skippedExistingCount, 0);
  assert.equal(result.generation.excludedRuleCount, 0);
  assert.equal(result.items.length, 1);
  assert.deepEqual(result.items[0], {
    id: 'plan-1',
    periodId: 'period-2026-03',
    title: '휴대폰 요금',
    plannedDate: '2026-03-10',
    plannedAmount: 75_000,
    status: 'MATCHED',
    recurringRuleId: 'rr-1',
    recurringRuleTitle: '휴대폰 요금',
    ledgerTransactionTypeName: '기본 지출',
    fundingAccountName: '주거래 통장',
    categoryName: '통신비',
    matchedCollectedTransactionId: 'ctx-1',
    matchedCollectedTransactionTitle: '휴대폰 요금',
    matchedCollectedTransactionStatus: 'READY_TO_POST',
    postedJournalEntryId: null,
    postedJournalEntryNumber: null
  });
});

test('GeneratePlanItemsUseCase skips existing occurrences and excludes recurring rules without a resolvable transaction type', async () => {
  const period = createPeriod({
    id: 'period-2026-04',
    year: 2026,
    month: 4
  });
  const state = createPlanItemTestState({
    recurringRules: [
      {
        id: 'rr-existing',
        accountId: 'acc-1',
        categoryId: 'cat-expense',
        title: '정기 보험료',
        amountWon: 98_000,
        frequency: 'MONTHLY',
        dayOfMonth: 25,
        startDate: new Date('2026-01-25T00:00:00.000Z'),
        endDate: null,
        account: {
          id: 'acc-1',
          name: '주거래 통장'
        },
        category: {
          id: 'cat-expense',
          name: '보험',
          kind: CategoryKind.EXPENSE
        },
        ledgerTransactionType: null
      },
      {
        id: 'rr-created',
        accountId: 'acc-1',
        categoryId: 'cat-income',
        title: '월급 예상',
        amountWon: 3_200_000,
        frequency: 'MONTHLY',
        dayOfMonth: 25,
        startDate: new Date('2026-01-25T00:00:00.000Z'),
        endDate: null,
        account: {
          id: 'acc-1',
          name: '주거래 통장'
        },
        category: {
          id: 'cat-income',
          name: '급여',
          kind: CategoryKind.INCOME
        },
        ledgerTransactionType: null
      },
      {
        id: 'rr-excluded',
        accountId: 'acc-1',
        categoryId: null,
        title: '카테고리 없는 규칙',
        amountWon: 10_000,
        frequency: 'MONTHLY',
        dayOfMonth: 5,
        startDate: new Date('2026-01-05T00:00:00.000Z'),
        endDate: null,
        account: {
          id: 'acc-1',
          name: '주거래 통장'
        },
        category: null,
        ledgerTransactionType: null
      }
    ],
    planItems: [
      {
        id: 'plan-existing',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        periodId: 'period-2026-04',
        recurringRuleId: 'rr-existing',
        ledgerTransactionTypeId: 'ltt-expense',
        fundingAccountId: 'acc-1',
        categoryId: 'cat-expense',
        title: '정기 보험료',
        plannedAmount: 98_000,
        plannedDate: new Date('2026-04-25T00:00:00.000Z'),
        status: PlanItemStatus.DRAFT
      }
    ]
  });

  const prisma = createPrismaMock(period, state);
  const useCase = new GeneratePlanItemsUseCase(
    new PrismaPlanItemGenerationAdapter(prisma as never),
    new PlanItemsService(prisma as never)
  );
  const result = await useCase.execute(user, { periodId: period.id });

  assert.equal(result.generation.createdCount, 1);
  assert.equal(result.generation.skippedExistingCount, 1);
  assert.equal(result.generation.excludedRuleCount, 1);
  assert.equal(result.summary.totalCount, 2);
  assert.equal(result.summary.totalPlannedAmount, 3_298_000);
  assert.deepEqual(
    result.items.map((item) => item.title),
    ['정기 보험료', '월급 예상']
  );
});

test('GeneratePlanItemsUseCase rejects editor role because plan generation is limited to owner or manager', async () => {
  const currentWorkspace = user.currentWorkspace!;
  const editorUser: AuthenticatedUser = {
    ...user,
    currentWorkspace: {
      ...currentWorkspace,
      membership: {
        ...currentWorkspace.membership,
        role: 'EDITOR'
      }
    }
  };
  const period = createPeriod({
    id: 'period-2026-05',
    year: 2026,
    month: 5
  });
  const prisma = createPrismaMock(
    period,
    createPlanItemTestState({
      recurringRules: [],
      planItems: []
    })
  );
  const useCase = new GeneratePlanItemsUseCase(
    new PrismaPlanItemGenerationAdapter(prisma as never),
    new PlanItemsService(prisma as never)
  );

  await assert.rejects(
    () => useCase.execute(editorUser, { periodId: period.id }),
    ForbiddenException
  );
});

test('GeneratePlanItemsUseCase treats duplicate plan item inserts as skipped and continues with the remaining rules', async () => {
  const period = createPeriod({
    id: 'period-2026-06',
    year: 2026,
    month: 6
  });
  const state = createPlanItemTestState({
    recurringRules: [
      {
        id: 'rr-duplicate',
        accountId: 'acc-1',
        categoryId: 'cat-expense',
        title: '정기 구독',
        amountWon: 21_000,
        frequency: 'MONTHLY',
        dayOfMonth: 10,
        startDate: new Date('2026-01-10T00:00:00.000Z'),
        endDate: null,
        account: {
          id: 'acc-1',
          name: '주거래 통장'
        },
        category: {
          id: 'cat-expense',
          name: '구독',
          kind: CategoryKind.EXPENSE
        },
        ledgerTransactionType: null
      },
      {
        id: 'rr-created-after-duplicate',
        accountId: 'acc-1',
        categoryId: 'cat-expense',
        title: '인터넷 요금',
        amountWon: 33_000,
        frequency: 'MONTHLY',
        dayOfMonth: 20,
        startDate: new Date('2026-01-20T00:00:00.000Z'),
        endDate: null,
        account: {
          id: 'acc-1',
          name: '주거래 통장'
        },
        category: {
          id: 'cat-expense',
          name: '통신비',
          kind: CategoryKind.EXPENSE
        },
        ledgerTransactionType: null
      }
    ],
    planItems: []
  });

  const prisma = createPrismaMock(period, state);
  const originalCreate = prisma.planItem.create;
  let duplicateInjected = false;
  prisma.planItem.create = async (args) => {
    const duplicateKey = `${args.data.recurringRuleId}:${args.data.plannedDate.toISOString().slice(0, 10)}`;
    if (!duplicateInjected && duplicateKey === 'rr-duplicate:2026-06-10') {
      duplicateInjected = true;
      throw new Prisma.PrismaClientKnownRequestError('duplicate plan item', {
        code: 'P2002',
        clientVersion: 'test',
        meta: {
          target: ['periodId', 'recurringRuleId', 'plannedDate']
        }
      });
    }

    return originalCreate(args);
  };

  const useCase = new GeneratePlanItemsUseCase(
    new PrismaPlanItemGenerationAdapter(prisma as never),
    new PlanItemsService(prisma as never)
  );
  const result = await useCase.execute(user, { periodId: period.id });

  assert.equal(result.generation.createdCount, 1);
  assert.equal(result.generation.skippedExistingCount, 1);
  assert.equal(result.generation.excludedRuleCount, 0);
  assert.deepEqual(
    result.items.map((item) => item.title),
    ['인터넷 요금']
  );
});

function createPeriod(input: { id: string; year: number; month: number }) {
  return {
    id: input.id,
    tenantId: 'tenant-1',
    ledgerId: 'ledger-1',
    year: input.year,
    month: input.month,
    startDate: new Date(
      `${input.year}-${String(input.month).padStart(2, '0')}-01T00:00:00.000Z`
    ),
    endDate:
      input.month === 12
        ? new Date(`${input.year + 1}-01-01T00:00:00.000Z`)
        : new Date(
            `${input.year}-${String(input.month + 1).padStart(2, '0')}-01T00:00:00.000Z`
          ),
    status: AccountingPeriodStatus.OPEN,
    openedAt: new Date('2026-03-01T00:00:00.000Z'),
    lockedAt: null,
    createdAt: new Date('2026-03-01T00:00:00.000Z'),
    updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    openingBalanceSnapshot: null,
    statusHistory: []
  };
}

function createPlanItemTestState(input: {
  recurringRules: Array<{
    id: string;
    accountId: string;
    categoryId: string | null;
    title: string;
    amountWon: number;
    frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    dayOfMonth: number | null;
    startDate: Date;
    endDate: Date | null;
    account: {
      id: string;
      name: string;
    };
    category: {
      id: string;
      name: string;
      kind: CategoryKind;
    } | null;
    ledgerTransactionType: {
      id: string;
      flowKind: 'INCOME' | 'EXPENSE' | 'TRANSFER';
      isActive: boolean;
    } | null;
  }>;
  planItems: Array<{
    id: string;
    tenantId: string;
    ledgerId: string;
    periodId: string;
    recurringRuleId: string | null;
    ledgerTransactionTypeId: string;
    fundingAccountId: string;
    categoryId: string | null;
    title: string;
    plannedAmount: number;
    plannedDate: Date;
    status: PlanItemStatus;
  }>;
}) {
  const accounts = Array.from(
    new Map(
      input.recurringRules.map((rule) => [
        rule.account.id,
        {
          id: rule.account.id,
          name: rule.account.name
        }
      ])
    ).values()
  );
  const categories = Array.from(
    new Map(
      input.recurringRules.flatMap((rule) =>
        rule.category
          ? ([
              [
                rule.category.id,
                {
                  id: rule.category.id,
                  name: rule.category.name
                }
              ]
            ] as const)
          : []
      )
    ).values()
  );

  return {
    recurringRules: input.recurringRules,
    planItems: [...input.planItems],
    collectedTransactions: [] as Array<{
      id: string;
      matchedPlanItemId: string | null;
      title: string;
      status: CollectedTransactionStatus;
    }>,
    transactionTypes: [
      {
        id: 'ltt-income',
        flowKind: 'INCOME',
        name: '기본 수입'
      },
      {
        id: 'ltt-expense',
        flowKind: 'EXPENSE',
        name: '기본 지출'
      },
      {
        id: 'ltt-transfer',
        flowKind: 'TRANSFER',
        name: '기본 이체'
      }
    ],
    accounts,
    categories
  };
}

function createPrismaMock(
  period: ReturnType<typeof createPeriod>,
  state: ReturnType<typeof createPlanItemTestState>
) {
  const prisma = {
    $transaction: async <T>(
      callback: (tx: Record<string, unknown>) => Promise<T>
    ) => callback(prisma),
    accountingPeriod: {
      findFirst: async () => period
    },
    recurringRule: {
      findMany: async () => state.recurringRules
    },
    ledgerTransactionType: {
      findMany: async () =>
        state.transactionTypes.map((transactionType) => ({
          id: transactionType.id,
          flowKind: transactionType.flowKind
        }))
    },
    planItem: {
      findMany: async (args?: {
        select?: {
          recurringRuleId?: boolean;
          plannedDate?: boolean;
        };
      }) => {
        if (args?.select) {
          return state.planItems.map((item) => ({
            recurringRuleId: item.recurringRuleId,
            plannedDate: item.plannedDate
          }));
        }

        return state.planItems
          .map((item) => {
            const matchedCollectedTransaction =
              state.collectedTransactions.find(
                (transaction) => transaction.matchedPlanItemId === item.id
              ) ?? null;

            return {
              id: item.id,
              periodId: item.periodId,
              title: item.title,
              plannedDate: item.plannedDate,
              plannedAmount: item.plannedAmount,
              status: item.status,
              recurringRule:
                item.recurringRuleId == null
                  ? null
                  : (state.recurringRules
                      .filter((rule) => rule.id === item.recurringRuleId)
                      .map((rule) => ({
                        id: rule.id,
                        title: rule.title
                      }))[0] ?? null),
              ledgerTransactionType: state.transactionTypes.find(
                (transactionType) =>
                  transactionType.id === item.ledgerTransactionTypeId
              ) ?? { name: '알 수 없는 유형' },
              fundingAccount: state.accounts.find(
                (account) => account.id === item.fundingAccountId
              ) ?? { name: '알 수 없는 자금수단' },
              category:
                item.categoryId == null
                  ? null
                  : (state.categories
                      .filter((category) => category.id === item.categoryId)
                      .map((category) => ({
                        name: category.name
                      }))[0] ?? null),
              matchedCollectedTransaction: matchedCollectedTransaction
                ? {
                    id: matchedCollectedTransaction.id,
                    title: matchedCollectedTransaction.title,
                    status: matchedCollectedTransaction.status
                  }
                : null,
              postedJournalEntry: null
            };
          })
          .sort(
            (left, right) =>
              left.plannedDate.getTime() - right.plannedDate.getTime()
          );
      },
      create: async (args: {
        data: {
          tenantId: string;
          ledgerId: string;
          periodId: string;
          recurringRuleId: string;
          ledgerTransactionTypeId: string;
          fundingAccountId: string;
          categoryId?: string;
          title: string;
          plannedAmount: number;
          plannedDate: Date;
          status: PlanItemStatus;
          matchedCollectedTransaction?: {
            create: {
              tenantId: string;
              ledgerId: string;
              periodId: string;
              ledgerTransactionTypeId: string;
              fundingAccountId: string;
              categoryId?: string;
              title: string;
              occurredOn: Date;
              amount: number;
              status: CollectedTransactionStatus;
            };
          };
        };
      }) => {
        const createdPlanItemId = `plan-${state.planItems.length + 1}`;

        state.planItems.push({
          id: createdPlanItemId,
          tenantId: args.data.tenantId,
          ledgerId: args.data.ledgerId,
          periodId: args.data.periodId,
          recurringRuleId: args.data.recurringRuleId,
          ledgerTransactionTypeId: args.data.ledgerTransactionTypeId,
          fundingAccountId: args.data.fundingAccountId,
          categoryId: args.data.categoryId ?? null,
          title: args.data.title,
          plannedAmount: args.data.plannedAmount,
          plannedDate: args.data.plannedDate,
          status: args.data.status
        });

        if (args.data.matchedCollectedTransaction?.create) {
          state.collectedTransactions.push({
            id: `ctx-${state.collectedTransactions.length + 1}`,
            matchedPlanItemId: createdPlanItemId,
            title: args.data.matchedCollectedTransaction.create.title,
            status: args.data.matchedCollectedTransaction.create.status
          });
        }

        return {
          id: createdPlanItemId
        };
      }
    }
  };

  return prisma;
}
