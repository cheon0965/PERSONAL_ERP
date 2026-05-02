import {
  AccountType,
  AccountingPeriodEventType,
  AccountingPeriodStatus,
  AuditActorType,
  BalanceSnapshotKind,
  CategoryKind,
  CollectedTransactionStatus,
  FinancialStatementKind,
  FuelType,
  FundingAccountBootstrapStatus,
  FundingAccountStatus,
  ImportBatchParseStatus,
  ImportedRowParseStatus,
  ImportSourceKind,
  InsuranceCycle,
  JournalEntrySourceKind,
  JournalEntryStatus,
  LiabilityAgreementStatus,
  LiabilityInterestRateType,
  LiabilityRepaymentMethod,
  LiabilityRepaymentScheduleStatus,
  OpeningBalanceSourceKind,
  OperationalNoteKind,
  PlanItemStatus,
  Prisma,
  PrismaClient,
  RecurrenceFrequency,
  VehicleMaintenanceCategory
} from '@prisma/client';
import * as argon2 from 'argon2';
import { getApiEnv, type ApiEnv } from '../src/config/api-env';
import { buildSourceFingerprint } from '../src/modules/import-batches/import-batch.policy';
import { normalizeCaseInsensitiveText } from '../src/common/utils/normalize-unique-key.util';
import { resetDemoUserAndOwnedWorkspaces } from './demo-reset';
import { ensurePhase1BackboneForUser } from './phase1-backbone';

let prisma: PrismaClient;
let env: ApiEnv;
let defaultPrismaClient: PrismaClient | null = null;

const DEMO_USER_NAME = 'Demo User';
const DEMO_LOGIN_PHRASE = ['Demo', '1234!'].join('');
let demoCredentialDigestPromise: Promise<string>;

function getDefaultPrismaClient() {
  defaultPrismaClient ??= new PrismaClient();
  return defaultPrismaClient;
}

async function disconnectDefaultPrismaClient() {
  if (!defaultPrismaClient) {
    return;
  }

  await defaultPrismaClient.$disconnect();
  defaultPrismaClient = null;
}

const DEMO_SETTINGS = {
  minimumReserveWon: 400000,
  monthlySinkingFundWon: 140000,
  timezone: 'Asia/Seoul'
} as const;

const DEMO_ACTOR_TYPE = AuditActorType.TENANT_MEMBERSHIP;
const DEMO_OPENED_FROM_YEAR_MONTH = '2026-01';
const DEMO_CLOSED_THROUGH_YEAR_MONTH = '2026-03';

const DEMO_ACCOUNT_SUBJECT_CODES = {
  cash: '1010',
  liability: '2100',
  equity: '3100',
  income: '4100',
  expense: '5100'
} as const;

const DEMO_TRANSACTION_TYPE_CODES = {
  income: 'INCOME_BASIC',
  expense: 'EXPENSE_BASIC'
} as const;

const DEMO_ACCOUNTS = [
  {
    fixtureId: 'mainAccount',
    name: '사업 운영 통장',
    type: AccountType.BANK,
    balanceWon: 0,
    sortOrder: 1
  },
  {
    fixtureId: 'reserveAccount',
    name: '비용 예비 통장',
    type: AccountType.BANK,
    balanceWon: 0,
    sortOrder: 2
  },
  {
    fixtureId: 'cardAccount',
    name: '사업용 카드',
    type: AccountType.CARD,
    balanceWon: 0,
    sortOrder: 3
  }
] as const;

const DEMO_CATEGORIES = [
  {
    fixtureId: 'salesCategory',
    name: '매출 입금',
    kind: CategoryKind.INCOME,
    sortOrder: 1
  },
  {
    fixtureId: 'materialCategory',
    name: '원재료비',
    kind: CategoryKind.EXPENSE,
    sortOrder: 2
  },
  {
    fixtureId: 'insuranceCategory',
    name: '보험료',
    kind: CategoryKind.EXPENSE,
    sortOrder: 3
  },
  {
    fixtureId: 'fuelCategory',
    name: '유류비',
    kind: CategoryKind.EXPENSE,
    sortOrder: 4
  },
  {
    fixtureId: 'maintenanceCategory',
    name: '차량 정비비',
    kind: CategoryKind.EXPENSE,
    sortOrder: 5
  },
  {
    fixtureId: 'utilitiesCategory',
    name: '통신·POS 비용',
    kind: CategoryKind.EXPENSE,
    sortOrder: 6
  },
  {
    fixtureId: 'packagingCategory',
    name: '포장재/소모품',
    kind: CategoryKind.EXPENSE,
    sortOrder: 7
  },
  {
    fixtureId: 'rentCategory',
    name: '임차료',
    kind: CategoryKind.EXPENSE,
    sortOrder: 8
  },
  {
    fixtureId: 'deliveryCategory',
    name: '배송비',
    kind: CategoryKind.EXPENSE,
    sortOrder: 9
  },
  {
    fixtureId: 'marketingCategory',
    name: '광고·판촉비',
    kind: CategoryKind.EXPENSE,
    sortOrder: 10
  },
  {
    fixtureId: 'subscriptionCategory',
    name: '업무 도구 구독료',
    kind: CategoryKind.EXPENSE,
    sortOrder: 11
  },
  {
    fixtureId: 'financeCategory',
    name: '대출 이자/금융비용',
    kind: CategoryKind.EXPENSE,
    sortOrder: 12
  }
] as const;

const DEMO_RECURRING_RULES = [
  {
    fixtureId: 'packagingRule',
    title: '정기 소모품 보충',
    amountWon: 280000,
    frequency: RecurrenceFrequency.MONTHLY,
    dayOfMonth: 3,
    startDate: date('2026-01-03T00:00:00.000Z'),
    nextRunDate: date('2026-05-03T00:00:00.000Z'),
    accountKey: 'mainAccount',
    categoryKey: 'packagingCategory'
  },
  {
    fixtureId: 'rentRule',
    title: '월세 자동 이체',
    amountWon: 620000,
    frequency: RecurrenceFrequency.MONTHLY,
    dayOfMonth: 5,
    startDate: date('2026-01-05T00:00:00.000Z'),
    nextRunDate: date('2026-05-05T00:00:00.000Z'),
    accountKey: 'mainAccount',
    categoryKey: 'rentCategory'
  },
  {
    fixtureId: 'utilitiesRule',
    title: 'POS/인터넷 요금',
    amountWon: 75000,
    frequency: RecurrenceFrequency.MONTHLY,
    dayOfMonth: 10,
    startDate: date('2026-01-10T00:00:00.000Z'),
    nextRunDate: date('2026-05-10T00:00:00.000Z'),
    accountKey: 'mainAccount',
    categoryKey: 'utilitiesCategory'
  },
  {
    fixtureId: 'softwareRule',
    title: '업무 도구 구독료',
    amountWon: 39000,
    frequency: RecurrenceFrequency.MONTHLY,
    dayOfMonth: 15,
    startDate: date('2026-01-15T00:00:00.000Z'),
    nextRunDate: date('2026-05-15T00:00:00.000Z'),
    accountKey: 'mainAccount',
    categoryKey: 'subscriptionCategory'
  },
  {
    fixtureId: 'vehicleInsuranceRule',
    title: '업무용 차량 보험료',
    amountWon: 98000,
    frequency: RecurrenceFrequency.MONTHLY,
    dayOfMonth: 25,
    startDate: date('2026-01-25T00:00:00.000Z'),
    nextRunDate: date('2026-05-25T00:00:00.000Z'),
    accountKey: 'mainAccount',
    categoryKey: 'insuranceCategory'
  },
  {
    fixtureId: 'liabilityInsuranceRule',
    title: '영업배상 책임보험료',
    amountWon: 43000,
    frequency: RecurrenceFrequency.MONTHLY,
    dayOfMonth: 25,
    startDate: date('2026-01-25T00:00:00.000Z'),
    nextRunDate: date('2026-05-25T00:00:00.000Z'),
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
    recurringStartDate: date('2026-01-25T00:00:00.000Z'),
    linkedRecurringRuleKey: 'vehicleInsuranceRule',
    renewalDate: date('2026-11-01T00:00:00.000Z'),
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
    recurringStartDate: date('2026-01-25T00:00:00.000Z'),
    linkedRecurringRuleKey: 'liabilityInsuranceRule',
    renewalDate: date('2026-09-15T00:00:00.000Z'),
    isActive: true
  }
] as const;

const DEMO_LIABILITY_AGREEMENTS = [
  {
    fixtureId: 'workingCapitalLoan',
    lenderName: '하나은행',
    productName: '운전자금 대출',
    loanNumberLast4: '1207',
    principalAmount: 30000000,
    borrowedAt: date('2026-01-15T00:00:00.000Z'),
    maturityDate: date('2028-01-15T00:00:00.000Z'),
    interestRate: new Prisma.Decimal('4.2000'),
    interestRateType: LiabilityInterestRateType.FIXED,
    repaymentMethod: LiabilityRepaymentMethod.EQUAL_PAYMENT,
    paymentDay: 25,
    defaultFundingAccountKey: 'mainAccount',
    interestExpenseCategoryKey: 'financeCategory',
    feeExpenseCategoryKey: null,
    status: LiabilityAgreementStatus.ACTIVE,
    memo: '월 운영 현금흐름에서 원금과 이자를 분리 확인하는 데모 대출',
    schedules: [
      {
        dueDate: date('2026-04-25T00:00:00.000Z'),
        principalAmount: 1000000,
        interestAmount: 105000,
        feeAmount: 0,
        status: LiabilityRepaymentScheduleStatus.SCHEDULED,
        memo: '4월 정기 상환 예정'
      },
      {
        dueDate: date('2026-05-25T00:00:00.000Z'),
        principalAmount: 1000000,
        interestAmount: 101500,
        feeAmount: 0,
        status: LiabilityRepaymentScheduleStatus.SCHEDULED,
        memo: '5월 정기 상환 예정'
      }
    ]
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
    fixtureId: 'fuelLogFeb14',
    filledOn: date('2026-02-14T00:00:00.000Z'),
    odometerKm: 128120,
    liters: '48.200',
    amountWon: 77400,
    unitPriceWon: 1606,
    isFullTank: true
  },
  {
    fixtureId: 'fuelLogMar03',
    filledOn: date('2026-03-03T00:00:00.000Z'),
    odometerKm: 128240,
    liters: '52.300',
    amountWon: 84000,
    unitPriceWon: 1606,
    isFullTank: true
  },
  {
    fixtureId: 'fuelLogMar15',
    filledOn: date('2026-03-15T00:00:00.000Z'),
    odometerKm: 128695,
    liters: '49.600',
    amountWon: 80100,
    unitPriceWon: 1615,
    isFullTank: true
  },
  {
    fixtureId: 'fuelLogApr04',
    filledOn: date('2026-04-04T00:00:00.000Z'),
    odometerKm: 129040,
    liters: '44.500',
    amountWon: 73000,
    unitPriceWon: 1640,
    isFullTank: false
  },
  {
    fixtureId: 'fuelLogApr18',
    filledOn: date('2026-04-18T00:00:00.000Z'),
    odometerKm: 129360,
    liters: '53.100',
    amountWon: 87000,
    unitPriceWon: 1638,
    isFullTank: true
  },
  {
    fixtureId: 'fuelLogApr29',
    filledOn: date('2026-04-29T00:00:00.000Z'),
    odometerKm: 129790,
    liters: '42.700',
    amountWon: 71000,
    unitPriceWon: 1663,
    isFullTank: true
  }
] as const;

const DEMO_VEHICLE_MAINTENANCE_LOGS = [
  {
    fixtureId: 'maintenanceBrakePads',
    performedOn: date('2026-03-21T00:00:00.000Z'),
    odometerKm: 128720,
    category: VehicleMaintenanceCategory.REPAIR,
    vendor: '현대 블루핸즈',
    description: '브레이크 패드 교체',
    amountWon: 185000,
    memo: '전륜 패드 기준'
  },
  {
    fixtureId: 'maintenanceOilInspection',
    performedOn: date('2026-03-28T00:00:00.000Z'),
    odometerKm: 128940,
    category: VehicleMaintenanceCategory.INSPECTION,
    vendor: '현대 블루핸즈',
    description: '엔진오일 점검',
    amountWon: 42000,
    memo: null
  },
  {
    fixtureId: 'maintenanceEngineOil',
    performedOn: date('2026-04-17T00:00:00.000Z'),
    odometerKm: 129315,
    category: VehicleMaintenanceCategory.CONSUMABLE,
    vendor: '현대 블루핸즈',
    description: '엔진오일 및 필터 교체',
    amountWon: 128000,
    memo: '4월 정기 점검'
  },
  {
    fixtureId: 'maintenanceTireRotation',
    performedOn: date('2026-04-24T00:00:00.000Z'),
    odometerKm: 129580,
    category: VehicleMaintenanceCategory.INSPECTION,
    vendor: '현대 블루핸즈',
    description: '타이어 위치 교환 및 공기압 점검',
    amountWon: 65000,
    memo: '장거리 배송 전 점검'
  }
] as const;

type DemoJournalEntryLine = {
  accountSubjectCode: string;
  fundingAccountKey?: string;
  debitAmount?: number;
  creditAmount?: number;
  description?: string | null;
};

type DemoJournalEntryDefinition = {
  entryNumber: string;
  entryDate: Date;
  sourceKind: JournalEntrySourceKind;
  sourceCollectedTransactionRef?: string;
  sourcePlanItemRef?: string;
  memo: string | null;
  lines: DemoJournalEntryLine[];
};

type DemoPeriodDefinition = {
  fixtureId: string;
  year: number;
  month: number;
  status: AccountingPeriodStatus;
  openedAt: Date;
  lockedAt: Date | null;
  openingSourceKind: OpeningBalanceSourceKind;
  openingFundingBalances: Partial<Record<string, number>>;
  openingEquityAmount: number;
  closingFundingBalances?: Partial<Record<string, number>>;
  closingEquityAmount?: number;
  incomeWon?: number;
  expenseWon?: number;
  expenseBreakdown?: Array<{
    label: string;
    amountWon: number;
  }>;
  journalEntries: DemoJournalEntryDefinition[];
};

