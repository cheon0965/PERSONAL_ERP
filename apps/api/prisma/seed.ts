import {
  AccountType,
  CategoryKind,
  FuelType,
  InsuranceCycle,
  PrismaClient,
  RecurrenceFrequency,
  VehicleMaintenanceCategory
} from '@prisma/client';
import { getApiEnv } from '../src/config/api-env';
import { normalizeCaseInsensitiveText } from '../src/common/utils/normalize-unique-key.util';
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
  {
    key: 'mainAccount',
    name: '사업 운영 통장',
    type: AccountType.BANK,
    balanceWon: 2450000,
    sortOrder: 1
  },
  {
    key: 'reserveAccount',
    name: '비용 예비 통장',
    type: AccountType.BANK,
    balanceWon: 430000,
    sortOrder: 2
  },
  {
    key: 'cardAccount',
    name: '사업용 카드',
    type: AccountType.CARD,
    balanceWon: 300000,
    sortOrder: 3
  }
] as const;

const DEMO_CATEGORIES = [
  {
    key: 'salesCategory',
    name: '매출 입금',
    kind: CategoryKind.INCOME,
    sortOrder: 1
  },
  {
    key: 'materialCategory',
    name: '원재료비',
    kind: CategoryKind.EXPENSE,
    sortOrder: 2
  },
  {
    key: 'insuranceCategory',
    name: '사업 보험료',
    kind: CategoryKind.EXPENSE,
    sortOrder: 3
  },
  {
    key: 'fuelCategory',
    name: '배송 차량 유지비',
    kind: CategoryKind.EXPENSE,
    sortOrder: 4
  },
  {
    key: 'utilitiesCategory',
    name: '통신·POS 비용',
    kind: CategoryKind.EXPENSE,
    sortOrder: 5
  },
  {
    key: 'packagingCategory',
    name: '포장재/소모품',
    kind: CategoryKind.EXPENSE,
    sortOrder: 6
  }
] as const;

const DEMO_RECURRING_RULES = [
  {
    key: 'utilitiesRule',
    title: 'POS/인터넷 요금',
    amountWon: 75000,
    frequency: RecurrenceFrequency.MONTHLY,
    dayOfMonth: 10,
    startDate: new Date('2026-01-10T00:00:00.000Z'),
    nextRunDate: new Date('2026-04-10T00:00:00.000Z'),
    accountKey: 'mainAccount',
    categoryKey: 'utilitiesCategory'
  },
  {
    key: 'packagingRule',
    title: '정기 소모품 보충',
    amountWon: 280000,
    frequency: RecurrenceFrequency.MONTHLY,
    dayOfMonth: 3,
    startDate: new Date('2026-01-03T00:00:00.000Z'),
    nextRunDate: new Date('2026-04-03T00:00:00.000Z'),
    accountKey: 'mainAccount',
    categoryKey: 'packagingCategory'
  },
  {
    key: 'vehicleInsuranceRule',
    title: '업무용 차량 보험료',
    amountWon: 98000,
    frequency: RecurrenceFrequency.MONTHLY,
    dayOfMonth: 25,
    startDate: new Date('2026-01-25T00:00:00.000Z'),
    nextRunDate: new Date('2026-04-25T00:00:00.000Z'),
    accountKey: 'mainAccount',
    categoryKey: 'insuranceCategory'
  },
  {
    key: 'liabilityInsuranceRule',
    title: '영업배상 책임보험료',
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
    productName: '업무용 차량 보험',
    monthlyPremiumWon: 98000,
    paymentDay: 25,
    cycle: InsuranceCycle.MONTHLY,
    accountKey: 'mainAccount',
    categoryKey: 'insuranceCategory',
    recurringStartDate: new Date('2026-01-25T00:00:00.000Z'),
    linkedRecurringRuleKey: 'vehicleInsuranceRule',
    renewalDate: new Date('2026-11-01T00:00:00.000Z'),
    isActive: true
  },
  {
    provider: 'DB손해보험',
    productName: '영업배상 책임보험',
    monthlyPremiumWon: 43000,
    paymentDay: 25,
    cycle: InsuranceCycle.MONTHLY,
    accountKey: 'mainAccount',
    categoryKey: 'insuranceCategory',
    recurringStartDate: new Date('2026-01-25T00:00:00.000Z'),
    linkedRecurringRuleKey: 'liabilityInsuranceRule',
    renewalDate: new Date('2026-09-15T00:00:00.000Z'),
    isActive: true
  }
] as const;

