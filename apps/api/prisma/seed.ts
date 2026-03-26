import { PrismaClient, AccountType, CategoryKind, TransactionOrigin, TransactionStatus, TransactionType, RecurrenceFrequency, InsuranceCycle, FuelType } from '@prisma/client';
import { getApiEnv } from '../src/config/api-env';

const prisma = new PrismaClient();
const env = getApiEnv();

async function main() {
  await prisma.fuelLog.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.insurancePolicy.deleteMany();
  await prisma.recurringRule.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.category.deleteMany();
  await prisma.account.deleteMany();
  await prisma.userSetting.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: {
      email: env.DEMO_EMAIL,
      passwordHash:
        '$argon2id$v=19$m=65536,t=3,p=4$3ll7sYB+i6Mbu6ejL/Icsg$MMsVJm1vVDC7nX3g7xZfQebqzQ5zqj5VqGiLDRColEI',
      name: 'Demo User',
      settings: {
        create: {
          minimumReserveWon: 400000,
          monthlySinkingFundWon: 140000,
          timezone: 'Asia/Seoul'
        }
      }
    }
  });

  const [mainAccount, lifeAccount, _cardAccount] = await Promise.all([
    prisma.account.create({ data: { userId: user.id, name: '주계좌', type: AccountType.BANK, balanceWon: 2450000, sortOrder: 1 } }),
    prisma.account.create({ data: { userId: user.id, name: '생활비통장', type: AccountType.BANK, balanceWon: 430000, sortOrder: 2 } }),
    prisma.account.create({ data: { userId: user.id, name: '신용카드', type: AccountType.CARD, balanceWon: 300000, sortOrder: 3 } })
  ]);

  const [salaryCategory, foodCategory, insuranceCategory, fuelCategory, telecomCategory, installmentCategory] = await Promise.all([
    prisma.category.create({ data: { userId: user.id, name: '급여', kind: CategoryKind.INCOME, sortOrder: 1 } }),
    prisma.category.create({ data: { userId: user.id, name: '식비', kind: CategoryKind.EXPENSE, sortOrder: 2 } }),
    prisma.category.create({ data: { userId: user.id, name: '보험료', kind: CategoryKind.EXPENSE, sortOrder: 3 } }),
    prisma.category.create({ data: { userId: user.id, name: '주유비', kind: CategoryKind.EXPENSE, sortOrder: 4 } }),
    prisma.category.create({ data: { userId: user.id, name: '통신비', kind: CategoryKind.EXPENSE, sortOrder: 5 } }),
    prisma.category.create({ data: { userId: user.id, name: '차량할부', kind: CategoryKind.EXPENSE, sortOrder: 6 } })
  ]);

  await prisma.transaction.createMany({
    data: [
      { userId: user.id, title: '3월 급여', type: TransactionType.INCOME, amountWon: 3200000, businessDate: new Date('2026-03-01'), accountId: mainAccount.id, categoryId: salaryCategory.id, origin: TransactionOrigin.MANUAL, status: TransactionStatus.POSTED },
      { userId: user.id, title: '차량 주유', type: TransactionType.EXPENSE, amountWon: 84000, businessDate: new Date('2026-03-03'), accountId: lifeAccount.id, categoryId: fuelCategory.id, origin: TransactionOrigin.MANUAL, status: TransactionStatus.POSTED },
      { userId: user.id, title: '통신비 자동이체', type: TransactionType.EXPENSE, amountWon: 75000, businessDate: new Date('2026-03-10'), accountId: mainAccount.id, categoryId: telecomCategory.id, origin: TransactionOrigin.RECURRING, status: TransactionStatus.POSTED },
      { userId: user.id, title: '식재료 장보기', type: TransactionType.EXPENSE, amountWon: 126000, businessDate: new Date('2026-03-12'), accountId: lifeAccount.id, categoryId: foodCategory.id, origin: TransactionOrigin.MANUAL, status: TransactionStatus.POSTED }
    ]
  });

  await prisma.recurringRule.createMany({
    data: [
      { userId: user.id, accountId: mainAccount.id, categoryId: telecomCategory.id, title: '통신비', amountWon: 75000, frequency: RecurrenceFrequency.MONTHLY, dayOfMonth: 10, startDate: new Date('2026-01-10'), nextRunDate: new Date('2026-04-10'), isActive: true },
      { userId: user.id, accountId: mainAccount.id, categoryId: installmentCategory.id, title: '차량 할부', amountWon: 280000, frequency: RecurrenceFrequency.MONTHLY, dayOfMonth: 3, startDate: new Date('2026-01-03'), nextRunDate: new Date('2026-04-03'), isActive: true },
      { userId: user.id, accountId: mainAccount.id, categoryId: insuranceCategory.id, title: '자동차 보험료', amountWon: 98000, frequency: RecurrenceFrequency.MONTHLY, dayOfMonth: 25, startDate: new Date('2026-01-25'), nextRunDate: new Date('2026-04-25'), isActive: true },
      { userId: user.id, accountId: mainAccount.id, categoryId: insuranceCategory.id, title: '실손 보험료', amountWon: 43000, frequency: RecurrenceFrequency.MONTHLY, dayOfMonth: 25, startDate: new Date('2026-01-25'), nextRunDate: new Date('2026-04-25'), isActive: true }
    ]
  });

  await prisma.insurancePolicy.createMany({
    data: [
      { userId: user.id, provider: '삼성화재', productName: '자동차보험', monthlyPremiumWon: 98000, paymentDay: 25, cycle: InsuranceCycle.MONTHLY, renewalDate: new Date('2026-11-01'), isActive: true },
      { userId: user.id, provider: '메리츠', productName: '실손보험', monthlyPremiumWon: 43000, paymentDay: 25, cycle: InsuranceCycle.MONTHLY, renewalDate: new Date('2026-09-15'), isActive: true }
    ]
  });

  const vehicle = await prisma.vehicle.create({
    data: {
      userId: user.id,
      name: 'G80 3.3',
      manufacturer: 'Genesis',
      fuelType: FuelType.GASOLINE,
      initialOdometerKm: 128000,
      monthlyExpenseWon: 286000,
      estimatedFuelEfficiencyKmPerLiter: '8.90'
    }
  });

  await prisma.fuelLog.createMany({
    data: [
      { vehicleId: vehicle.id, filledOn: new Date('2026-03-03'), odometerKm: 128240, liters: '52.300', amountWon: 84000, unitPriceWon: 1606, isFullTank: true },
      { vehicleId: vehicle.id, filledOn: new Date('2026-03-15'), odometerKm: 128695, liters: '49.600', amountWon: 80100, unitPriceWon: 1615, isFullTank: true }
    ]
  });

  console.log('Seed completed');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