type DemoPlanItemDefinition = {
  fixtureId: string;
  periodKey: string;
  recurringRuleKey: string | null;
  transactionTypeCode: string;
  fundingAccountKey: string;
  categoryKey: string | null;
  title: string;
  plannedAmount: number;
  plannedDate: Date;
  status: PlanItemStatus;
};

type DemoImportBatchRowDefinition = {
  rowNumber: number;
  rawPayload: Prisma.InputJsonValue;
  parseStatus: ImportedRowParseStatus;
  parseError: string | null;
  sourceFingerprint: string | null;
};

type DemoImportBatchDefinition = {
  fixtureId: string;
  periodKey: string | null;
  sourceKind: ImportSourceKind;
  fileName: string;
  fileHash: string;
  fundingAccountKey: string | null;
  parseStatus: ImportBatchParseStatus;
  uploadedAt: Date;
  rows: DemoImportBatchRowDefinition[];
};

type DemoCollectedTransactionDefinition = {
  fixtureId: string;
  periodKey: string;
  importBatchKey: string | null;
  importedRowNumber: number | null;
  transactionTypeCode: string;
  fundingAccountKey: string;
  categoryKey: string | null;
  matchedPlanItemRef: string | null;
  title: string;
  occurredOn: Date;
  amount: number;
  status: CollectedTransactionStatus;
  memo: string | null;
  linkedFuelLogKey?: string;
  linkedMaintenanceLogKey?: string;
};

type DemoOperationalNoteDefinition = {
  fixtureId: string;
  periodKey: string | null;
  kind: OperationalNoteKind;
  title: string;
  body: string;
  relatedHref: string | null;
  createdAt: Date;
};

const DEMO_PERIODS: DemoPeriodDefinition[] = [
  {
    fixtureId: '2026-01',
    year: 2026,
    month: 1,
    status: AccountingPeriodStatus.LOCKED,
    openedAt: date('2026-01-01T00:00:00.000Z'),
    lockedAt: date('2026-01-31T15:00:00.000Z'),
    openingSourceKind: OpeningBalanceSourceKind.INITIAL_SETUP,
    openingFundingBalances: {
      mainAccount: 1300000,
      reserveAccount: 260000
    },
    openingEquityAmount: 1560000,
    closingFundingBalances: {
      mainAccount: 1860000,
      reserveAccount: 840000
    },
    closingEquityAmount: 2700000,
    incomeWon: 1820000,
    expenseWon: 680000,
    expenseBreakdown: [
      {
        label: '원재료비',
        amountWon: 420000
      },
      {
        label: '고정 운영비',
        amountWon: 260000
      }
    ],
    journalEntries: [
      buildIncomeEntry({
        entryNumber: 'JE-202601-001',
        entryDate: date('2026-01-06T00:00:00.000Z'),
        memo: '신규 거래처 정산 입금',
        fundingAccountKey: 'mainAccount',
        amount: 1240000
      }),
      buildIncomeEntry({
        entryNumber: 'JE-202601-002',
        entryDate: date('2026-01-16T00:00:00.000Z'),
        memo: '오프라인 납품 정산',
        fundingAccountKey: 'reserveAccount',
        amount: 580000
      }),
      buildExpenseEntry({
        entryNumber: 'JE-202601-003',
        entryDate: date('2026-01-18T00:00:00.000Z'),
        memo: '원재료 매입',
        fundingAccountKey: 'mainAccount',
        amount: 420000
      }),
      buildExpenseEntry({
        entryNumber: 'JE-202601-004',
        entryDate: date('2026-01-27T00:00:00.000Z'),
        memo: '고정 운영비 정산',
        fundingAccountKey: 'mainAccount',
        amount: 260000
      })
    ]
  },
  {
    fixtureId: '2026-02',
    year: 2026,
    month: 2,
    status: AccountingPeriodStatus.LOCKED,
    openedAt: date('2026-02-01T00:00:00.000Z'),
    lockedAt: date('2026-02-28T15:00:00.000Z'),
    openingSourceKind: OpeningBalanceSourceKind.CARRY_FORWARD,
    openingFundingBalances: {
      mainAccount: 1860000,
      reserveAccount: 840000
    },
    openingEquityAmount: 2700000,
    closingFundingBalances: {
      mainAccount: 2700000,
      reserveAccount: 1360000
    },
    closingEquityAmount: 4060000,
    incomeWon: 2150000,
    expenseWon: 790000,
    expenseBreakdown: [
      {
        label: '원재료비',
        amountWon: 520000
      },
      {
        label: '포장/운영비',
        amountWon: 270000
      }
    ],
    journalEntries: [
      buildIncomeEntry({
        entryNumber: 'JE-202602-001',
        entryDate: date('2026-02-04T00:00:00.000Z'),
        memo: '도매 매출 정산',
        fundingAccountKey: 'mainAccount',
        amount: 1360000
      }),
      buildIncomeEntry({
        entryNumber: 'JE-202602-002',
        entryDate: date('2026-02-18T00:00:00.000Z'),
        memo: '마켓플레이스 입금',
        fundingAccountKey: 'reserveAccount',
        amount: 790000
      }),
      buildExpenseEntry({
        entryNumber: 'JE-202602-003',
        entryDate: date('2026-02-21T00:00:00.000Z'),
        memo: '원재료 매입',
        fundingAccountKey: 'mainAccount',
        amount: 520000
      }),
      buildExpenseEntry({
        entryNumber: 'JE-202602-004',
        entryDate: date('2026-02-25T00:00:00.000Z'),
        memo: '포장재 및 운영비',
        fundingAccountKey: 'reserveAccount',
        amount: 270000
      })
    ]
  },
  {
    fixtureId: '2026-03',
    year: 2026,
    month: 3,
    status: AccountingPeriodStatus.LOCKED,
    openedAt: date('2026-03-01T00:00:00.000Z'),
    lockedAt: date('2026-03-31T15:00:00.000Z'),
    openingSourceKind: OpeningBalanceSourceKind.CARRY_FORWARD,
    openingFundingBalances: {
      mainAccount: 2700000,
      reserveAccount: 1360000
    },
    openingEquityAmount: 4060000,
    closingFundingBalances: {
      mainAccount: 3630000,
      reserveAccount: 2050000
    },
    closingEquityAmount: 5680000,
    incomeWon: 2480000,
    expenseWon: 860000,
    expenseBreakdown: [
      {
        label: '원재료비',
        amountWon: 610000
      },
      {
        label: '보험/물류비',
        amountWon: 250000
      }
    ],
    journalEntries: [
      buildIncomeEntry({
        entryNumber: 'JE-202603-001',
        entryDate: date('2026-03-03T00:00:00.000Z'),
        memo: '온라인 매출 정산',
        fundingAccountKey: 'mainAccount',
        amount: 1540000
      }),
      buildIncomeEntry({
        entryNumber: 'JE-202603-002',
        entryDate: date('2026-03-15T00:00:00.000Z'),
        memo: 'B2B 납품 정산',
        fundingAccountKey: 'reserveAccount',
        amount: 940000
      }),
      buildExpenseEntry({
        entryNumber: 'JE-202603-003',
        entryDate: date('2026-03-20T00:00:00.000Z'),
        memo: '원재료 매입',
        fundingAccountKey: 'mainAccount',
        amount: 610000
      }),
      buildExpenseEntry({
        entryNumber: 'JE-202603-004',
        entryDate: date('2026-03-29T00:00:00.000Z'),
        memo: '보험 및 물류 정산',
        fundingAccountKey: 'reserveAccount',
        amount: 250000
      })
    ]
  },
  {
    fixtureId: '2026-04',
    year: 2026,
    month: 4,
    status: AccountingPeriodStatus.OPEN,
    openedAt: date('2026-04-01T00:00:00.000Z'),
    lockedAt: null,
    openingSourceKind: OpeningBalanceSourceKind.CARRY_FORWARD,
    openingFundingBalances: {
      mainAccount: 3630000,
      reserveAccount: 2050000
    },
    openingEquityAmount: 5680000,
    journalEntries: [
      buildIncomeEntry({
        entryNumber: 'JE-202604-001',
        entryDate: date('2026-04-03T00:00:00.000Z'),
        memo: '온라인 주문 정산',
        fundingAccountKey: 'mainAccount',
        amount: 560000,
        sourceCollectedTransactionRef: 'txnSalesApr03'
      }),
      buildExpenseEntry({
        entryNumber: 'JE-202604-002',
        entryDate: date('2026-04-10T00:00:00.000Z'),
        memo: 'POS/인터넷 요금',
        fundingAccountKey: 'mainAccount',
        amount: 75000,
        sourceCollectedTransactionRef: 'txnUtilitiesApr10',
        sourcePlanItemRef: 'planUtilitiesApr10'
      }),
      buildIncomeEntry({
        entryNumber: 'JE-202604-003',
        entryDate: date('2026-04-12T00:00:00.000Z'),
        memo: '플랫폼 정산 입금',
        fundingAccountKey: 'mainAccount',
        amount: 330000,
        sourceCollectedTransactionRef: 'txnSalesApr12'
      }),
      buildExpenseEntry({
        entryNumber: 'JE-202604-004',
        entryDate: date('2026-04-17T00:00:00.000Z'),
        memo: '엔진오일 및 필터 교체',
        fundingAccountKey: 'reserveAccount',
        amount: 128000,
        sourceCollectedTransactionRef: 'txnMaintenanceApr17'
      }),
      buildExpenseEntry({
        entryNumber: 'JE-202604-005',
        entryDate: date('2026-04-15T00:00:00.000Z'),
        memo: '업무 도구 구독료',
        fundingAccountKey: 'mainAccount',
        amount: 39000,
        sourceCollectedTransactionRef: 'txnSubscriptionApr15',
        sourcePlanItemRef: 'planSoftwareApr15'
      }),
      buildIncomeEntry({
        entryNumber: 'JE-202604-006',
        entryDate: date('2026-04-24T00:00:00.000Z'),
        memo: 'B2B 납품 정산',
        fundingAccountKey: 'mainAccount',
        amount: 720000,
        sourceCollectedTransactionRef: 'txnB2BApr24'
      })
    ]
  }
];

const DEMO_PLAN_ITEMS: DemoPlanItemDefinition[] = [
  {
    fixtureId: 'planPackagingApr03',
    periodKey: '2026-04',
    recurringRuleKey: 'packagingRule',
    transactionTypeCode: DEMO_TRANSACTION_TYPE_CODES.expense,
    fundingAccountKey: 'mainAccount',
    categoryKey: 'packagingCategory',
    title: '정기 소모품 보충',
    plannedAmount: 280000,
    plannedDate: date('2026-04-03T00:00:00.000Z'),
    status: PlanItemStatus.MATCHED
  },
  {
    fixtureId: 'planRentApr05',
    periodKey: '2026-04',
    recurringRuleKey: 'rentRule',
    transactionTypeCode: DEMO_TRANSACTION_TYPE_CODES.expense,
    fundingAccountKey: 'mainAccount',
    categoryKey: 'rentCategory',
    title: '월세 자동 이체',
    plannedAmount: 620000,
    plannedDate: date('2026-04-05T00:00:00.000Z'),
    status: PlanItemStatus.MATCHED
  },
  {
    fixtureId: 'planUtilitiesApr10',
    periodKey: '2026-04',
    recurringRuleKey: 'utilitiesRule',
    transactionTypeCode: DEMO_TRANSACTION_TYPE_CODES.expense,
    fundingAccountKey: 'mainAccount',
    categoryKey: 'utilitiesCategory',
    title: 'POS/인터넷 요금',
    plannedAmount: 75000,
    plannedDate: date('2026-04-10T00:00:00.000Z'),
    status: PlanItemStatus.MATCHED
  },
  {
    fixtureId: 'planSoftwareApr15',
    periodKey: '2026-04',
    recurringRuleKey: 'softwareRule',
    transactionTypeCode: DEMO_TRANSACTION_TYPE_CODES.expense,
    fundingAccountKey: 'mainAccount',
    categoryKey: 'subscriptionCategory',
    title: '업무 도구 구독료',
    plannedAmount: 39000,
    plannedDate: date('2026-04-15T00:00:00.000Z'),
    status: PlanItemStatus.MATCHED
  },
  {
    fixtureId: 'planVehicleInsuranceApr25',
    periodKey: '2026-04',
    recurringRuleKey: 'vehicleInsuranceRule',
    transactionTypeCode: DEMO_TRANSACTION_TYPE_CODES.expense,
    fundingAccountKey: 'mainAccount',
    categoryKey: 'insuranceCategory',
    title: '업무용 차량 보험료',
    plannedAmount: 98000,
    plannedDate: date('2026-04-25T00:00:00.000Z'),
    status: PlanItemStatus.MATCHED
  },
  {
    fixtureId: 'planLiabilityInsuranceApr25',
    periodKey: '2026-04',
    recurringRuleKey: 'liabilityInsuranceRule',
    transactionTypeCode: DEMO_TRANSACTION_TYPE_CODES.expense,
    fundingAccountKey: 'mainAccount',
    categoryKey: 'insuranceCategory',
    title: '영업배상 책임보험료',
    plannedAmount: 43000,
    plannedDate: date('2026-04-25T00:00:00.000Z'),
    status: PlanItemStatus.MATCHED
  }
];

