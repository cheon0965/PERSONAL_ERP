import {
  AccountType,
  CategoryKind,
  FuelType,
  InsuranceCycle,
  PrismaClient,
  RecurrenceFrequency,
  TransactionOrigin,
  TransactionStatus,
  TransactionType
} from '@prisma/client';
import { getApiEnv } from '../src/config/api-env';
import { ensurePhase1BackboneForUser } from './phase1-backbone';

const prisma = new PrismaClient();
const env = getApiEnv();

const DEMO_USER_NAME = 'Demo User';
const DEMO_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$3ll7sYB+i6Mbu6ejL/Icsg$MMsVJm1vVDC7nX3g7xZfQebqzQ5zqj5VqGiLDRColEI';

const DEMO_SETTINGS = {
  minimumReserveWon: 400000,
  monthlySinkingFundWon: 140000,
  timezone: 'Asia/Seoul'
} as const;

const DEMO_ACCOUNTS = [
  { key: 'mainAccount', name: '주거래 통장', type: AccountType.BANK, balanceWon: 2450000, sortOrder: 1 },
  { key: 'lifeAccount', name: '생활비 통장', type: AccountType.BANK, balanceWon: 430000, sortOrder: 2 },
  { key: 'cardAccount', name: '신용카드', type: AccountType.CARD, balanceWon: 300000, sortOrder: 3 }
] as const;

const DEMO_CATEGORIES = [
  { key: 'salaryCategory', name: '급여', kind: CategoryKind.INCOME, sortOrder: 1 },
  { key: 'foodCategory', name: '식비', kind: CategoryKind.EXPENSE, sortOrder: 2 },
  { key: 'insuranceCategory', name: '보험', kind: CategoryKind.EXPENSE, sortOrder: 3 },
  { key: 'fuelCategory', name: '주유', kind: CategoryKind.EXPENSE, sortOrder: 4 },
  { key: 'telecomCategory', name: '통신비', kind: CategoryKind.EXPENSE, sortOrder: 5 },
  { key: 'installmentCategory', name: '차량 할부', kind: CategoryKind.EXPENSE, sortOrder: 6 }
] as const;

const DEMO_TRANSACTIONS = [
  {
    title: '3월 급여',
    type: TransactionType.INCOME,
    amountWon: 3200000,
    businessDate: new Date('2026-03-01T00:00:00.000Z'),
    accountKey: 'mainAccount',
    categoryKey: 'salaryCategory',
    origin: TransactionOrigin.MANUAL,
    status: TransactionStatus.POSTED
  },
  {
    title: '차량 주유',
    type: TransactionType.EXPENSE,
    amountWon: 84000,
    businessDate: new Date('2026-03-03T00:00:00.000Z'),
    accountKey: 'lifeAccount',
    categoryKey: 'fuelCategory',
    origin: TransactionOrigin.MANUAL,
    status: TransactionStatus.POSTED
  },
  {
    title: '통신비 자동이체',
    type: TransactionType.EXPENSE,
    amountWon: 75000,
    businessDate: new Date('2026-03-10T00:00:00.000Z'),
    accountKey: 'mainAccount',
    categoryKey: 'telecomCategory',
    origin: TransactionOrigin.RECURRING,
    status: TransactionStatus.POSTED
  },
  {
    title: '장보기',
    type: TransactionType.EXPENSE,
    amountWon: 126000,
    businessDate: new Date('2026-03-12T00:00:00.000Z'),
    accountKey: 'lifeAccount',
    categoryKey: 'foodCategory',
    origin: TransactionOrigin.MANUAL,
    status: TransactionStatus.POSTED
  }
] as const;

const DEMO_RECURRING_RULES = [
  {
    title: '통신비',
    amountWon: 75000,
    frequency: RecurrenceFrequency.MONTHLY,
    dayOfMonth: 10,
    startDate: new Date('2026-01-10T00:00:00.000Z'),
    nextRunDate: new Date('2026-04-10T00:00:00.000Z'),
    accountKey: 'mainAccount',
    categoryKey: 'telecomCategory'
  },
  {
    title: '차량 할부',
    amountWon: 280000,
    frequency: RecurrenceFrequency.MONTHLY,
    dayOfMonth: 3,
    startDate: new Date('2026-01-03T00:00:00.000Z'),
    nextRunDate: new Date('2026-04-03T00:00:00.000Z'),
    accountKey: 'mainAccount',
    categoryKey: 'installmentCategory'
  },
  {
    title: '자동차 보험료',
    amountWon: 98000,
    frequency: RecurrenceFrequency.MONTHLY,
    dayOfMonth: 25,
    startDate: new Date('2026-01-25T00:00:00.000Z'),
    nextRunDate: new Date('2026-04-25T00:00:00.000Z'),
    accountKey: 'mainAccount',
    categoryKey: 'insuranceCategory'
  },
  {
    title: '치아 보험료',
    amountWon: 43000,
    frequency: RecurrenceFrequency.MONTHLY,
    dayOfMonth: 25,
    startDate: new Date('2026-01-25T00:00:00.000Z'),
    nextRunDate: new Date('2026-04-25T00:00:00.000Z'),
    accountKey: 'mainAccount',
    categoryKey: 'insuranceCategory'
  }
] as const;