const DEMO_VEHICLE = {
  name: '포터2 배송차량',
  manufacturer: 'Hyundai',
  fuelType: FuelType.DIESEL,
  initialOdometerKm: 128000,
  estimatedFuelEfficiencyKmPerLiter: '10.80'
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

const DEMO_VEHICLE_MAINTENANCE_LOGS = [
  {
    performedOn: new Date('2026-03-21T00:00:00.000Z'),
    odometerKm: 128720,
    category: VehicleMaintenanceCategory.REPAIR,
    vendor: '현대 블루핸즈',
    description: '브레이크 패드 교체',
    amountWon: 185000,
    memo: '전륜 패드 기준'
  },
  {
    performedOn: new Date('2026-03-28T00:00:00.000Z'),
    odometerKm: 128940,
    category: VehicleMaintenanceCategory.INSPECTION,
    vendor: '현대 블루핸즈',
    description: '엔진오일 점검',
    amountWon: 42000,
    memo: null
  }
] as const;

// Demo seed does not create rows for the removed Transaction table.
// Any pre-phase1 residue should come only from explicit backbone
// backfill/rollback workflows.

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
  recurringRules: SummaryItem;
  insurancePolicies: SummaryItem;
  vehicles: SummaryItem;
  fuelLogs: SummaryItem;
  maintenanceLogs: SummaryItem;
};

function createSummary(): SeedSummary {
  return {
    resetDemoUser: false,
    user: { created: 0, skipped: 0 },
    settings: { created: 0, skipped: 0 },
    accounts: { created: 0, skipped: 0 },
    categories: { created: 0, skipped: 0 },
    recurringRules: { created: 0, skipped: 0 },
    insurancePolicies: { created: 0, skipped: 0 },
    vehicles: { created: 0, skipped: 0 },
    fuelLogs: { created: 0, skipped: 0 },
    maintenanceLogs: { created: 0, skipped: 0 }
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
    '  - removed Transaction table rows: not seeded',
    `  - recurring rules: created ${summary.recurringRules.created}, skipped ${summary.recurringRules.skipped}`,
    `  - insurance policies: created ${summary.insurancePolicies.created}, skipped ${summary.insurancePolicies.skipped}`,
    `  - vehicles: created ${summary.vehicles.created}, skipped ${summary.vehicles.skipped}`,
    `  - fuel logs: created ${summary.fuelLogs.created}, skipped ${summary.fuelLogs.skipped}`,
    `  - maintenance logs: created ${summary.maintenanceLogs.created}, skipped ${summary.maintenanceLogs.skipped}`
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
    where: { tenantId, ledgerId },
    select: { id: true, name: true, type: true, sortOrder: true }
  });

  const accountIds = new Map<(typeof DEMO_ACCOUNTS)[number]['key'], string>();

  for (const account of DEMO_ACCOUNTS) {
    const existingAccount =
      existingAccounts.find(
        (item) =>
          item.sortOrder === account.sortOrder && item.type === account.type
      ) ??
      existingAccounts.find(
        (item) => item.name === account.name && item.type === account.type
      );

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
        normalizedName: normalizeCaseInsensitiveText(account.name),
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
    where: { tenantId, ledgerId },
    select: { id: true, name: true, kind: true, sortOrder: true }
  });

  const categoryIds = new Map<
    (typeof DEMO_CATEGORIES)[number]['key'],
    string
  >();

  for (const category of DEMO_CATEGORIES) {
    const existingCategory =
      existingCategories.find(
        (item) =>
          item.sortOrder === category.sortOrder && item.kind === category.kind
      ) ??
      existingCategories.find(
        (item) => item.name === category.name && item.kind === category.kind
      );

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
        normalizedName: normalizeCaseInsensitiveText(category.name),
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

async function ensureDemoRecurringRules(
  userId: string,
  tenantId: string,
  ledgerId: string,
  accountIds: Map<(typeof DEMO_ACCOUNTS)[number]['key'], string>,
  categoryIds: Map<(typeof DEMO_CATEGORIES)[number]['key'], string>,
  summary: SeedSummary
) {
  const recurringRuleIds = new Map<
    (typeof DEMO_RECURRING_RULES)[number]['key'],
    string
  >();

  for (const rule of DEMO_RECURRING_RULES) {
    const accountId = accountIds.get(rule.accountKey);
    const categoryId = categoryIds.get(rule.categoryKey);

    if (!accountId || !categoryId) {
      throw new Error(
        `Missing seed reference for recurring rule: ${rule.title}`
      );
    }

    const existingRule = await prisma.recurringRule.findFirst({
      where: {
        tenantId,
        ledgerId,
        accountId,
        amountWon: rule.amountWon,
        frequency: rule.frequency,
        dayOfMonth: rule.dayOfMonth
      },
      select: { id: true }
    });

    if (existingRule) {
      recurringRuleIds.set(rule.key, existingRule.id);
      summary.recurringRules.skipped += 1;
      continue;
    }

    const createdRule = await prisma.recurringRule.create({
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
      },
      select: { id: true }
    });

    recurringRuleIds.set(rule.key, createdRule.id);
    summary.recurringRules.created += 1;
  }

  return recurringRuleIds;
}