const DEMO_IMPORT_BATCHES: DemoImportBatchDefinition[] = [
  {
    fixtureId: 'mainBankApril',
    periodKey: '2026-04',
    sourceKind: ImportSourceKind.BANK_CSV,
    fileName: 'demo-bank-2026-04.csv',
    fileHash: 'demo-bank-2026-04-v3',
    fundingAccountKey: 'mainAccount',
    parseStatus: ImportBatchParseStatus.COMPLETED,
    uploadedAt: date('2026-04-30T01:00:00.000Z'),
    rows: [
      buildImportedRow({
        rowNumber: 1,
        sourceKind: ImportSourceKind.BANK_CSV,
        occurredOn: '2026-04-03',
        title: '온라인 주문 정산',
        amount: 560000,
        signedAmount: 560000,
        direction: 'DEPOSIT',
        directionLabel: '입금',
        collectTypeHint: 'INCOME',
        sourceOrigin: '사업 운영 통장'
      }),
      buildImportedRow({
        rowNumber: 2,
        sourceKind: ImportSourceKind.BANK_CSV,
        occurredOn: '2026-04-05',
        title: '정기 소모품 보충',
        amount: 280000,
        signedAmount: -280000,
        direction: 'WITHDRAWAL',
        directionLabel: '출금',
        collectTypeHint: 'EXPENSE',
        sourceOrigin: '사업 운영 통장'
      }),
      buildImportedRow({
        rowNumber: 3,
        sourceKind: ImportSourceKind.BANK_CSV,
        occurredOn: '2026-04-10',
        title: 'POS/인터넷 요금',
        amount: 75000,
        signedAmount: -75000,
        direction: 'WITHDRAWAL',
        directionLabel: '출금',
        collectTypeHint: 'EXPENSE',
        sourceOrigin: '사업 운영 통장'
      }),
      buildImportedRow({
        rowNumber: 4,
        sourceKind: ImportSourceKind.BANK_CSV,
        occurredOn: '2026-04-12',
        title: '플랫폼 정산 입금',
        amount: 330000,
        signedAmount: 330000,
        direction: 'DEPOSIT',
        directionLabel: '입금',
        collectTypeHint: 'INCOME',
        sourceOrigin: '사업 운영 통장'
      }),
      buildImportedRow({
        rowNumber: 5,
        sourceKind: ImportSourceKind.BANK_CSV,
        occurredOn: '2026-04-18',
        title: '남부에너지 주유',
        amount: 87000,
        signedAmount: -87000,
        direction: 'WITHDRAWAL',
        directionLabel: '출금',
        collectTypeHint: 'EXPENSE',
        sourceOrigin: '사업 운영 통장'
      }),
      buildImportedRow({
        rowNumber: 6,
        sourceKind: ImportSourceKind.BANK_CSV,
        occurredOn: '2026-04-22',
        title: '영업배상 책임보험료',
        amount: 43000,
        signedAmount: -43000,
        direction: 'WITHDRAWAL',
        directionLabel: '출금',
        collectTypeHint: 'EXPENSE',
        sourceOrigin: '사업 운영 통장'
      }),
      buildImportedRow({
        rowNumber: 7,
        sourceKind: ImportSourceKind.BANK_CSV,
        occurredOn: '2026-04-05',
        title: '월세 자동 이체',
        amount: 620000,
        signedAmount: -620000,
        direction: 'WITHDRAWAL',
        directionLabel: '출금',
        collectTypeHint: 'EXPENSE',
        sourceOrigin: '사업 운영 통장'
      }),
      buildImportedRow({
        rowNumber: 8,
        sourceKind: ImportSourceKind.BANK_CSV,
        occurredOn: '2026-04-15',
        title: '업무 도구 구독료',
        amount: 39000,
        signedAmount: -39000,
        direction: 'WITHDRAWAL',
        directionLabel: '출금',
        collectTypeHint: 'EXPENSE',
        sourceOrigin: '사업 운영 통장'
      }),
      buildImportedRow({
        rowNumber: 9,
        sourceKind: ImportSourceKind.BANK_CSV,
        occurredOn: '2026-04-24',
        title: 'B2B 납품 정산',
        amount: 720000,
        signedAmount: 720000,
        direction: 'DEPOSIT',
        directionLabel: '입금',
        collectTypeHint: 'INCOME',
        sourceOrigin: '사업 운영 통장'
      }),
      buildImportedRow({
        rowNumber: 10,
        sourceKind: ImportSourceKind.BANK_CSV,
        occurredOn: '2026-04-25',
        title: '업무용 차량 보험료',
        amount: 98000,
        signedAmount: -98000,
        direction: 'WITHDRAWAL',
        directionLabel: '출금',
        collectTypeHint: 'EXPENSE',
        sourceOrigin: '사업 운영 통장'
      }),
      buildImportedRow({
        rowNumber: 11,
        sourceKind: ImportSourceKind.BANK_CSV,
        occurredOn: '2026-04-29',
        title: '서부에너지 주유',
        amount: 71000,
        signedAmount: -71000,
        direction: 'WITHDRAWAL',
        directionLabel: '출금',
        collectTypeHint: 'EXPENSE',
        sourceOrigin: '사업 운영 통장'
      }),
      buildImportedRow({
        rowNumber: 12,
        sourceKind: ImportSourceKind.BANK_CSV,
        occurredOn: '2026-04-30',
        title: '정기 택배비 정산',
        amount: 125000,
        signedAmount: -125000,
        direction: 'WITHDRAWAL',
        directionLabel: '출금',
        collectTypeHint: 'EXPENSE',
        sourceOrigin: '사업 운영 통장'
      })
    ]
  },
  {
    fixtureId: 'cardApril',
    periodKey: '2026-04',
    sourceKind: ImportSourceKind.CARD_EXCEL,
    fileName: 'demo-card-2026-04.xlsx',
    fileHash: 'demo-card-2026-04-v2',
    fundingAccountKey: 'cardAccount',
    parseStatus: ImportBatchParseStatus.COMPLETED,
    uploadedAt: date('2026-04-30T05:00:00.000Z'),
    rows: [
      buildImportedRow({
        rowNumber: 1,
        sourceKind: ImportSourceKind.CARD_EXCEL,
        occurredOn: '2026-04-20',
        title: '택배 박스센터',
        amount: 54000,
        signedAmount: -54000,
        direction: 'WITHDRAWAL',
        directionLabel: '승인',
        collectTypeHint: 'EXPENSE',
        sourceOrigin: '사업용 카드'
      }),
      buildImportedRow({
        rowNumber: 2,
        sourceKind: ImportSourceKind.CARD_EXCEL,
        occurredOn: '2026-04-21',
        title: '온라인 광고 소재 구매',
        amount: 86000,
        signedAmount: -86000,
        direction: 'WITHDRAWAL',
        directionLabel: '승인',
        collectTypeHint: 'EXPENSE',
        sourceOrigin: '사업용 카드'
      }),
      buildImportedRow({
        rowNumber: 3,
        sourceKind: ImportSourceKind.CARD_EXCEL,
        occurredOn: '2026-04-24',
        title: '타이어 위치 교환',
        amount: 65000,
        signedAmount: -65000,
        direction: 'WITHDRAWAL',
        directionLabel: '승인',
        collectTypeHint: 'EXPENSE',
        sourceOrigin: '사업용 카드'
      }),
      buildImportedRow({
        rowNumber: 4,
        sourceKind: ImportSourceKind.CARD_EXCEL,
        occurredOn: '2026-04-27',
        title: '주차·통행료',
        amount: 18500,
        signedAmount: -18500,
        direction: 'WITHDRAWAL',
        directionLabel: '승인',
        collectTypeHint: 'EXPENSE',
        sourceOrigin: '사업용 카드'
      }),
      buildImportedRow({
        rowNumber: 5,
        sourceKind: ImportSourceKind.CARD_EXCEL,
        occurredOn: '2026-04-29',
        title: '사무용 문구 구입',
        amount: 32400,
        signedAmount: -32400,
        direction: 'WITHDRAWAL',
        directionLabel: '승인',
        collectTypeHint: 'EXPENSE',
        sourceOrigin: '사업용 카드'
      })
    ]
  }
];

const DEMO_COLLECTED_TRANSACTIONS: DemoCollectedTransactionDefinition[] = [
  {
    fixtureId: 'txnSalesApr03',
    periodKey: '2026-04',
    importBatchKey: 'mainBankApril',
    importedRowNumber: 1,
    transactionTypeCode: DEMO_TRANSACTION_TYPE_CODES.income,
    fundingAccountKey: 'mainAccount',
    categoryKey: 'salesCategory',
    matchedPlanItemRef: null,
    title: '온라인 주문 정산',
    occurredOn: date('2026-04-03T00:00:00.000Z'),
    amount: 560000,
    status: CollectedTransactionStatus.POSTED,
    memo: '4월 초 정산 입금'
  },
  {
    fixtureId: 'txnPackagingApr05',
    periodKey: '2026-04',
    importBatchKey: 'mainBankApril',
    importedRowNumber: 2,
    transactionTypeCode: DEMO_TRANSACTION_TYPE_CODES.expense,
    fundingAccountKey: 'mainAccount',
    categoryKey: 'packagingCategory',
    matchedPlanItemRef: 'planPackagingApr03',
    title: '정기 소모품 보충',
    occurredOn: date('2026-04-05T00:00:00.000Z'),
    amount: 280000,
    status: CollectedTransactionStatus.READY_TO_POST,
    memo: '자동 계획 항목과 매칭'
  },
  {
    fixtureId: 'txnRentApr05',
    periodKey: '2026-04',
    importBatchKey: 'mainBankApril',
    importedRowNumber: 7,
    transactionTypeCode: DEMO_TRANSACTION_TYPE_CODES.expense,
    fundingAccountKey: 'mainAccount',
    categoryKey: 'rentCategory',
    matchedPlanItemRef: 'planRentApr05',
    title: '월세 자동 이체',
    occurredOn: date('2026-04-05T00:00:00.000Z'),
    amount: 620000,
    status: CollectedTransactionStatus.READY_TO_POST,
    memo: '정기 임차료 계획 항목과 매칭'
  },
  {
    fixtureId: 'txnUtilitiesApr10',
    periodKey: '2026-04',
    importBatchKey: 'mainBankApril',
    importedRowNumber: 3,
    transactionTypeCode: DEMO_TRANSACTION_TYPE_CODES.expense,
    fundingAccountKey: 'mainAccount',
    categoryKey: 'utilitiesCategory',
    matchedPlanItemRef: 'planUtilitiesApr10',
    title: 'POS/인터넷 요금',
    occurredOn: date('2026-04-10T00:00:00.000Z'),
    amount: 75000,
    status: CollectedTransactionStatus.POSTED,
    memo: '자동 계획 항목 확정'
  },
  {
    fixtureId: 'txnSubscriptionApr15',
    periodKey: '2026-04',
    importBatchKey: 'mainBankApril',
    importedRowNumber: 8,
    transactionTypeCode: DEMO_TRANSACTION_TYPE_CODES.expense,
    fundingAccountKey: 'mainAccount',
    categoryKey: 'subscriptionCategory',
    matchedPlanItemRef: 'planSoftwareApr15',
    title: '업무 도구 구독료',
    occurredOn: date('2026-04-15T00:00:00.000Z'),
    amount: 39000,
    status: CollectedTransactionStatus.POSTED,
    memo: '월간 업무 도구 구독료 자동 매칭'
  },
  {
    fixtureId: 'txnSalesApr12',
    periodKey: '2026-04',
    importBatchKey: 'mainBankApril',
    importedRowNumber: 4,
    transactionTypeCode: DEMO_TRANSACTION_TYPE_CODES.income,
    fundingAccountKey: 'mainAccount',
    categoryKey: 'salesCategory',
    matchedPlanItemRef: null,
    title: '플랫폼 정산 입금',
    occurredOn: date('2026-04-12T00:00:00.000Z'),
    amount: 330000,
    status: CollectedTransactionStatus.POSTED,
    memo: '플랫폼 일괄 정산'
  },
  {
    fixtureId: 'txnMaintenanceApr17',
    periodKey: '2026-04',
    importBatchKey: null,
    importedRowNumber: null,
    transactionTypeCode: DEMO_TRANSACTION_TYPE_CODES.expense,
    fundingAccountKey: 'reserveAccount',
    categoryKey: 'maintenanceCategory',
    matchedPlanItemRef: null,
    title: '엔진오일 및 필터 교체',
    occurredOn: date('2026-04-17T00:00:00.000Z'),
    amount: 128000,
    status: CollectedTransactionStatus.POSTED,
    memo: '차량 정기 점검 연계',
    linkedMaintenanceLogKey: 'maintenanceEngineOil'
  },
  {
    fixtureId: 'txnMarketingApr21',
    periodKey: '2026-04',
    importBatchKey: 'cardApril',
    importedRowNumber: 2,
    transactionTypeCode: DEMO_TRANSACTION_TYPE_CODES.expense,
    fundingAccountKey: 'cardAccount',
    categoryKey: 'marketingCategory',
    matchedPlanItemRef: null,
    title: '온라인 광고 소재 구매',
    occurredOn: date('2026-04-21T00:00:00.000Z'),
    amount: 86000,
    status: CollectedTransactionStatus.REVIEWED,
    memo: '다음 캠페인 소재 준비 비용'
  },
  {
    fixtureId: 'txnFuelApr18',
    periodKey: '2026-04',
    importBatchKey: 'mainBankApril',
    importedRowNumber: 5,
    transactionTypeCode: DEMO_TRANSACTION_TYPE_CODES.expense,
    fundingAccountKey: 'mainAccount',
    categoryKey: 'fuelCategory',
    matchedPlanItemRef: null,
    title: '남부에너지 주유',
    occurredOn: date('2026-04-18T00:00:00.000Z'),
    amount: 87000,
    status: CollectedTransactionStatus.REVIEWED,
    memo: '차량 주유 로그 연계',
    linkedFuelLogKey: 'fuelLogApr18'
  },
  {
    fixtureId: 'txnLiabilityInsuranceApr22',
    periodKey: '2026-04',
    importBatchKey: 'mainBankApril',
    importedRowNumber: 6,
    transactionTypeCode: DEMO_TRANSACTION_TYPE_CODES.expense,
    fundingAccountKey: 'mainAccount',
    categoryKey: 'insuranceCategory',
    matchedPlanItemRef: 'planLiabilityInsuranceApr25',
    title: '영업배상 책임보험료',
    occurredOn: date('2026-04-22T00:00:00.000Z'),
    amount: 43000,
    status: CollectedTransactionStatus.READY_TO_POST,
    memo: '보험료 자동 계획 항목과 매칭'
  },
  {
    fixtureId: 'txnB2BApr24',
    periodKey: '2026-04',
    importBatchKey: 'mainBankApril',
    importedRowNumber: 9,
    transactionTypeCode: DEMO_TRANSACTION_TYPE_CODES.income,
    fundingAccountKey: 'mainAccount',
    categoryKey: 'salesCategory',
    matchedPlanItemRef: null,
    title: 'B2B 납품 정산',
    occurredOn: date('2026-04-24T00:00:00.000Z'),
    amount: 720000,
    status: CollectedTransactionStatus.POSTED,
    memo: '월말 납품 대금 정산'
  },
  {
    fixtureId: 'txnTireInspectionApr24',
    periodKey: '2026-04',
    importBatchKey: 'cardApril',
    importedRowNumber: 3,
    transactionTypeCode: DEMO_TRANSACTION_TYPE_CODES.expense,
    fundingAccountKey: 'cardAccount',
    categoryKey: 'maintenanceCategory',
    matchedPlanItemRef: null,
    title: '타이어 위치 교환',
    occurredOn: date('2026-04-24T00:00:00.000Z'),
    amount: 65000,
    status: CollectedTransactionStatus.READY_TO_POST,
    memo: '차량 점검 로그와 연결',
    linkedMaintenanceLogKey: 'maintenanceTireRotation'
  },
  {
    fixtureId: 'txnVehicleInsuranceApr25',
    periodKey: '2026-04',
    importBatchKey: 'mainBankApril',
    importedRowNumber: 10,
    transactionTypeCode: DEMO_TRANSACTION_TYPE_CODES.expense,
    fundingAccountKey: 'mainAccount',
    categoryKey: 'insuranceCategory',
    matchedPlanItemRef: 'planVehicleInsuranceApr25',
    title: '업무용 차량 보험료',
    occurredOn: date('2026-04-25T00:00:00.000Z'),
    amount: 98000,
    status: CollectedTransactionStatus.READY_TO_POST,
    memo: '차량 보험 자동 계획 항목과 매칭'
  },
  {
    fixtureId: 'txnFuelApr29',
    periodKey: '2026-04',
    importBatchKey: 'mainBankApril',
    importedRowNumber: 11,
    transactionTypeCode: DEMO_TRANSACTION_TYPE_CODES.expense,
    fundingAccountKey: 'mainAccount',
    categoryKey: 'fuelCategory',
    matchedPlanItemRef: null,
    title: '서부에너지 주유',
    occurredOn: date('2026-04-29T00:00:00.000Z'),
    amount: 71000,
    status: CollectedTransactionStatus.REVIEWED,
    memo: '4월 말 배송 전 주유 로그와 연결',
    linkedFuelLogKey: 'fuelLogApr29'
  }
];

