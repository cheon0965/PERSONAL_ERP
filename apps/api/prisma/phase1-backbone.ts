import {
  AccountNormalSide,
  AccountSubjectKind,
  AccountSubjectStatementType,
  LedgerStatus,
  LedgerTransactionFlowKind,
  PostingPolicyKey,
  PrismaClient,
  TenantMembershipRole,
  TenantMembershipStatus,
  TenantStatus
} from '@prisma/client';

const DEFAULT_LEDGER_NAME = '기본 장부';

const DEFAULT_ACCOUNT_SUBJECTS = [
  {
    code: '1010',
    name: '현금및예금',
    statementType: AccountSubjectStatementType.BALANCE_SHEET,
    normalSide: AccountNormalSide.DEBIT,
    subjectKind: AccountSubjectKind.ASSET,
    isSystem: true,
    sortOrder: 10
  },
  {
    code: '2100',
    name: '카드미지급금',
    statementType: AccountSubjectStatementType.BALANCE_SHEET,
    normalSide: AccountNormalSide.CREDIT,
    subjectKind: AccountSubjectKind.LIABILITY,
    isSystem: true,
    sortOrder: 20
  },
  {
    code: '3100',
    name: '순자산',
    statementType: AccountSubjectStatementType.BALANCE_SHEET,
    normalSide: AccountNormalSide.CREDIT,
    subjectKind: AccountSubjectKind.EQUITY,
    isSystem: true,
    sortOrder: 30
  },
  {
    code: '4100',
    name: '운영수익',
    statementType: AccountSubjectStatementType.PROFIT_AND_LOSS,
    normalSide: AccountNormalSide.CREDIT,
    subjectKind: AccountSubjectKind.INCOME,
    isSystem: true,
    sortOrder: 40
  },
  {
    code: '5100',
    name: '운영비용',
    statementType: AccountSubjectStatementType.PROFIT_AND_LOSS,
    normalSide: AccountNormalSide.DEBIT,
    subjectKind: AccountSubjectKind.EXPENSE,
    isSystem: true,
    sortOrder: 50
  }
] as const;

const DEFAULT_LEDGER_TRANSACTION_TYPES = [
  {
    code: 'INCOME_BASIC',
    name: '기본 수입',
    flowKind: LedgerTransactionFlowKind.INCOME,
    postingPolicyKey: PostingPolicyKey.INCOME_BASIC,
    sortOrder: 10
  },
  {
    code: 'EXPENSE_BASIC',
    name: '기본 지출',
    flowKind: LedgerTransactionFlowKind.EXPENSE,
    postingPolicyKey: PostingPolicyKey.EXPENSE_BASIC,
    sortOrder: 20
  },
  {
    code: 'TRANSFER_BASIC',
    name: '기본 이체',
    flowKind: LedgerTransactionFlowKind.TRANSFER,
    postingPolicyKey: PostingPolicyKey.TRANSFER_BASIC,
    sortOrder: 30
  },
  {
    code: 'CARD_SPEND',
    name: '카드 사용',
    flowKind: LedgerTransactionFlowKind.EXPENSE,
    postingPolicyKey: PostingPolicyKey.CARD_SPEND,
    sortOrder: 40
  },
  {
    code: 'CARD_PAYMENT',
    name: '카드 대금 결제',
    flowKind: LedgerTransactionFlowKind.TRANSFER,
    postingPolicyKey: PostingPolicyKey.CARD_PAYMENT,
    sortOrder: 50
  },
  {
    code: 'OPENING_BALANCE',
    name: '오프닝 잔액',
    flowKind: LedgerTransactionFlowKind.OPENING_BALANCE,
    postingPolicyKey: PostingPolicyKey.OPENING_BALANCE,
    sortOrder: 60
  },
  {
    code: 'MANUAL_ADJUSTMENT',
    name: '수동 조정',
    flowKind: LedgerTransactionFlowKind.ADJUSTMENT,
    postingPolicyKey: PostingPolicyKey.MANUAL_ADJUSTMENT,
    sortOrder: 70
  }
] as const;

type BackboneUser = {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
};

export type Phase1BackboneResult = {
  userId: string;
  tenantId: string;
  ledgerId: string;
  membershipId: string;
};

export type Phase1BackboneSummary = {
  usersProcessed: number;
  tenantsCreated: number;
  ledgersCreated: number;
  membershipsCreated: number;
  legacyRowsBackfilled: {
    accounts: number;
    categories: number;
    transactions: number;
    recurringRules: number;
    insurancePolicies: number;
    vehicles: number;
  };
};