async function ensureDemoInsurancePolicies(
  userId: string,
  tenantId: string,
  ledgerId: string,
  accountIds: Map<(typeof DEMO_ACCOUNTS)[number]['key'], string>,
  categoryIds: Map<(typeof DEMO_CATEGORIES)[number]['key'], string>,
  recurringRuleIds: Map<(typeof DEMO_RECURRING_RULES)[number]['key'], string>,
  summary: SeedSummary
) {
  for (const policy of DEMO_INSURANCE_POLICIES) {
    const accountId = accountIds.get(policy.accountKey);
    const categoryId = categoryIds.get(policy.categoryKey);
    const linkedRecurringRuleId = recurringRuleIds.get(
      policy.linkedRecurringRuleKey
    );

    if (!accountId || !categoryId || !linkedRecurringRuleId) {
      throw new Error(
        `Missing seed reference for insurance policy: ${policy.productName}`
      );
    }

    const existingPolicy = await prisma.insurancePolicy.findFirst({
      where: {
        tenantId,
        ledgerId,
        monthlyPremiumWon: policy.monthlyPremiumWon,
        paymentDay: policy.paymentDay,
        cycle: policy.cycle
      },
      select: { id: true }
    });

    if (existingPolicy) {
      await prisma.insurancePolicy.update({
        where: { id: existingPolicy.id },
        data: {
          accountId,
          categoryId,
          recurringStartDate: policy.recurringStartDate,
          linkedRecurringRuleId,
          provider: policy.provider,
          productName: policy.productName,
          monthlyPremiumWon: policy.monthlyPremiumWon,
          paymentDay: policy.paymentDay,
          cycle: policy.cycle,
          renewalDate: policy.renewalDate,
          isActive: policy.isActive
        }
      });

      summary.insurancePolicies.skipped += 1;
      continue;
    }

    await prisma.insurancePolicy.create({
      data: {
        userId,
        tenantId,
        ledgerId,
        accountId,
        categoryId,
        recurringStartDate: policy.recurringStartDate,
        linkedRecurringRuleId,
        provider: policy.provider,
        normalizedProvider: normalizeCaseInsensitiveText(policy.provider),
        productName: policy.productName,
        normalizedProductName: normalizeCaseInsensitiveText(policy.productName),
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

async function ensureDemoVehicle(
  userId: string,
  tenantId: string,
  ledgerId: string,
  summary: SeedSummary
) {
  const existingVehicle = await prisma.vehicle.findFirst({
    where: {
      tenantId,
      ledgerId,
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
      tenantId,
      ledgerId,
      normalizedName: normalizeCaseInsensitiveText(DEMO_VEHICLE.name),
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

async function ensureDemoVehicleMaintenanceLogs(
  vehicleId: string,
  summary: SeedSummary
) {
  for (const maintenanceLog of DEMO_VEHICLE_MAINTENANCE_LOGS) {
    const existingMaintenanceLog = await prisma.vehicleMaintenanceLog.findFirst({
      where: {
        vehicleId,
        performedOn: maintenanceLog.performedOn,
        odometerKm: maintenanceLog.odometerKm,
        description: maintenanceLog.description
      },
      select: { id: true }
    });

    if (existingMaintenanceLog) {
      summary.maintenanceLogs.skipped += 1;
      continue;
    }

    await prisma.vehicleMaintenanceLog.create({
      data: {
        vehicleId,
        ...maintenanceLog
      }
    });

    summary.maintenanceLogs.created += 1;
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

  const accountIds = await ensureDemoAccounts(
    userId,
    backbone.tenantId,
    backbone.ledgerId,
    summary
  );
  const categoryIds = await ensureDemoCategories(
    userId,
    backbone.tenantId,
    backbone.ledgerId,
    summary
  );
  const recurringRuleIds = await ensureDemoRecurringRules(
    userId,
    backbone.tenantId,
    backbone.ledgerId,
    accountIds,
    categoryIds,
    summary
  );
  await ensureDemoInsurancePolicies(
    userId,
    backbone.tenantId,
    backbone.ledgerId,
    accountIds,
    categoryIds,
    recurringRuleIds,
    summary
  );

  const vehicleId = await ensureDemoVehicle(
    userId,
    backbone.tenantId,
    backbone.ledgerId,
    summary
  );
  await ensureDemoFuelLogs(vehicleId, summary);
  await ensureDemoVehicleMaintenanceLogs(vehicleId, summary);
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