const DEMO_OPERATIONAL_NOTES: DemoOperationalNoteDefinition[] = [
  {
    fixtureId: 'lockedMarchClosingNote',
    periodKey: '2026-03',
    kind: OperationalNoteKind.MONTH_END,
    title: '2026-03 마감 메모',
    body: '3월 마감 수치는 잠금 스냅샷과 차기 이월 기준으로 정리되어 있습니다. 4월 운영월은 해당 마감 기준을 이어받아 시작합니다.',
    relatedHref: '/workspace/monthly/financial-statements',
    createdAt: date('2026-03-31T15:10:00.000Z')
  },
  {
    fixtureId: 'aprilFollowUpNote',
    periodKey: '2026-04',
    kind: OperationalNoteKind.FOLLOW_UP,
    title: '4월 운영 체크',
    body: '월세, 보험료, 구독료가 계획 항목과 연결되어 있습니다. 준비 상태 거래를 검토한 뒤 전표 확정까지 이어가면 월 운영 흐름을 빠르게 확인할 수 있습니다.',
    relatedHref: '/workspace/monthly/plan-items',
    createdAt: date('2026-04-18T03:00:00.000Z')
  },
  {
    fixtureId: 'aprilVehicleAlert',
    periodKey: '2026-04',
    kind: OperationalNoteKind.ALERT,
    title: '차량 유지비 검토',
    body: '4월 주유와 정비 로그가 수집 거래와 연결되어 있습니다. 차량 비용 내역에서 로그와 거래가 함께 보이는지 확인하세요.',
    relatedHref: '/workspace/vehicles',
    createdAt: date('2026-04-22T06:00:00.000Z')
  }
];

export type SummaryItem = {
  created: number;
  skipped: number;
};

export type SeedSummary = {
  resetDemoUser: boolean;
  user: SummaryItem;
  settings: SummaryItem;
  accounts: SummaryItem;
  categories: SummaryItem;
  recurringRules: SummaryItem;
  insurancePolicies: SummaryItem;
  liabilityAgreements: SummaryItem;
  liabilityRepaymentSchedules: SummaryItem;
  vehicles: SummaryItem;
  fuelLogs: SummaryItem;
  maintenanceLogs: SummaryItem;
  periods: SummaryItem;
  openingBalanceSnapshots: SummaryItem;
  closingSnapshots: SummaryItem;
  carryForwardRecords: SummaryItem;
  financialStatementSnapshots: SummaryItem;
  planItems: SummaryItem;
  importBatches: SummaryItem;
  importedRows: SummaryItem;
  collectedTransactions: SummaryItem;
  journalEntries: SummaryItem;
  operationalNotes: SummaryItem;
};

type PeriodIdMap = Map<string, string>;
type SimpleIdMap = Map<string, string>;

type BatchSeedResult = Map<
  string,
  {
    id: string;
    rowIdsByRowNumber: Map<number, string>;
    rowSourceFingerprintByRowNumber: Map<number, string | null>;
  }
>;

type LedgerReferenceIds = {
  accountSubjectIdsByCode: Map<string, string>;
  transactionTypeIdsByCode: Map<string, string>;
};

function date(value: string) {
  return new Date(value);
}

function addMinutes(value: Date, minutes: number) {
  return new Date(value.getTime() + minutes * 60 * 1000);
}

function buildIncomeEntry(input: {
  entryNumber: string;
  entryDate: Date;
  memo: string;
  fundingAccountKey: string;
  amount: number;
  sourceCollectedTransactionRef?: string;
  sourcePlanItemRef?: string;
}): DemoJournalEntryDefinition {
  return {
    entryNumber: input.entryNumber,
    entryDate: input.entryDate,
    sourceKind: input.sourceCollectedTransactionRef
      ? JournalEntrySourceKind.COLLECTED_TRANSACTION
      : JournalEntrySourceKind.MANUAL_ADJUSTMENT,
    sourceCollectedTransactionRef: input.sourceCollectedTransactionRef,
    sourcePlanItemRef: input.sourcePlanItemRef,
    memo: input.memo,
    lines: [
      {
        accountSubjectCode: DEMO_ACCOUNT_SUBJECT_CODES.cash,
        fundingAccountKey: input.fundingAccountKey,
        debitAmount: input.amount,
        creditAmount: 0,
        description: input.memo
      },
      {
        accountSubjectCode: DEMO_ACCOUNT_SUBJECT_CODES.income,
        debitAmount: 0,
        creditAmount: input.amount,
        description: input.memo
      }
    ]
  };
}

function buildExpenseEntry(input: {
  entryNumber: string;
  entryDate: Date;
  memo: string;
  fundingAccountKey: string;
  amount: number;
  sourceCollectedTransactionRef?: string;
  sourcePlanItemRef?: string;
}): DemoJournalEntryDefinition {
  return {
    entryNumber: input.entryNumber,
    entryDate: input.entryDate,
    sourceKind: input.sourceCollectedTransactionRef
      ? JournalEntrySourceKind.COLLECTED_TRANSACTION
      : JournalEntrySourceKind.MANUAL_ADJUSTMENT,
    sourceCollectedTransactionRef: input.sourceCollectedTransactionRef,
    sourcePlanItemRef: input.sourcePlanItemRef,
    memo: input.memo,
    lines: [
      {
        accountSubjectCode: DEMO_ACCOUNT_SUBJECT_CODES.expense,
        debitAmount: input.amount,
        creditAmount: 0,
        description: input.memo
      },
      {
        accountSubjectCode: DEMO_ACCOUNT_SUBJECT_CODES.cash,
        fundingAccountKey: input.fundingAccountKey,
        debitAmount: 0,
        creditAmount: input.amount,
        description: input.memo
      }
    ]
  };
}

function buildImportedRow(input: {
  rowNumber: number;
  sourceKind: ImportSourceKind;
  occurredOn: string;
  title: string;
  amount: number;
  signedAmount: number;
  direction: 'WITHDRAWAL' | 'DEPOSIT' | 'REVERSAL';
  directionLabel: string;
  collectTypeHint: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  sourceOrigin: string;
}): DemoImportBatchRowDefinition {
  return {
    rowNumber: input.rowNumber,
    rawPayload: {
      original: {
        date: input.occurredOn,
        description: input.title,
        amount: String(input.amount),
        account_name: input.sourceOrigin
      },
      parsed: {
        occurredOn: input.occurredOn,
        title: input.title,
        amount: input.amount,
        signedAmount: input.signedAmount,
        direction: input.direction,
        directionLabel: input.directionLabel,
        collectTypeHint: input.collectTypeHint
      }
    },
    parseStatus: ImportedRowParseStatus.PARSED,
    parseError: null,
    sourceFingerprint: buildSourceFingerprint({
      sourceKind: input.sourceKind,
      occurredOn: input.occurredOn,
      amount: input.amount,
      description: input.title,
      sourceOrigin: input.sourceOrigin
    })
  };
}

function createSummaryItem(): SummaryItem {
  return {
    created: 0,
    skipped: 0
  };
}

function createSummary(): SeedSummary {
  return {
    resetDemoUser: false,
    user: createSummaryItem(),
    settings: createSummaryItem(),
    accounts: createSummaryItem(),
    categories: createSummaryItem(),
    recurringRules: createSummaryItem(),
    insurancePolicies: createSummaryItem(),
    liabilityAgreements: createSummaryItem(),
    liabilityRepaymentSchedules: createSummaryItem(),
    vehicles: createSummaryItem(),
    fuelLogs: createSummaryItem(),
    maintenanceLogs: createSummaryItem(),
    periods: createSummaryItem(),
    openingBalanceSnapshots: createSummaryItem(),
    closingSnapshots: createSummaryItem(),
    carryForwardRecords: createSummaryItem(),
    financialStatementSnapshots: createSummaryItem(),
    planItems: createSummaryItem(),
    importBatches: createSummaryItem(),
    importedRows: createSummaryItem(),
    collectedTransactions: createSummaryItem(),
    journalEntries: createSummaryItem(),
    operationalNotes: createSummaryItem()
  };
}

function trackSummary(summaryItem: SummaryItem, existed: boolean) {
  if (existed) {
    summaryItem.skipped += 1;
    return;
  }

  summaryItem.created += 1;
}

function printSummary(summary: SeedSummary) {
  const lines = [
    '[INFO] Demo seed summary',
    `  - demo user reset: ${summary.resetDemoUser ? 'yes' : 'no'}`,
    `  - users: created ${summary.user.created}, skipped ${summary.user.skipped}`,
    `  - settings: created ${summary.settings.created}, skipped ${summary.settings.skipped}`,
    `  - accounts: created ${summary.accounts.created}, skipped ${summary.accounts.skipped}`,
    `  - categories: created ${summary.categories.created}, skipped ${summary.categories.skipped}`,
    `  - recurring rules: created ${summary.recurringRules.created}, skipped ${summary.recurringRules.skipped}`,
    `  - insurance policies: created ${summary.insurancePolicies.created}, skipped ${summary.insurancePolicies.skipped}`,
    `  - liability agreements: created ${summary.liabilityAgreements.created}, skipped ${summary.liabilityAgreements.skipped}`,
    `  - liability repayment schedules: created ${summary.liabilityRepaymentSchedules.created}, skipped ${summary.liabilityRepaymentSchedules.skipped}`,
    `  - vehicles: created ${summary.vehicles.created}, skipped ${summary.vehicles.skipped}`,
    `  - fuel logs: created ${summary.fuelLogs.created}, skipped ${summary.fuelLogs.skipped}`,
    `  - maintenance logs: created ${summary.maintenanceLogs.created}, skipped ${summary.maintenanceLogs.skipped}`,
    `  - periods: created ${summary.periods.created}, skipped ${summary.periods.skipped}`,
    `  - opening snapshots: created ${summary.openingBalanceSnapshots.created}, skipped ${summary.openingBalanceSnapshots.skipped}`,
    `  - closing snapshots: created ${summary.closingSnapshots.created}, skipped ${summary.closingSnapshots.skipped}`,
    `  - carry forwards: created ${summary.carryForwardRecords.created}, skipped ${summary.carryForwardRecords.skipped}`,
    `  - financial statements: created ${summary.financialStatementSnapshots.created}, skipped ${summary.financialStatementSnapshots.skipped}`,
    `  - plan items: created ${summary.planItems.created}, skipped ${summary.planItems.skipped}`,
    `  - import batches: created ${summary.importBatches.created}, skipped ${summary.importBatches.skipped}`,
    `  - imported rows: created ${summary.importedRows.created}, skipped ${summary.importedRows.skipped}`,
    `  - collected transactions: created ${summary.collectedTransactions.created}, skipped ${summary.collectedTransactions.skipped}`,
    `  - journal entries: created ${summary.journalEntries.created}, skipped ${summary.journalEntries.skipped}`,
    `  - operational notes: created ${summary.operationalNotes.created}, skipped ${summary.operationalNotes.skipped}`
  ];

  console.log(lines.join('\n'));
}