const DEMO_INSURANCE_POLICIES = [
  {
    provider: '삼성화재',
    productName: '자동차 보험',
    monthlyPremiumWon: 98000,
    paymentDay: 25,
    cycle: InsuranceCycle.MONTHLY,
    renewalDate: new Date('2026-11-01T00:00:00.000Z'),
    isActive: true
  },
  {
    provider: '메리츠',
    productName: '치아 보험',
    monthlyPremiumWon: 43000,
    paymentDay: 25,
    cycle: InsuranceCycle.MONTHLY,
    renewalDate: new Date('2026-09-15T00:00:00.000Z'),
    isActive: true
  }
] as const;

const DEMO_VEHICLE = {
  name: 'G80 3.3',
  manufacturer: 'Genesis',
  fuelType: FuelType.GASOLINE,
  initialOdometerKm: 128000,
  monthlyExpenseWon: 286000,
  estimatedFuelEfficiencyKmPerLiter: '8.90'
} as const;

const DEMO_FUEL_LOGS = [
  {
    filledOn: new Date('2026-03-03T00:00:00.000Z'),
    odometerKm: 128240,
    liters: '52.300',
    amountWon: 84000,
    unitPriceWon: 1606,
    isFullTank: true
  },
  {
    filledOn: new Date('2026-03-15T00:00:00.000Z'),
    odometerKm: 128695,
    liters: '49.600',
    amountWon: 80100,
    unitPriceWon: 1615,
    isFullTank: true
  }
] as const;

type SummaryItem = {
  created: number;
  skipped: number;
};

type SeedSummary = {
  resetDemoUser: boolean;
  user: SummaryItem;
  settings: SummaryItem;
  accounts: SummaryItem;
  categories: SummaryItem;
  transactions: SummaryItem;
  recurringRules: SummaryItem;
  insurancePolicies: SummaryItem;
  vehicles: SummaryItem;
  fuelLogs: SummaryItem;
};

function createSummary(): SeedSummary {
  return {
    resetDemoUser: false,
    user: { created: 0, skipped: 0 },
    settings: { created: 0, skipped: 0 },
    accounts: { created: 0, skipped: 0 },
    categories: { created: 0, skipped: 0 },
    transactions: { created: 0, skipped: 0 },
    recurringRules: { created: 0, skipped: 0 },
    insurancePolicies: { created: 0, skipped: 0 },
    vehicles: { created: 0, skipped: 0 },
    fuelLogs: { created: 0, skipped: 0 }
  };
}

function printSummary(summary: SeedSummary) {
  const lines = [
    '[INFO] Demo seed summary',
    `  - demo user reset: ${summary.resetDemoUser ? 'yes' : 'no'}`,
    `  - user: created ${summary.user.created}, skipped ${summary.user.skipped}`,
    `  - settings: created ${summary.settings.created}, skipped ${summary.settings.skipped}`,
    `  - accounts: created ${summary.accounts.created}, skipped ${summary.accounts.skipped}`,
    `  - categories: created ${summary.categories.created}, skipped ${summary.categories.skipped}`,
    `  - transactions: created ${summary.transactions.created}, skipped ${summary.transactions.skipped}`,
    `  - recurring rules: created ${summary.recurringRules.created}, skipped ${summary.recurringRules.skipped}`,
    `  - insurance policies: created ${summary.insurancePolicies.created}, skipped ${summary.insurancePolicies.skipped}`,
    `  - vehicles: created ${summary.vehicles.created}, skipped ${summary.vehicles.skipped}`,
    `  - fuel logs: created ${summary.fuelLogs.created}, skipped ${summary.fuelLogs.skipped}`
  ];

  console.log(lines.join('\n'));
}

async function ensureDemoUser(summary: SeedSummary) {
  const existingUser = await prisma.user.findUnique({
    where: { email: env.DEMO_EMAIL },
    select: { id: true }
  });

  if (existingUser) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        name: DEMO_USER_NAME,
        passwordHash: DEMO_PASSWORD_HASH
      }
    });

    summary.user.skipped += 1;
    return existingUser.id;
  }

  const createdUser = await prisma.user.create({
    data: {
      email: env.DEMO_EMAIL,
      passwordHash: DEMO_PASSWORD_HASH,
      name: DEMO_USER_NAME
    },
    select: { id: true }
  });

  summary.user.created += 1;
  return createdUser.id;
}