function createSummary(): Phase1BackboneSummary {
  return {
    usersProcessed: 0,
    tenantsCreated: 0,
    ledgersCreated: 0,
    membershipsCreated: 0,
    legacyRowsBackfilled: {
      accounts: 0,
      categories: 0,
      transactions: 0,
      recurringRules: 0,
      insurancePolicies: 0,
      vehicles: 0
    }
  };
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildTenantSlug(user: BackboneUser) {
  const emailPrefix = user.email.split('@')[0] ?? 'workspace';
  const base = slugify(emailPrefix) || 'workspace';
  const suffix = user.id.slice(-8).toLowerCase();
  return `${base}-${suffix}`.slice(0, 191);
}

function buildTenantName(user: BackboneUser) {
  const base = user.name.trim() || user.email.split('@')[0] || '사업';
  return `${base} 워크스페이스`.slice(0, 191);
}

function formatYearMonth(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

async function resolveOpenedFromYearMonth(
  prisma: PrismaClient,
  user: BackboneUser
) {
  const [firstTransaction, firstRecurringRule, firstAccount, firstCategory] =
    await Promise.all([
      prisma.transaction.findFirst({
        where: { userId: user.id },
        orderBy: { businessDate: 'asc' },
        select: { businessDate: true }
      }),
      prisma.recurringRule.findFirst({
        where: { userId: user.id },
        orderBy: { startDate: 'asc' },
        select: { startDate: true }
      }),
      prisma.account.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true }
      }),
      prisma.category.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true }
      })
    ]);

  const candidates = [
    user.createdAt,
    firstTransaction?.businessDate,
    firstRecurringRule?.startDate,
    firstAccount?.createdAt,
    firstCategory?.createdAt
  ].filter((value): value is Date => Boolean(value));

  const earliest = new Date(
    Math.min(...candidates.map((value) => value.getTime()))
  );
  return formatYearMonth(earliest);
}

async function ensureBaseMasters(
  prisma: PrismaClient,
  tenantId: string,
  ledgerId: string
) {
  for (const subject of DEFAULT_ACCOUNT_SUBJECTS) {
    await prisma.accountSubject.upsert({
      where: {
        ledgerId_code: {
          ledgerId,
          code: subject.code
        }
      },
      update: {
        name: subject.name,
        statementType: subject.statementType,
        normalSide: subject.normalSide,
        subjectKind: subject.subjectKind,
        isSystem: subject.isSystem,
        isActive: true,
        sortOrder: subject.sortOrder
      },
      create: {
        tenantId,
        ledgerId,
        code: subject.code,
        name: subject.name,
        statementType: subject.statementType,
        normalSide: subject.normalSide,
        subjectKind: subject.subjectKind,
        isSystem: subject.isSystem,
        isActive: true,
        sortOrder: subject.sortOrder
      }
    });
  }

  for (const type of DEFAULT_LEDGER_TRANSACTION_TYPES) {
    await prisma.ledgerTransactionType.upsert({
      where: {
        ledgerId_code: {
          ledgerId,
          code: type.code
        }
      },
      update: {
        name: type.name,
        flowKind: type.flowKind,
        postingPolicyKey: type.postingPolicyKey,
        isActive: true,
        sortOrder: type.sortOrder
      },
      create: {
        tenantId,
        ledgerId,
        code: type.code,
        name: type.name,
        flowKind: type.flowKind,
        postingPolicyKey: type.postingPolicyKey,
        isActive: true,
        sortOrder: type.sortOrder
      }
    });
  }
}

async function backfillLegacyData(
  prisma: PrismaClient,
  userId: string,
  tenantId: string,
  ledgerId: string,
  summary: Phase1BackboneSummary
) {
  const [
    accounts,
    categories,
    transactions,
    recurringRules,
    insurancePolicies,
    vehicles
  ] =
    await Promise.all([
      prisma.account.updateMany({
        where: { userId },
        data: { tenantId, ledgerId }
      }),
      prisma.category.updateMany({
        where: { userId },
        data: { tenantId, ledgerId }
      }),
      prisma.transaction.updateMany({
        where: { userId },
        data: { tenantId, ledgerId }
      }),
      prisma.recurringRule.updateMany({
        where: { userId },
        data: { tenantId, ledgerId }
      }),
      prisma.insurancePolicy.updateMany({
        where: { userId },
        data: { tenantId, ledgerId }
      }),
      prisma.vehicle.updateMany({
        where: { userId },
        data: { tenantId, ledgerId }
      })
    ]);

  summary.legacyRowsBackfilled.accounts += accounts.count;
  summary.legacyRowsBackfilled.categories += categories.count;
  summary.legacyRowsBackfilled.transactions += transactions.count;
  summary.legacyRowsBackfilled.recurringRules += recurringRules.count;
  summary.legacyRowsBackfilled.insurancePolicies += insurancePolicies.count;
  summary.legacyRowsBackfilled.vehicles += vehicles.count;

  const transactionTypeByCode = new Map(
    (
      await prisma.ledgerTransactionType.findMany({
        where: { ledgerId },
        select: { id: true, code: true }
      })
    ).map((item) => [item.code, item.id])
  );

  const recurringRulesWithoutType = await prisma.recurringRule.findMany({
    where: {
      userId,
      ledgerId,
      ledgerTransactionTypeId: null
    },
    include: {
      category: {
        select: { kind: true }
      }
    }
  });

  for (const rule of recurringRulesWithoutType) {
    let code: string | null = null;

    if (rule.category?.kind === 'INCOME') {
      code = 'INCOME_BASIC';
    } else if (rule.category?.kind === 'EXPENSE') {
      code = 'EXPENSE_BASIC';
    } else if (rule.category?.kind === 'TRANSFER') {
      code = 'TRANSFER_BASIC';
    }

    const ledgerTransactionTypeId = code
      ? transactionTypeByCode.get(code)
      : undefined;
    if (!ledgerTransactionTypeId) {
      continue;
    }

    await prisma.recurringRule.update({
      where: { id: rule.id },
      data: { ledgerTransactionTypeId }
    });
  }
}