async function ensureDemoUser(summary: SeedSummary) {
  const emailVerifiedAt = new Date();
  const existingUser = await prisma.user.findUnique({
    where: { email: env.DEMO_EMAIL },
    select: { id: true }
  });

  if (existingUser) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        name: DEMO_USER_NAME,
        passwordHash: await readDemoCredentialDigest(),
        emailVerifiedAt
      }
    });

    summary.user.skipped += 1;
    return existingUser.id;
  }

  const createdUser = await prisma.user.create({
    data: {
      email: env.DEMO_EMAIL,
      passwordHash: await readDemoCredentialDigest(),
      name: DEMO_USER_NAME,
      emailVerifiedAt
    },
    select: { id: true }
  });

  summary.user.created += 1;
  return createdUser.id;
}

async function readDemoCredentialDigest() {
  return demoCredentialDigestPromise;
}

async function ensureInitialAdminUser(summary: SeedSummary) {
  const admin = readInitialAdminSeedCredentials();

  if (!admin) {
    return null;
  }

  const passwordHash = await argon2.hash(admin.password);
  const emailVerifiedAt = new Date();
  const existingUser = await prisma.user.findUnique({
    where: { email: admin.email },
    select: { id: true }
  });

  if (existingUser) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        name: admin.name,
        passwordHash,
        isSystemAdmin: true,
        emailVerifiedAt
      }
    });

    summary.user.skipped += 1;
    return existingUser.id;
  }

  const createdUser = await prisma.user.create({
    data: {
      email: admin.email,
      passwordHash,
      name: admin.name,
      isSystemAdmin: true,
      emailVerifiedAt
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
    await prisma.userSetting.update({
      where: { userId },
      data: DEMO_SETTINGS
    });

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

  const accountIds = new Map<string, string>();

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
      await prisma.account.update({
        where: { id: existingAccount.id },
        data: {
          name: account.name,
          normalizedName: normalizeCaseInsensitiveText(account.name),
          type: account.type,
          balanceWon: account.balanceWon,
          sortOrder: account.sortOrder,
          status: FundingAccountStatus.ACTIVE,
          bootstrapStatus: FundingAccountBootstrapStatus.NOT_REQUIRED
        }
      });

      accountIds.set(account.fixtureId, existingAccount.id);
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
        sortOrder: account.sortOrder,
        status: FundingAccountStatus.ACTIVE,
        bootstrapStatus: FundingAccountBootstrapStatus.NOT_REQUIRED
      },
      select: { id: true }
    });

    accountIds.set(account.fixtureId, createdAccount.id);
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

  const categoryIds = new Map<string, string>();

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
      await prisma.category.update({
        where: { id: existingCategory.id },
        data: {
          name: category.name,
          normalizedName: normalizeCaseInsensitiveText(category.name),
          kind: category.kind,
          sortOrder: category.sortOrder,
          isActive: true
        }
      });

      categoryIds.set(category.fixtureId, existingCategory.id);
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
        sortOrder: category.sortOrder,
        isActive: true
      },
      select: { id: true }
    });

    categoryIds.set(category.fixtureId, createdCategory.id);
    summary.categories.created += 1;
  }

  return categoryIds;
}

async function ensureDemoRecurringRules(
  userId: string,
  tenantId: string,
  ledgerId: string,
  accountIds: SimpleIdMap,
  categoryIds: SimpleIdMap,
  summary: SeedSummary
) {
  const recurringRuleIds = new Map<string, string>();

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
        title: rule.title
      },
      select: { id: true }
    });

    if (existingRule) {
      await prisma.recurringRule.update({
        where: { id: existingRule.id },
        data: {
          accountId,
          categoryId,
          title: rule.title,
          amountWon: rule.amountWon,
          frequency: rule.frequency,
          dayOfMonth: rule.dayOfMonth,
          startDate: rule.startDate,
          nextRunDate: rule.nextRunDate,
          endDate: null,
          isActive: true
        }
      });

      recurringRuleIds.set(rule.fixtureId, existingRule.id);
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

    recurringRuleIds.set(rule.fixtureId, createdRule.id);
    summary.recurringRules.created += 1;
  }

  return recurringRuleIds;
}

async function ensureDemoInsurancePolicies(
  userId: string,
  tenantId: string,
  ledgerId: string,
  accountIds: SimpleIdMap,
  categoryIds: SimpleIdMap,
  recurringRuleIds: SimpleIdMap,
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
        provider: policy.provider,
        productName: policy.productName
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

async function ensureDemoLiabilityAgreements(
  userId: string,
  tenantId: string,
  ledgerId: string,
  accountIds: SimpleIdMap,
  categoryIds: SimpleIdMap,
  summary: SeedSummary
) {
  const liabilityAccountSubject = await prisma.accountSubject.findFirst({
    where: {
      tenantId,
      ledgerId,
      code: DEMO_ACCOUNT_SUBJECT_CODES.liability,
      isActive: true
    },
    select: {
      id: true
    }
  });

  if (!liabilityAccountSubject) {
    throw new Error(
      'Missing liability account subject for demo liability seed'
    );
  }

  for (const agreement of DEMO_LIABILITY_AGREEMENTS) {
    const defaultFundingAccountId = requireMapValue(
      accountIds,
      agreement.defaultFundingAccountKey,
      'liability funding account'
    );
    const interestExpenseCategoryId = requireMapValue(
      categoryIds,
      agreement.interestExpenseCategoryKey,
      'liability interest category'
    );
    const feeExpenseCategoryId = agreement.feeExpenseCategoryKey
      ? requireMapValue(
          categoryIds,
          agreement.feeExpenseCategoryKey,
          'liability fee category'
        )
      : null;
    const existingAgreement = await prisma.liabilityAgreement.findFirst({
      where: {
        tenantId,
        ledgerId,
        normalizedLenderName: normalizeCaseInsensitiveText(
          agreement.lenderName
        ),
        normalizedProductName: normalizeCaseInsensitiveText(
          agreement.productName
        )
      },
      select: {
        id: true
      }
    });
    const savedAgreement = existingAgreement
      ? await prisma.liabilityAgreement.update({
          where: {
            id: existingAgreement.id
          },
          data: {
            defaultFundingAccountId,
            liabilityAccountSubjectId: liabilityAccountSubject.id,
            interestExpenseCategoryId,
            feeExpenseCategoryId,
            lenderName: agreement.lenderName,
            normalizedLenderName: normalizeCaseInsensitiveText(
              agreement.lenderName
            ),
            productName: agreement.productName,
            normalizedProductName: normalizeCaseInsensitiveText(
              agreement.productName
            ),
            loanNumberLast4: agreement.loanNumberLast4,
            principalAmount: agreement.principalAmount,
            borrowedAt: agreement.borrowedAt,
            maturityDate: agreement.maturityDate,
            interestRate: agreement.interestRate,
            interestRateType: agreement.interestRateType,
            repaymentMethod: agreement.repaymentMethod,
            paymentDay: agreement.paymentDay,
            status: agreement.status,
            memo: agreement.memo
          },
          select: {
            id: true
          }
        })
      : await prisma.liabilityAgreement.create({
          data: {
            userId,
            tenantId,
            ledgerId,
            defaultFundingAccountId,
            liabilityAccountSubjectId: liabilityAccountSubject.id,
            interestExpenseCategoryId,
            feeExpenseCategoryId,
            lenderName: agreement.lenderName,
            normalizedLenderName: normalizeCaseInsensitiveText(
              agreement.lenderName
            ),
            productName: agreement.productName,
            normalizedProductName: normalizeCaseInsensitiveText(
              agreement.productName
            ),
            loanNumberLast4: agreement.loanNumberLast4,
            principalAmount: agreement.principalAmount,
            borrowedAt: agreement.borrowedAt,
            maturityDate: agreement.maturityDate,
            interestRate: agreement.interestRate,
            interestRateType: agreement.interestRateType,
            repaymentMethod: agreement.repaymentMethod,
            paymentDay: agreement.paymentDay,
            status: agreement.status,
            memo: agreement.memo
          },
          select: {
            id: true
          }
        });

    trackSummary(summary.liabilityAgreements, Boolean(existingAgreement));

    for (const schedule of agreement.schedules) {
      const existingSchedule =
        await prisma.liabilityRepaymentSchedule.findFirst({
          where: {
            liabilityAgreementId: savedAgreement.id,
            dueDate: schedule.dueDate
          },
          select: {
            id: true
          }
        });
      const scheduleData = {
        tenantId,
        ledgerId,
        liabilityAgreementId: savedAgreement.id,
        dueDate: schedule.dueDate,
        principalAmount: schedule.principalAmount,
        interestAmount: schedule.interestAmount,
        feeAmount: schedule.feeAmount,
        totalAmount:
          schedule.principalAmount +
          schedule.interestAmount +
          schedule.feeAmount,
        status: schedule.status,
        memo: schedule.memo
      };

      if (existingSchedule) {
        await prisma.liabilityRepaymentSchedule.update({
          where: {
            id: existingSchedule.id
          },
          data: scheduleData
        });
      } else {
        await prisma.liabilityRepaymentSchedule.create({
          data: scheduleData
        });
      }

      trackSummary(
        summary.liabilityRepaymentSchedules,
        Boolean(existingSchedule)
      );
    }
  }
}

async function ensureDemoVehicle(
  userId: string,
  tenantId: string,
  ledgerId: string,
  accountIds: SimpleIdMap,
  categoryIds: SimpleIdMap,
  summary: SeedSummary
) {
  const defaultFundingAccountId = accountIds.get('mainAccount') ?? null;
  const defaultFuelCategoryId = categoryIds.get('fuelCategory') ?? null;
  const defaultMaintenanceCategoryId =
    categoryIds.get('maintenanceCategory') ?? null;

  const existingVehicle = await prisma.vehicle.findFirst({
    where: {
      tenantId,
      ledgerId,
      name: DEMO_VEHICLE.name
    },
    select: { id: true }
  });

  if (existingVehicle) {
    await prisma.vehicle.update({
      where: { id: existingVehicle.id },
      data: {
        normalizedName: normalizeCaseInsensitiveText(DEMO_VEHICLE.name),
        manufacturer: DEMO_VEHICLE.manufacturer,
        fuelType: DEMO_VEHICLE.fuelType,
        initialOdometerKm: DEMO_VEHICLE.initialOdometerKm,
        estimatedFuelEfficiencyKmPerLiter:
          DEMO_VEHICLE.estimatedFuelEfficiencyKmPerLiter,
        defaultFundingAccountId,
        defaultFuelCategoryId,
        defaultMaintenanceCategoryId,
        operatingExpensePlanOptIn: true
      }
    });

    summary.vehicles.skipped += 1;
    return existingVehicle.id;
  }

  const createdVehicle = await prisma.vehicle.create({
    data: {
      userId,
      tenantId,
      ledgerId,
      normalizedName: normalizeCaseInsensitiveText(DEMO_VEHICLE.name),
      manufacturer: DEMO_VEHICLE.manufacturer,
      fuelType: DEMO_VEHICLE.fuelType,
      initialOdometerKm: DEMO_VEHICLE.initialOdometerKm,
      estimatedFuelEfficiencyKmPerLiter:
        DEMO_VEHICLE.estimatedFuelEfficiencyKmPerLiter,
      name: DEMO_VEHICLE.name,
      defaultFundingAccountId,
      defaultFuelCategoryId,
      defaultMaintenanceCategoryId,
      operatingExpensePlanOptIn: true
    },
    select: { id: true }
  });

  summary.vehicles.created += 1;
  return createdVehicle.id;
}

async function ensureDemoFuelLogs(vehicleId: string, summary: SeedSummary) {
  const fuelLogIds = new Map<string, string>();

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
      await prisma.fuelLog.update({
        where: { id: existingFuelLog.id },
        data: {
          liters: fuelLog.liters,
          amountWon: fuelLog.amountWon,
          unitPriceWon: fuelLog.unitPriceWon,
          isFullTank: fuelLog.isFullTank
        }
      });

      fuelLogIds.set(fuelLog.fixtureId, existingFuelLog.id);
      summary.fuelLogs.skipped += 1;
      continue;
    }

    const createdFuelLog = await prisma.fuelLog.create({
      data: {
        vehicleId,
        filledOn: fuelLog.filledOn,
        odometerKm: fuelLog.odometerKm,
        liters: fuelLog.liters,
        amountWon: fuelLog.amountWon,
        unitPriceWon: fuelLog.unitPriceWon,
        isFullTank: fuelLog.isFullTank
      },
      select: { id: true }
    });

    fuelLogIds.set(fuelLog.fixtureId, createdFuelLog.id);
    summary.fuelLogs.created += 1;
  }

  return fuelLogIds;
}

async function ensureDemoVehicleMaintenanceLogs(
  vehicleId: string,
  summary: SeedSummary
) {
  const maintenanceLogIds = new Map<string, string>();

  for (const maintenanceLog of DEMO_VEHICLE_MAINTENANCE_LOGS) {
    const existingMaintenanceLog = await prisma.vehicleMaintenanceLog.findFirst(
      {
        where: {
          vehicleId,
          performedOn: maintenanceLog.performedOn,
          odometerKm: maintenanceLog.odometerKm,
          description: maintenanceLog.description
        },
        select: { id: true }
      }
    );

    if (existingMaintenanceLog) {
      await prisma.vehicleMaintenanceLog.update({
        where: { id: existingMaintenanceLog.id },
        data: {
          category: maintenanceLog.category,
          vendor: maintenanceLog.vendor,
          amountWon: maintenanceLog.amountWon,
          memo: maintenanceLog.memo
        }
      });

      maintenanceLogIds.set(
        maintenanceLog.fixtureId,
        existingMaintenanceLog.id
      );
      summary.maintenanceLogs.skipped += 1;
      continue;
    }

    const createdMaintenanceLog = await prisma.vehicleMaintenanceLog.create({
      data: {
        vehicleId,
        performedOn: maintenanceLog.performedOn,
        odometerKm: maintenanceLog.odometerKm,
        category: maintenanceLog.category,
        vendor: maintenanceLog.vendor,
        description: maintenanceLog.description,
        amountWon: maintenanceLog.amountWon,
        memo: maintenanceLog.memo
      },
      select: { id: true }
    });

    maintenanceLogIds.set(maintenanceLog.fixtureId, createdMaintenanceLog.id);
    summary.maintenanceLogs.created += 1;
  }

  return maintenanceLogIds;
}