async function ensureDemoSettings(userId: string, summary: SeedSummary) {
  const existingSettings = await prisma.userSetting.findUnique({
    where: { userId },
    select: { id: true }
  });

  if (existingSettings) {
    summary.settings.skipped += 1;
    return;
  }

  await prisma.userSetting.create({
    data: {
      userId,
      ...DEMO_SETTINGS
    }
  });

  summary.settings.created += 1;
}

async function ensureDemoAccounts(
  userId: string,
  tenantId: string,
  ledgerId: string,
  summary: SeedSummary
) {
  const existingAccounts = await prisma.account.findMany({
    where: { userId },
    select: { id: true, name: true, type: true, sortOrder: true }
  });

  const accountIds = new Map<(typeof DEMO_ACCOUNTS)[number]['key'], string>();

  for (const account of DEMO_ACCOUNTS) {
    const existingAccount =
      existingAccounts.find(
        (item) => item.sortOrder === account.sortOrder && item.type === account.type
      ) ?? existingAccounts.find((item) => item.name === account.name && item.type === account.type);

    if (existingAccount) {
      accountIds.set(account.key, existingAccount.id);
      summary.accounts.skipped += 1;
      continue;
    }

    const createdAccount = await prisma.account.create({
      data: {
        userId,
        tenantId,
        ledgerId,
        name: account.name,
        type: account.type,
        balanceWon: account.balanceWon,
        sortOrder: account.sortOrder
      },
      select: { id: true }
    });

    accountIds.set(account.key, createdAccount.id);
    summary.accounts.created += 1;
  }

  return accountIds;
}

async function ensureDemoCategories(
  userId: string,
  tenantId: string,
  ledgerId: string,
  summary: SeedSummary
) {
  const existingCategories = await prisma.category.findMany({
    where: { userId },
    select: { id: true, name: true, kind: true, sortOrder: true }
  });

  const categoryIds = new Map<(typeof DEMO_CATEGORIES)[number]['key'], string>();

  for (const category of DEMO_CATEGORIES) {
    const existingCategory =
      existingCategories.find(
        (item) => item.sortOrder === category.sortOrder && item.kind === category.kind
      ) ?? existingCategories.find((item) => item.name === category.name && item.kind === category.kind);

    if (existingCategory) {
      categoryIds.set(category.key, existingCategory.id);
      summary.categories.skipped += 1;
      continue;
    }

    const createdCategory = await prisma.category.create({
      data: {
        userId,
        tenantId,
        ledgerId,
        name: category.name,
        kind: category.kind,
        sortOrder: category.sortOrder
      },
      select: { id: true }
    });

    categoryIds.set(category.key, createdCategory.id);
    summary.categories.created += 1;
  }

  return categoryIds;
}

async function ensureDemoTransactions(
  userId: string,
  tenantId: string,
  ledgerId: string,
  accountIds: Map<(typeof DEMO_ACCOUNTS)[number]['key'], string>,
  categoryIds: Map<(typeof DEMO_CATEGORIES)[number]['key'], string>,
  summary: SeedSummary
) {
  for (const transaction of DEMO_TRANSACTIONS) {
    const accountId = accountIds.get(transaction.accountKey);
    const categoryId = categoryIds.get(transaction.categoryKey);

    if (!accountId || !categoryId) {
      throw new Error(`Missing seed reference for transaction: ${transaction.title}`);
    }

    const existingTransaction = await prisma.transaction.findFirst({
      where: {
        userId,
        type: transaction.type,
        amountWon: transaction.amountWon,
        businessDate: transaction.businessDate,
        accountId,
        origin: transaction.origin
      },
      select: { id: true }
    });

    if (existingTransaction) {
      summary.transactions.skipped += 1;
      continue;
    }

    await prisma.transaction.create({
      data: {
        userId,
        tenantId,
        ledgerId,
        title: transaction.title,
        type: transaction.type,
        amountWon: transaction.amountWon,
        businessDate: transaction.businessDate,
        accountId,
        categoryId,
        origin: transaction.origin,
        status: transaction.status
      }
    });

    summary.transactions.created += 1;
  }
}