async function ensureTenantAndLedger(
  prisma: PrismaClient,
  user: BackboneUser,
  summary: Phase1BackboneSummary
) {
  let tenant = await prisma.tenant.findFirst({
    where: {
      memberships: {
        some: { userId: user.id }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        slug: buildTenantSlug(user),
        name: buildTenantName(user),
        status: TenantStatus.ACTIVE
      }
    });
    summary.tenantsCreated += 1;
  }

  let membership = await prisma.tenantMembership.findUnique({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: user.id
      }
    }
  });

  if (!membership) {
    membership = await prisma.tenantMembership.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        role: TenantMembershipRole.OWNER,
        status: TenantMembershipStatus.ACTIVE
      }
    });
    summary.membershipsCreated += 1;
  } else if (
    membership.role !== TenantMembershipRole.OWNER ||
    membership.status !== TenantMembershipStatus.ACTIVE
  ) {
    membership = await prisma.tenantMembership.update({
      where: { id: membership.id },
      data: {
        role: TenantMembershipRole.OWNER,
        status: TenantMembershipStatus.ACTIVE
      }
    });
  }

  let ledger = tenant.defaultLedgerId
    ? await prisma.ledger.findUnique({ where: { id: tenant.defaultLedgerId } })
    : null;

  if (!ledger) {
    ledger = await prisma.ledger.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'asc' }
    });
  }

  if (!ledger) {
    ledger = await prisma.ledger.create({
      data: {
        tenantId: tenant.id,
        name: DEFAULT_LEDGER_NAME,
        baseCurrency: 'KRW',
        timezone: 'Asia/Seoul',
        status: LedgerStatus.ACTIVE,
        openedFromYearMonth: await resolveOpenedFromYearMonth(prisma, user)
      }
    });
    summary.ledgersCreated += 1;
  }

  if (
    tenant.defaultLedgerId !== ledger.id ||
    tenant.status !== TenantStatus.ACTIVE
  ) {
    tenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        defaultLedgerId: ledger.id,
        status: TenantStatus.ACTIVE
      }
    });
  }

  return {
    tenantId: tenant.id,
    ledgerId: ledger.id,
    membershipId: membership.id
  };
}

async function getUserOrThrow(prisma: PrismaClient, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true
    }
  });

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  return user;
}

export async function ensurePhase1BackboneForUser(
  prisma: PrismaClient,
  userId: string,
  summary = createSummary()
): Promise<Phase1BackboneResult> {
  const user = await getUserOrThrow(prisma, userId);
  const backbone = await ensureTenantAndLedger(prisma, user, summary);

  await ensureBaseMasters(prisma, backbone.tenantId, backbone.ledgerId);
  await backfillLegacyData(
    prisma,
    user.id,
    backbone.tenantId,
    backbone.ledgerId,
    summary
  );

  summary.usersProcessed += 1;

  return {
    userId: user.id,
    tenantId: backbone.tenantId,
    ledgerId: backbone.ledgerId,
    membershipId: backbone.membershipId
  };
}

export async function backfillPhase1Backbone(
  prisma: PrismaClient,
  filter?: { email?: string }
) {
  const summary = createSummary();
  const users = await prisma.user.findMany({
    where: filter?.email ? { email: filter.email } : undefined,
    orderBy: { createdAt: 'asc' },
    select: {
      id: true
    }
  });

  for (const user of users) {
    await ensurePhase1BackboneForUser(prisma, user.id, summary);
  }

  return summary;
}

export function formatPhase1BackboneSummary(summary: Phase1BackboneSummary) {
  return [
    '[INFO] Phase 1 backbone backfill summary',
    `  - users processed: ${summary.usersProcessed}`,
    `  - tenants created: ${summary.tenantsCreated}`,
    `  - ledgers created: ${summary.ledgersCreated}`,
    `  - memberships created: ${summary.membershipsCreated}`,
    `  - accounts backfilled: ${summary.legacyRowsBackfilled.accounts}`,
    `  - categories backfilled: ${summary.legacyRowsBackfilled.categories}`,
    `  - transactions backfilled: ${summary.legacyRowsBackfilled.transactions}`,
    `  - recurring rules backfilled: ${summary.legacyRowsBackfilled.recurringRules}`,
    `  - insurance policies backfilled: ${summary.legacyRowsBackfilled.insurancePolicies}`,
    `  - vehicles backfilled: ${summary.legacyRowsBackfilled.vehicles}`
  ].join('\n');
}