async function ensureDemoLedgerMetadata(ledgerId: string) {
  await prisma.ledger.update({
    where: { id: ledgerId },
    data: {
      openedFromYearMonth: DEMO_OPENED_FROM_YEAR_MONTH,
      closedThroughYearMonth: DEMO_CLOSED_THROUGH_YEAR_MONTH
    }
  });
}

async function loadLedgerReferenceIds(
  tenantId: string,
  ledgerId: string
): Promise<LedgerReferenceIds> {
  const [accountSubjects, transactionTypes] = await Promise.all([
    prisma.accountSubject.findMany({
      where: {
        tenantId,
        ledgerId
      },
      select: {
        id: true,
        code: true
      }
    }),
    prisma.ledgerTransactionType.findMany({
      where: {
        tenantId,
        ledgerId
      },
      select: {
        id: true,
        code: true
      }
    })
  ]);

  const accountSubjectIdsByCode = new Map(
    accountSubjects.map((subject) => [subject.code, subject.id])
  );
  const transactionTypeIdsByCode = new Map(
    transactionTypes.map((type) => [type.code, type.id])
  );

  for (const code of Object.values(DEMO_ACCOUNT_SUBJECT_CODES)) {
    if (!accountSubjectIdsByCode.has(code)) {
      throw new Error(`Missing seeded account subject: ${code}`);
    }
  }

  for (const code of Object.values(DEMO_TRANSACTION_TYPE_CODES)) {
    if (!transactionTypeIdsByCode.has(code)) {
      throw new Error(`Missing seeded ledger transaction type: ${code}`);
    }
  }

  return {
    accountSubjectIdsByCode,
    transactionTypeIdsByCode
  };
}

async function ensureDemoPeriods(
  tenantId: string,
  ledgerId: string,
  membershipId: string,
  summary: SeedSummary
) {
  const periodIds = new Map<string, string>();

  for (const period of DEMO_PERIODS) {
    const { startDate, endDate } = buildPeriodRange(period.year, period.month);
    const existingPeriod = await prisma.accountingPeriod.findUnique({
      where: {
        ledgerId_year_month: {
          ledgerId,
          year: period.year,
          month: period.month
        }
      },
      select: { id: true }
    });

    const storedPeriod = await prisma.accountingPeriod.upsert({
      where: {
        ledgerId_year_month: {
          ledgerId,
          year: period.year,
          month: period.month
        }
      },
      update: {
        startDate,
        endDate,
        status: period.status,
        openedAt: period.openedAt,
        lockedAt: period.lockedAt,
        nextJournalEntrySequence: 1
      },
      create: {
        tenantId,
        ledgerId,
        year: period.year,
        month: period.month,
        startDate,
        endDate,
        status: period.status,
        openedAt: period.openedAt,
        lockedAt: period.lockedAt,
        nextJournalEntrySequence: 1
      },
      select: { id: true }
    });

    trackSummary(summary.periods, Boolean(existingPeriod));
    periodIds.set(period.fixtureId, storedPeriod.id);

    await ensurePeriodStatusHistory({
      tenantId,
      ledgerId,
      periodId: storedPeriod.id,
      membershipId,
      period
    });
  }

  return periodIds;
}

async function ensurePeriodStatusHistory(input: {
  tenantId: string;
  ledgerId: string;
  periodId: string;
  membershipId: string;
  period: DemoPeriodDefinition;
}) {
  const desiredEvents = [
    {
      fromStatus: null,
      toStatus: AccountingPeriodStatus.OPEN,
      eventType: AccountingPeriodEventType.OPEN,
      reason: `${input.period.fixtureId} 데모 운영월 개시`,
      changedAt: input.period.openedAt
    },
    ...(input.period.status === AccountingPeriodStatus.LOCKED &&
    input.period.lockedAt
      ? [
          {
            fromStatus: AccountingPeriodStatus.OPEN,
            toStatus: AccountingPeriodStatus.LOCKED,
            eventType: AccountingPeriodEventType.LOCK,
            reason: `${input.period.fixtureId} 데모 월 마감 완료`,
            changedAt: input.period.lockedAt
          }
        ]
      : [])
  ];

  const existingHistory = await prisma.periodStatusHistory.findMany({
    where: {
      periodId: input.periodId
    },
    select: {
      eventType: true,
      toStatus: true,
      changedAt: true
    }
  });

  for (const event of desiredEvents) {
    const alreadyExists = existingHistory.some(
      (item) =>
        item.eventType === event.eventType &&
        item.toStatus === event.toStatus &&
        item.changedAt.getTime() === event.changedAt.getTime()
    );

    if (alreadyExists) {
      continue;
    }

    await prisma.periodStatusHistory.create({
      data: {
        tenantId: input.tenantId,
        ledgerId: input.ledgerId,
        periodId: input.periodId,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        eventType: event.eventType,
        reason: event.reason,
        actorType: DEMO_ACTOR_TYPE,
        actorMembershipId: input.membershipId,
        changedAt: event.changedAt
      }
    });
  }
}

async function ensureDemoPlanItems(
  tenantId: string,
  ledgerId: string,
  periodIds: PeriodIdMap,
  recurringRuleIds: SimpleIdMap,
  transactionTypeIdsByCode: Map<string, string>,
  accountIds: SimpleIdMap,
  categoryIds: SimpleIdMap,
  summary: SeedSummary
) {
  const planItemIds = new Map<string, string>();

  for (const item of DEMO_PLAN_ITEMS) {
    const periodId = requireMapValue(
      periodIds,
      item.periodKey,
      'plan item period'
    );
    const ledgerTransactionTypeId = requireMapValue(
      transactionTypeIdsByCode,
      item.transactionTypeCode,
      'plan item transaction type'
    );
    const fundingAccountId = requireMapValue(
      accountIds,
      item.fundingAccountKey,
      'plan item funding account'
    );
    const recurringRuleId = item.recurringRuleKey
      ? requireMapValue(
          recurringRuleIds,
          item.recurringRuleKey,
          'plan item recurring rule'
        )
      : null;
    const categoryId = item.categoryKey
      ? requireMapValue(categoryIds, item.categoryKey, 'plan item category')
      : null;

    const existingPlanItem = await prisma.planItem.findFirst({
      where: {
        tenantId,
        ledgerId,
        periodId,
        title: item.title,
        plannedDate: item.plannedDate
      },
      select: { id: true }
    });

    if (existingPlanItem) {
      await prisma.planItem.update({
        where: { id: existingPlanItem.id },
        data: {
          recurringRuleId,
          ledgerTransactionTypeId,
          fundingAccountId,
          categoryId,
          title: item.title,
          plannedAmount: item.plannedAmount,
          plannedDate: item.plannedDate,
          status: item.status
        }
      });

      planItemIds.set(item.fixtureId, existingPlanItem.id);
      summary.planItems.skipped += 1;
      continue;
    }

    const createdPlanItem = await prisma.planItem.create({
      data: {
        tenantId,
        ledgerId,
        periodId,
        recurringRuleId,
        ledgerTransactionTypeId,
        fundingAccountId,
        categoryId,
        title: item.title,
        plannedAmount: item.plannedAmount,
        plannedDate: item.plannedDate,
        status: item.status
      },
      select: { id: true }
    });

    planItemIds.set(item.fixtureId, createdPlanItem.id);
    summary.planItems.created += 1;
  }

  return planItemIds;
}

async function ensureDemoImportBatches(
  tenantId: string,
  ledgerId: string,
  membershipId: string,
  periodIds: PeriodIdMap,
  accountIds: SimpleIdMap,
  summary: SeedSummary
) {
  const batchResult: BatchSeedResult = new Map();

  for (const batch of DEMO_IMPORT_BATCHES) {
    const periodId =
      batch.periodKey == null
        ? null
        : requireMapValue(periodIds, batch.periodKey, 'import batch period');
    const fundingAccountId =
      batch.fundingAccountKey == null
        ? null
        : requireMapValue(
            accountIds,
            batch.fundingAccountKey,
            'import batch funding account'
          );

    const existingBatch = await prisma.importBatch.findFirst({
      where: {
        tenantId,
        ledgerId,
        fileHash: batch.fileHash
      },
      select: { id: true }
    });

    const storedBatch = existingBatch
      ? await prisma.importBatch.update({
          where: { id: existingBatch.id },
          data: {
            periodId,
            sourceKind: batch.sourceKind,
            fileName: batch.fileName,
            fileHash: batch.fileHash,
            fundingAccountId,
            rowCount: batch.rows.length,
            parseStatus: batch.parseStatus,
            uploadedByMembershipId: membershipId,
            uploadedAt: batch.uploadedAt
          },
          select: { id: true }
        })
      : await prisma.importBatch.create({
          data: {
            tenantId,
            ledgerId,
            periodId,
            sourceKind: batch.sourceKind,
            fileName: batch.fileName,
            fileHash: batch.fileHash,
            fundingAccountId,
            rowCount: batch.rows.length,
            parseStatus: batch.parseStatus,
            uploadedByMembershipId: membershipId,
            uploadedAt: batch.uploadedAt
          },
          select: { id: true }
        });

    trackSummary(summary.importBatches, Boolean(existingBatch));

    const rowIdsByRowNumber = new Map<number, string>();
    const rowSourceFingerprintByRowNumber = new Map<number, string | null>();

    for (const row of batch.rows) {
      const existingRow = await prisma.importedRow.findUnique({
        where: {
          batchId_rowNumber: {
            batchId: storedBatch.id,
            rowNumber: row.rowNumber
          }
        },
        select: { id: true }
      });

      const storedRow = await prisma.importedRow.upsert({
        where: {
          batchId_rowNumber: {
            batchId: storedBatch.id,
            rowNumber: row.rowNumber
          }
        },
        update: {
          rawPayload: row.rawPayload,
          parseStatus: row.parseStatus,
          parseError: row.parseError,
          sourceFingerprint: row.sourceFingerprint
        },
        create: {
          batchId: storedBatch.id,
          rowNumber: row.rowNumber,
          rawPayload: row.rawPayload,
          parseStatus: row.parseStatus,
          parseError: row.parseError,
          sourceFingerprint: row.sourceFingerprint
        },
        select: { id: true }
      });

      trackSummary(summary.importedRows, Boolean(existingRow));
      rowIdsByRowNumber.set(row.rowNumber, storedRow.id);
      rowSourceFingerprintByRowNumber.set(
        row.rowNumber,
        row.sourceFingerprint ?? null
      );
    }

    batchResult.set(batch.fixtureId, {
      id: storedBatch.id,
      rowIdsByRowNumber,
      rowSourceFingerprintByRowNumber
    });
  }

  return batchResult;
}

async function ensureDemoCollectedTransactions(
  tenantId: string,
  ledgerId: string,
  periodIds: PeriodIdMap,
  importBatches: BatchSeedResult,
  transactionTypeIdsByCode: Map<string, string>,
  accountIds: SimpleIdMap,
  categoryIds: SimpleIdMap,
  planItemIds: SimpleIdMap,
  summary: SeedSummary
) {
  const collectedTransactionIds = new Map<string, string>();

  for (const transaction of DEMO_COLLECTED_TRANSACTIONS) {
    const periodId = requireMapValue(
      periodIds,
      transaction.periodKey,
      'collected transaction period'
    );
    const importBatch = transaction.importBatchKey
      ? requireMapValue(
          importBatches,
          transaction.importBatchKey,
          'collected transaction import batch'
        )
      : null;
    const importedRowId =
      importBatch && transaction.importedRowNumber != null
        ? requireMapValue(
            importBatch.rowIdsByRowNumber,
            transaction.importedRowNumber,
            'collected transaction imported row'
          )
        : null;
    const sourceFingerprint =
      importBatch && transaction.importedRowNumber != null
        ? (importBatch.rowSourceFingerprintByRowNumber.get(
            transaction.importedRowNumber
          ) ?? null)
        : null;
    const ledgerTransactionTypeId = requireMapValue(
      transactionTypeIdsByCode,
      transaction.transactionTypeCode,
      'collected transaction type'
    );
    const fundingAccountId = requireMapValue(
      accountIds,
      transaction.fundingAccountKey,
      'collected transaction funding account'
    );
    const categoryId = transaction.categoryKey
      ? requireMapValue(
          categoryIds,
          transaction.categoryKey,
          'collected transaction category'
        )
      : null;
    const matchedPlanItemId = transaction.matchedPlanItemRef
      ? requireMapValue(
          planItemIds,
          transaction.matchedPlanItemRef,
          'collected transaction matched plan item'
        )
      : null;

    const existingCollectedTransaction =
      importedRowId != null
        ? await prisma.collectedTransaction.findUnique({
            where: { importedRowId },
            select: { id: true }
          })
        : await prisma.collectedTransaction.findFirst({
            where: {
              tenantId,
              ledgerId,
              title: transaction.title,
              occurredOn: transaction.occurredOn,
              amount: transaction.amount,
              fundingAccountId
            },
            select: { id: true }
          });

    if (existingCollectedTransaction) {
      await prisma.collectedTransaction.update({
        where: { id: existingCollectedTransaction.id },
        data: {
          periodId,
          importBatchId: importBatch?.id ?? null,
          importedRowId,
          ledgerTransactionTypeId,
          fundingAccountId,
          categoryId,
          matchedPlanItemId,
          title: transaction.title,
          occurredOn: transaction.occurredOn,
          amount: transaction.amount,
          status: transaction.status,
          sourceFingerprint,
          memo: transaction.memo
        }
      });

      collectedTransactionIds.set(
        transaction.fixtureId,
        existingCollectedTransaction.id
      );
      summary.collectedTransactions.skipped += 1;
      continue;
    }

    const createdCollectedTransaction =
      await prisma.collectedTransaction.create({
        data: {
          tenantId,
          ledgerId,
          periodId,
          importBatchId: importBatch?.id ?? null,
          importedRowId,
          ledgerTransactionTypeId,
          fundingAccountId,
          categoryId,
          matchedPlanItemId,
          title: transaction.title,
          occurredOn: transaction.occurredOn,
          amount: transaction.amount,
          status: transaction.status,
          sourceFingerprint,
          memo: transaction.memo
        },
        select: { id: true }
      });

    collectedTransactionIds.set(
      transaction.fixtureId,
      createdCollectedTransaction.id
    );
    summary.collectedTransactions.created += 1;
  }

  return collectedTransactionIds;
}