async function ensureDemoRecurringRules(
  userId: string,
  tenantId: string,
  ledgerId: string,
  accountIds: Map<(typeof DEMO_ACCOUNTS)[number]['key'], string>,
  categoryIds: Map<(typeof DEMO_CATEGORIES)[number]['key'], string>,
  summary: SeedSummary
) {
  for (const rule of DEMO_RECURRING_RULES) {
    const accountId = accountIds.get(rule.accountKey);
    const categoryId = categoryIds.get(rule.categoryKey);

    if (!accountId || !categoryId) {
      throw new Error(`Missing seed reference for recurring rule: ${rule.title}`);
    }

    const existingRule = await prisma.recurringRule.findFirst({
      where: {
        userId,
        accountId,
        amountWon: rule.amountWon,
        frequency: rule.frequency,
        dayOfMonth: rule.dayOfMonth
      },
      select: { id: true }
    });

    if (existingRule) {
      summary.recurringRules.skipped += 1;
      continue;
    }

    await prisma.recurringRule.create({
      data: {
        userId,
        tenantId,
        ledgerId,
        accountId,
        categoryId,
        title: rule.title,
        amountWon: rule.amountWon,
        frequency: rule.frequency,
        dayOfMonth: rule.dayOfMonth,
        startDate: rule.startDate,
        nextRunDate: rule.nextRunDate,
        isActive: true
      }
    });

    summary.recurringRules.created += 1;
  }
}

async function ensureDemoInsurancePolicies(userId: string, summary: SeedSummary) {
  for (const policy of DEMO_INSURANCE_POLICIES) {
    const existingPolicy = await prisma.insurancePolicy.findFirst({
      where: {
        userId,
        monthlyPremiumWon: policy.monthlyPremiumWon,
        paymentDay: policy.paymentDay,
        cycle: policy.cycle
      },
      select: { id: true }
    });

    if (existingPolicy) {
      summary.insurancePolicies.skipped += 1;
      continue;
    }

    await prisma.insurancePolicy.create({
      data: {
        userId,
        provider: policy.provider,
        productName: policy.productName,
        monthlyPremiumWon: policy.monthlyPremiumWon,
        paymentDay: policy.paymentDay,
        cycle: policy.cycle,
        renewalDate: policy.renewalDate,
        isActive: policy.isActive
      }
    });

    summary.insurancePolicies.created += 1;
  }
}

async function ensureDemoVehicle(userId: string, summary: SeedSummary) {
  const existingVehicle = await prisma.vehicle.findFirst({
    where: {
      userId,
      name: DEMO_VEHICLE.name
    },
    select: { id: true }
  });

  if (existingVehicle) {
    summary.vehicles.skipped += 1;
    return existingVehicle.id;
  }

  const createdVehicle = await prisma.vehicle.create({
    data: {
      userId,
      ...DEMO_VEHICLE
    },
    select: { id: true }
  });

  summary.vehicles.created += 1;
  return createdVehicle.id;
}

async function ensureDemoFuelLogs(vehicleId: string, summary: SeedSummary) {
  for (const fuelLog of DEMO_FUEL_LOGS) {
    const existingFuelLog = await prisma.fuelLog.findFirst({
      where: {
        vehicleId,
        filledOn: fuelLog.filledOn,
        odometerKm: fuelLog.odometerKm
      },
      select: { id: true }
    });

    if (existingFuelLog) {
      summary.fuelLogs.skipped += 1;
      continue;
    }

    await prisma.fuelLog.create({
      data: {
        vehicleId,
        ...fuelLog
      }
    });

    summary.fuelLogs.created += 1;
  }
}

async function resetDemoUserIfRequested(summary: SeedSummary) {
  const shouldReset = process.argv.includes('--reset');

  if (!shouldReset) {
    return;
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: env.DEMO_EMAIL },
    select: { id: true }
  });

  if (!existingUser) {
    return;
  }

  await prisma.user.delete({ where: { id: existingUser.id } });
  summary.resetDemoUser = true;
}

async function main() {
  const summary = createSummary();

  await resetDemoUserIfRequested(summary);

  const userId = await ensureDemoUser(summary);
  await ensureDemoSettings(userId, summary);
  const backbone = await ensurePhase1BackboneForUser(prisma, userId);

  const accountIds = await ensureDemoAccounts(userId, backbone.tenantId, backbone.ledgerId, summary);
  const categoryIds = await ensureDemoCategories(userId, backbone.tenantId, backbone.ledgerId, summary);

  await ensureDemoTransactions(
    userId,
    backbone.tenantId,
    backbone.ledgerId,
    accountIds,
    categoryIds,
    summary
  );
  await ensureDemoRecurringRules(
    userId,
    backbone.tenantId,
    backbone.ledgerId,
    accountIds,
    categoryIds,
    summary
  );
  await ensureDemoInsurancePolicies(userId, summary);

  const vehicleId = await ensureDemoVehicle(userId, summary);
  await ensureDemoFuelLogs(vehicleId, summary);
  await ensurePhase1BackboneForUser(prisma, userId);

  printSummary(summary);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