async function ensureDemoJournalEntries(
  tenantId: string,
  ledgerId: string,
  membershipId: string,
  periodIds: PeriodIdMap,
  accountIds: SimpleIdMap,
  accountSubjectIdsByCode: Map<string, string>,
  collectedTransactionIds: SimpleIdMap,
  planItemIds: SimpleIdMap,
  summary: SeedSummary
) {
  for (const period of DEMO_PERIODS) {
    const periodId = requireMapValue(
      periodIds,
      period.fixtureId,
      'journal entry period'
    );

    for (const journalEntry of period.journalEntries) {
      const existingJournalEntry = await prisma.journalEntry.findUnique({
        where: {
          ledgerId_entryNumber: {
            ledgerId,
            entryNumber: journalEntry.entryNumber
          }
        },
        select: { id: true }
      });

      const sourceCollectedTransactionId =
        journalEntry.sourceCollectedTransactionRef
          ? requireMapValue(
              collectedTransactionIds,
              journalEntry.sourceCollectedTransactionRef,
              'journal entry source collected transaction'
            )
          : null;
      const sourcePlanItemId = journalEntry.sourcePlanItemRef
        ? requireMapValue(
            planItemIds,
            journalEntry.sourcePlanItemRef,
            'journal entry source plan item'
          )
        : null;

      const storedJournalEntry = await prisma.journalEntry.upsert({
        where: {
          ledgerId_entryNumber: {
            ledgerId,
            entryNumber: journalEntry.entryNumber
          }
        },
        update: {
          periodId,
          entryDate: journalEntry.entryDate,
          sourceKind: journalEntry.sourceKind,
          sourceCollectedTransactionId,
          sourcePlanItemId,
          status: JournalEntryStatus.POSTED,
          memo: journalEntry.memo,
          createdByActorType: DEMO_ACTOR_TYPE,
          createdByMembershipId: membershipId,
          reversesJournalEntryId: null,
          correctsJournalEntryId: null,
          correctionReason: null
        },
        create: {
          tenantId,
          ledgerId,
          periodId,
          entryNumber: journalEntry.entryNumber,
          entryDate: journalEntry.entryDate,
          sourceKind: journalEntry.sourceKind,
          sourceCollectedTransactionId,
          sourcePlanItemId,
          status: JournalEntryStatus.POSTED,
          memo: journalEntry.memo,
          createdByActorType: DEMO_ACTOR_TYPE,
          createdByMembershipId: membershipId
        },
        select: { id: true }
      });

      await prisma.journalLine.deleteMany({
        where: {
          journalEntryId: storedJournalEntry.id
        }
      });

      await prisma.journalLine.createMany({
        data: journalEntry.lines.map((line, index) => ({
          journalEntryId: storedJournalEntry.id,
          lineNumber: index + 1,
          accountSubjectId: requireMapValue(
            accountSubjectIdsByCode,
            line.accountSubjectCode,
            'journal entry line account subject'
          ),
          fundingAccountId: line.fundingAccountKey
            ? requireMapValue(
                accountIds,
                line.fundingAccountKey,
                'journal entry line funding account'
              )
            : null,
          debitAmount: line.debitAmount ?? 0,
          creditAmount: line.creditAmount ?? 0,
          description: line.description ?? null
        }))
      });

      trackSummary(summary.journalEntries, Boolean(existingJournalEntry));
    }
  }
}

async function syncPeriodJournalEntrySequences(periodIds: PeriodIdMap) {
  for (const [, periodId] of periodIds) {
    const entryCount = await prisma.journalEntry.count({
      where: {
        periodId
      }
    });

    await prisma.accountingPeriod.update({
      where: { id: periodId },
      data: {
        nextJournalEntrySequence: entryCount + 1
      }
    });
  }
}

async function ensureDemoOpeningBalanceSnapshots(
  tenantId: string,
  ledgerId: string,
  membershipId: string,
  periodIds: PeriodIdMap,
  accountIds: SimpleIdMap,
  accountSubjectIdsByCode: Map<string, string>,
  summary: SeedSummary
) {
  const openingSnapshotIds = new Map<string, string>();

  for (const period of DEMO_PERIODS) {
    const periodId = requireMapValue(
      periodIds,
      period.fixtureId,
      'opening snapshot period'
    );
    const existingSnapshot = await prisma.openingBalanceSnapshot.findUnique({
      where: {
        effectivePeriodId: periodId
      },
      select: { id: true }
    });

    const storedSnapshot = await prisma.openingBalanceSnapshot.upsert({
      where: {
        effectivePeriodId: periodId
      },
      update: {
        sourceKind: period.openingSourceKind,
        createdByActorType: DEMO_ACTOR_TYPE,
        createdByMembershipId: membershipId
      },
      create: {
        tenantId,
        ledgerId,
        effectivePeriodId: periodId,
        sourceKind: period.openingSourceKind,
        createdAt: period.openedAt,
        createdByActorType: DEMO_ACTOR_TYPE,
        createdByMembershipId: membershipId
      },
      select: { id: true }
    });

    await prisma.balanceSnapshotLine.deleteMany({
      where: {
        openingSnapshotId: storedSnapshot.id
      }
    });

    await prisma.balanceSnapshotLine.createMany({
      data: buildSnapshotLineInputs({
        snapshotKind: BalanceSnapshotKind.OPENING,
        snapshotId: storedSnapshot.id,
        fundingBalances: period.openingFundingBalances,
        equityAmount: period.openingEquityAmount,
        accountIds,
        accountSubjectIdsByCode
      })
    });

    trackSummary(summary.openingBalanceSnapshots, Boolean(existingSnapshot));
    openingSnapshotIds.set(period.fixtureId, storedSnapshot.id);
  }

  return openingSnapshotIds;
}

async function ensureDemoClosingSnapshots(
  tenantId: string,
  ledgerId: string,
  periodIds: PeriodIdMap,
  accountIds: SimpleIdMap,
  accountSubjectIdsByCode: Map<string, string>,
  summary: SeedSummary
) {
  const closingSnapshotIds = new Map<string, string>();

  for (const period of DEMO_PERIODS.filter(
    (item) => item.status === AccountingPeriodStatus.LOCKED
  )) {
    const periodId = requireMapValue(
      periodIds,
      period.fixtureId,
      'closing snapshot period'
    );
    const closingFundingBalances = period.closingFundingBalances ?? {};
    const closingEquityAmount = period.closingEquityAmount ?? 0;
    const totalAssetAmount = sumObjectValues(closingFundingBalances);
    const totalLiabilityAmount = 0;
    const periodPnLAmount = (period.incomeWon ?? 0) - (period.expenseWon ?? 0);

    const existingSnapshot = await prisma.closingSnapshot.findUnique({
      where: {
        periodId
      },
      select: { id: true }
    });

    const storedSnapshot = await prisma.closingSnapshot.upsert({
      where: {
        periodId
      },
      update: {
        lockedAt: period.lockedAt ?? period.openedAt,
        totalAssetAmount,
        totalLiabilityAmount,
        totalEquityAmount: closingEquityAmount,
        periodPnLAmount
      },
      create: {
        tenantId,
        ledgerId,
        periodId,
        lockedAt: period.lockedAt ?? period.openedAt,
        totalAssetAmount,
        totalLiabilityAmount,
        totalEquityAmount: closingEquityAmount,
        periodPnLAmount
      },
      select: { id: true }
    });

    await prisma.balanceSnapshotLine.deleteMany({
      where: {
        closingSnapshotId: storedSnapshot.id
      }
    });

    await prisma.balanceSnapshotLine.createMany({
      data: buildSnapshotLineInputs({
        snapshotKind: BalanceSnapshotKind.CLOSING,
        snapshotId: storedSnapshot.id,
        fundingBalances: closingFundingBalances,
        equityAmount: closingEquityAmount,
        accountIds,
        accountSubjectIdsByCode
      })
    });

    trackSummary(summary.closingSnapshots, Boolean(existingSnapshot));
    closingSnapshotIds.set(period.fixtureId, storedSnapshot.id);
  }

  return closingSnapshotIds;
}

function buildSnapshotLineInputs(input: {
  snapshotKind: BalanceSnapshotKind;
  snapshotId: string;
  fundingBalances: Partial<Record<string, number>>;
  equityAmount: number;
  accountIds: SimpleIdMap;
  accountSubjectIdsByCode: Map<string, string>;
}) {
  const cashSubjectId = requireMapValue(
    input.accountSubjectIdsByCode,
    DEMO_ACCOUNT_SUBJECT_CODES.cash,
    'snapshot cash subject'
  );
  const equitySubjectId = requireMapValue(
    input.accountSubjectIdsByCode,
    DEMO_ACCOUNT_SUBJECT_CODES.equity,
    'snapshot equity subject'
  );

  const lines: Array<{
    snapshotKind: BalanceSnapshotKind;
    openingSnapshotId: string | null;
    closingSnapshotId: string | null;
    accountSubjectId: string;
    fundingAccountId: string | null;
    balanceAmount: number;
  }> = [];

  for (const [accountKey, balanceAmount] of Object.entries(
    input.fundingBalances
  )) {
    if (!balanceAmount) {
      continue;
    }

    lines.push({
      snapshotKind: input.snapshotKind,
      openingSnapshotId:
        input.snapshotKind === BalanceSnapshotKind.OPENING
          ? input.snapshotId
          : null,
      closingSnapshotId:
        input.snapshotKind === BalanceSnapshotKind.CLOSING
          ? input.snapshotId
          : null,
      accountSubjectId: cashSubjectId,
      fundingAccountId: requireMapValue(
        input.accountIds,
        accountKey,
        'snapshot funding account'
      ),
      balanceAmount
    });
  }

  lines.push({
    snapshotKind: input.snapshotKind,
    openingSnapshotId:
      input.snapshotKind === BalanceSnapshotKind.OPENING
        ? input.snapshotId
        : null,
    closingSnapshotId:
      input.snapshotKind === BalanceSnapshotKind.CLOSING
        ? input.snapshotId
        : null,
    accountSubjectId: equitySubjectId,
    fundingAccountId: null,
    balanceAmount: input.equityAmount
  });

  return lines;
}

async function ensureDemoCarryForwardRecords(
  tenantId: string,
  ledgerId: string,
  membershipId: string,
  periodIds: PeriodIdMap,
  closingSnapshotIds: SimpleIdMap,
  summary: SeedSummary
) {
  for (let index = 0; index < DEMO_PERIODS.length - 1; index += 1) {
    const sourcePeriod = DEMO_PERIODS[index];
    const targetPeriod = DEMO_PERIODS[index + 1];

    if (!sourcePeriod || !targetPeriod) {
      continue;
    }

    if (
      sourcePeriod.status !== AccountingPeriodStatus.LOCKED ||
      targetPeriod.openingSourceKind !== OpeningBalanceSourceKind.CARRY_FORWARD
    ) {
      continue;
    }

    const fromPeriodId = requireMapValue(
      periodIds,
      sourcePeriod.fixtureId,
      'carry-forward source period'
    );
    const toPeriodId = requireMapValue(
      periodIds,
      targetPeriod.fixtureId,
      'carry-forward target period'
    );
    const sourceClosingSnapshotId = requireMapValue(
      closingSnapshotIds,
      sourcePeriod.fixtureId,
      'carry-forward source snapshot'
    );

    const existingRecord = await prisma.carryForwardRecord.findUnique({
      where: {
        fromPeriodId
      },
      select: { id: true }
    });

    await prisma.carryForwardRecord.upsert({
      where: {
        fromPeriodId
      },
      update: {
        toPeriodId,
        sourceClosingSnapshotId,
        createdJournalEntryId: null,
        createdByActorType: DEMO_ACTOR_TYPE,
        createdByMembershipId: membershipId
      },
      create: {
        tenantId,
        ledgerId,
        fromPeriodId,
        toPeriodId,
        sourceClosingSnapshotId,
        createdJournalEntryId: null,
        createdByActorType: DEMO_ACTOR_TYPE,
        createdByMembershipId: membershipId
      }
    });

    trackSummary(summary.carryForwardRecords, Boolean(existingRecord));
  }
}

async function ensureDemoFinancialStatementSnapshots(
  tenantId: string,
  ledgerId: string,
  periodIds: PeriodIdMap,
  summary: SeedSummary
) {
  const lockedPeriods = DEMO_PERIODS.filter(
    (period) => period.status === AccountingPeriodStatus.LOCKED
  );

  for (let index = 0; index < lockedPeriods.length; index += 1) {
    const period = lockedPeriods[index];
    if (!period) {
      continue;
    }

    const previousLockedPeriod =
      index > 0 ? (lockedPeriods[index - 1] ?? null) : null;
    const periodId = requireMapValue(
      periodIds,
      period.fixtureId,
      'financial statement period'
    );
    const statements = buildFinancialStatementSnapshots(
      period,
      previousLockedPeriod
    );

    for (const statement of statements) {
      const existingSnapshot =
        await prisma.financialStatementSnapshot.findUnique({
          where: {
            periodId_statementKind: {
              periodId,
              statementKind: statement.statementKind
            }
          },
          select: { id: true }
        });

      await prisma.financialStatementSnapshot.upsert({
        where: {
          periodId_statementKind: {
            periodId,
            statementKind: statement.statementKind
          }
        },
        update: {
          currency: 'KRW',
          payload: statement.payload
        },
        create: {
          tenantId,
          ledgerId,
          periodId,
          statementKind: statement.statementKind,
          currency: 'KRW',
          payload: statement.payload,
          createdAt: statement.createdAt
        }
      });

      trackSummary(
        summary.financialStatementSnapshots,
        Boolean(existingSnapshot)
      );
    }
  }
}

function buildFinancialStatementSnapshots(
  period: DemoPeriodDefinition,
  previousLockedPeriod: DemoPeriodDefinition | null
) {
  const createdAt = addMinutes(period.lockedAt ?? period.openedAt, 10);
  const closingFundingBalances = period.closingFundingBalances ?? {};
  const totalAssetAmount = sumObjectValues(closingFundingBalances);
  const totalEquityAmount = period.closingEquityAmount ?? totalAssetAmount;
  const incomeWon = period.incomeWon ?? 0;
  const expenseWon = period.expenseWon ?? 0;
  const periodPnLAmount = incomeWon - expenseWon;
  const openingNetWorthWon =
    previousLockedPeriod?.closingEquityAmount ?? period.openingEquityAmount;

  const assetItems = Object.entries(closingFundingBalances).map(
    ([accountKey, amountWon]) => ({
      label: readAccountName(accountKey),
      amountWon
    })
  );

  const expenseItems = (period.expenseBreakdown ?? []).map((item) => ({
    label: item.label,
    amountWon: item.amountWon
  }));

  return [
    {
      statementKind: FinancialStatementKind.STATEMENT_OF_FINANCIAL_POSITION,
      createdAt,
      payload: {
        summary: [
          { label: '자산 합계', amountWon: totalAssetAmount },
          { label: '부채 합계', amountWon: 0 },
          { label: '순자산', amountWon: totalEquityAmount }
        ],
        sections: [
          {
            title: '유동자산',
            items: assetItems
          }
        ],
        notes: [
          period.openingSourceKind === OpeningBalanceSourceKind.CARRY_FORWARD
            ? '차기 이월 기준과 잠금된 전표를 기준으로 생성했습니다.'
            : '초기 설정 잔액과 잠금된 전표를 기준으로 생성했습니다.'
        ]
      }
    },
    {
      statementKind: FinancialStatementKind.MONTHLY_PROFIT_AND_LOSS,
      createdAt,
      payload: {
        summary: [
          { label: '매출 합계', amountWon: incomeWon },
          { label: '비용 합계', amountWon: expenseWon },
          { label: '당기 손익', amountWon: periodPnLAmount }
        ],
        sections: [
          {
            title: '운영비용',
            items: expenseItems
          }
        ],
        notes: []
      }
    },
    {
      statementKind: FinancialStatementKind.CASH_FLOW_SUMMARY,
      createdAt,
      payload: {
        summary: [
          { label: '영업활동 현금흐름', amountWon: periodPnLAmount },
          { label: '투자활동 현금흐름', amountWon: 0 },
          { label: '재무활동 현금흐름', amountWon: 0 }
        ],
        sections: [],
        notes: []
      }
    },
    {
      statementKind: FinancialStatementKind.NET_WORTH_MOVEMENT,
      createdAt,
      payload: {
        summary: [
          { label: '기초 순자산', amountWon: openingNetWorthWon },
          { label: '당기 순증감', amountWon: periodPnLAmount },
          { label: '기말 순자산', amountWon: totalEquityAmount }
        ],
        sections: [],
        notes: []
      }
    }
  ];
}

function readAccountName(accountKey: string) {
  const account = DEMO_ACCOUNTS.find((item) => item.fixtureId === accountKey);
  return account?.name ?? accountKey;
}

async function ensureVehicleAccountingLinks(
  fuelLogIds: SimpleIdMap,
  maintenanceLogIds: SimpleIdMap,
  collectedTransactionIds: SimpleIdMap
) {
  for (const transaction of DEMO_COLLECTED_TRANSACTIONS) {
    const collectedTransactionId = collectedTransactionIds.get(
      transaction.fixtureId
    );
    if (!collectedTransactionId) {
      continue;
    }

    if (transaction.linkedFuelLogKey) {
      const fuelLogId = requireMapValue(
        fuelLogIds,
        transaction.linkedFuelLogKey,
        'linked fuel log'
      );
      await prisma.fuelLog.update({
        where: { id: fuelLogId },
        data: {
          linkedCollectedTransactionId: collectedTransactionId
        }
      });
    }

    if (transaction.linkedMaintenanceLogKey) {
      const maintenanceLogId = requireMapValue(
        maintenanceLogIds,
        transaction.linkedMaintenanceLogKey,
        'linked maintenance log'
      );
      await prisma.vehicleMaintenanceLog.update({
        where: { id: maintenanceLogId },
        data: {
          linkedCollectedTransactionId: collectedTransactionId
        }
      });
    }
  }
}

async function ensureDemoOperationalNotes(
  tenantId: string,
  ledgerId: string,
  membershipId: string,
  periodIds: PeriodIdMap,
  summary: SeedSummary
) {
  for (const note of DEMO_OPERATIONAL_NOTES) {
    const periodId =
      note.periodKey == null
        ? null
        : requireMapValue(periodIds, note.periodKey, 'operational note period');

    const existingNote = await prisma.workspaceOperationalNote.findFirst({
      where: {
        tenantId,
        ledgerId,
        periodId,
        kind: note.kind,
        title: note.title
      },
      select: { id: true }
    });

    if (existingNote) {
      await prisma.workspaceOperationalNote.update({
        where: { id: existingNote.id },
        data: {
          authorMembershipId: membershipId,
          body: note.body,
          relatedHref: note.relatedHref
        }
      });

      summary.operationalNotes.skipped += 1;
      continue;
    }

    await prisma.workspaceOperationalNote.create({
      data: {
        tenantId,
        ledgerId,
        periodId,
        authorMembershipId: membershipId,
        kind: note.kind,
        title: note.title,
        body: note.body,
        relatedHref: note.relatedHref,
        createdAt: note.createdAt
      }
    });

    summary.operationalNotes.created += 1;
  }
}

async function ensureDemoMonthlyOperations(input: {
  tenantId: string;
  ledgerId: string;
  membershipId: string;
  accountIds: SimpleIdMap;
  categoryIds: SimpleIdMap;
  recurringRuleIds: SimpleIdMap;
  fuelLogIds: SimpleIdMap;
  maintenanceLogIds: SimpleIdMap;
  summary: SeedSummary;
}) {
  await ensureDemoLedgerMetadata(input.ledgerId);

  const refs = await loadLedgerReferenceIds(input.tenantId, input.ledgerId);
  const periodIds = await ensureDemoPeriods(
    input.tenantId,
    input.ledgerId,
    input.membershipId,
    input.summary
  );
  const planItemIds = await ensureDemoPlanItems(
    input.tenantId,
    input.ledgerId,
    periodIds,
    input.recurringRuleIds,
    refs.transactionTypeIdsByCode,
    input.accountIds,
    input.categoryIds,
    input.summary
  );
  const importBatches = await ensureDemoImportBatches(
    input.tenantId,
    input.ledgerId,
    input.membershipId,
    periodIds,
    input.accountIds,
    input.summary
  );
  const collectedTransactionIds = await ensureDemoCollectedTransactions(
    input.tenantId,
    input.ledgerId,
    periodIds,
    importBatches,
    refs.transactionTypeIdsByCode,
    input.accountIds,
    input.categoryIds,
    planItemIds,
    input.summary
  );
  await ensureDemoJournalEntries(
    input.tenantId,
    input.ledgerId,
    input.membershipId,
    periodIds,
    input.accountIds,
    refs.accountSubjectIdsByCode,
    collectedTransactionIds,
    planItemIds,
    input.summary
  );
  await syncPeriodJournalEntrySequences(periodIds);
  const openingSnapshotIds = await ensureDemoOpeningBalanceSnapshots(
    input.tenantId,
    input.ledgerId,
    input.membershipId,
    periodIds,
    input.accountIds,
    refs.accountSubjectIdsByCode,
    input.summary
  );
  const closingSnapshotIds = await ensureDemoClosingSnapshots(
    input.tenantId,
    input.ledgerId,
    periodIds,
    input.accountIds,
    refs.accountSubjectIdsByCode,
    input.summary
  );

  if (openingSnapshotIds.size === 0) {
    throw new Error('Failed to seed opening balance snapshots.');
  }

  await ensureDemoCarryForwardRecords(
    input.tenantId,
    input.ledgerId,
    input.membershipId,
    periodIds,
    closingSnapshotIds,
    input.summary
  );
  await ensureDemoFinancialStatementSnapshots(
    input.tenantId,
    input.ledgerId,
    periodIds,
    input.summary
  );
  await ensureVehicleAccountingLinks(
    input.fuelLogIds,
    input.maintenanceLogIds,
    collectedTransactionIds
  );
  await ensureDemoOperationalNotes(
    input.tenantId,
    input.ledgerId,
    input.membershipId,
    periodIds,
    input.summary
  );
}

type DemoSeedOptions = {
  prismaClient?: PrismaClient;
  apiEnv?: ApiEnv;
  resetDemoUser?: boolean;
  seedInitialAdmin?: boolean;
  shouldPrintSummary?: boolean;
};

async function resetDemoUserIfRequested(
  summary: SeedSummary,
  shouldReset: boolean
) {
  if (!shouldReset) {
    return;
  }

  const resetSummary = await resetDemoUserAndOwnedWorkspaces(
    prisma,
    env.DEMO_EMAIL
  );
  summary.resetDemoUser = resetSummary.userDeleted;
}

function readInitialAdminSeedCredentials(): {
  email: string;
  name: string;
  password: string;
} | null {
  const email = env.INITIAL_ADMIN_EMAIL;
  const password = env.INITIAL_ADMIN_PASSWORD;

  if (!email && !password && !env.INITIAL_ADMIN_NAME) {
    return null;
  }

  if (!email || !password) {
    throw new Error(
      '[seed] INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD must both be set to seed an additional initial admin account.'
    );
  }

  return {
    email,
    name: env.INITIAL_ADMIN_NAME ?? 'Initial Admin',
    password
  };
}

function buildPeriodRange(year: number, month: number) {
  return {
    startDate: new Date(Date.UTC(year, month - 1, 1)),
    endDate: new Date(Date.UTC(year, month, 1))
  };
}

function sumObjectValues(input: Partial<Record<string, number>>) {
  let total = 0;

  for (const value of Object.values(input)) {
    total += value ?? 0;
  }

  return total;
}

function requireMapValue<K, V>(map: Map<K, V>, key: K, context: string) {
  const value = map.get(key);
  if (value == null) {
    throw new Error(`Missing ${context}: ${String(key)}`);
  }

  return value;
}

export async function seedDemoData(options: DemoSeedOptions = {}) {
  const previousPrisma = prisma;
  const previousEnv = env;
  const previousCredentialDigestPromise = demoCredentialDigestPromise;
  prisma = options.prismaClient ?? previousPrisma ?? getDefaultPrismaClient();
  env = options.apiEnv ?? previousEnv ?? getApiEnv();
  demoCredentialDigestPromise = argon2.hash(DEMO_LOGIN_PHRASE);

  const summary = createSummary();
  const seedInitialAdmin = options.seedInitialAdmin ?? true;

  try {
    await resetDemoUserIfRequested(summary, options.resetDemoUser ?? false);

    const userId = await ensureDemoUser(summary);
    await ensureDemoSettings(userId, summary);
    const backbone = await ensurePhase1BackboneForUser(prisma, userId);

    if (seedInitialAdmin) {
      const initialAdminUserId = await ensureInitialAdminUser(summary);

      if (initialAdminUserId) {
        await ensureDemoSettings(initialAdminUserId, summary);
        await ensurePhase1BackboneForUser(prisma, initialAdminUserId);
      }
    }

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

    await ensureDemoLiabilityAgreements(
      userId,
      backbone.tenantId,
      backbone.ledgerId,
      accountIds,
      categoryIds,
      summary
    );

    const vehicleId = await ensureDemoVehicle(
      userId,
      backbone.tenantId,
      backbone.ledgerId,
      accountIds,
      categoryIds,
      summary
    );
    const fuelLogIds = await ensureDemoFuelLogs(vehicleId, summary);
    const maintenanceLogIds = await ensureDemoVehicleMaintenanceLogs(
      vehicleId,
      summary
    );

    await ensureDemoMonthlyOperations({
      tenantId: backbone.tenantId,
      ledgerId: backbone.ledgerId,
      membershipId: backbone.membershipId,
      accountIds,
      categoryIds,
      recurringRuleIds,
      fuelLogIds,
      maintenanceLogIds,
      summary
    });

    if (options.shouldPrintSummary ?? true) {
      printSummary(summary);
    }

    return summary;
  } finally {
    prisma = previousPrisma;
    env = previousEnv;
    demoCredentialDigestPromise = previousCredentialDigestPromise;
  }
}

async function main() {
  await seedDemoData({
    resetDemoUser: process.argv.includes('--reset'),
    seedInitialAdmin: true,
    shouldPrintSummary: true
  });
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await disconnectDefaultPrismaClient();
    });
}
