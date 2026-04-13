import { Injectable } from '@nestjs/common';
import {
  AccountNormalSide,
  AccountSubjectKind,
  AccountSubjectStatementType,
  LedgerStatus,
  LedgerTransactionFlowKind,
  PostingPolicyKey,
  Prisma,
  TenantMembershipRole,
  TenantMembershipStatus,
  TenantStatus
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

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

type WorkspaceBootstrapPrisma = PrismaService | Prisma.TransactionClient;

type WorkspaceBootstrapUser = {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
};

@Injectable()
export class WorkspaceBootstrapService {
  async ensureForUser(
    prisma: WorkspaceBootstrapPrisma,
    userId: string
  ): Promise<{
    tenantId: string;
    ledgerId: string;
    membershipId: string;
  }> {
    const user = await this.getUserOrThrow(prisma, userId);
    const { tenantId, ledgerId, membershipId } =
      await this.ensureTenantAndLedger(prisma, user);
    await this.ensureBaseMasters(prisma, tenantId, ledgerId);
    return { tenantId, ledgerId, membershipId };
  }

  private async getUserOrThrow(
    prisma: WorkspaceBootstrapPrisma,
    userId: string
  ): Promise<WorkspaceBootstrapUser> {
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

  private async ensureTenantAndLedger(
    prisma: WorkspaceBootstrapPrisma,
    user: WorkspaceBootstrapUser
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
      ? await prisma.ledger.findUnique({
          where: { id: tenant.defaultLedgerId }
        })
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
          openedFromYearMonth: formatYearMonth(user.createdAt)
        }
      });
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

  private async ensureBaseMasters(
    prisma: WorkspaceBootstrapPrisma,
    tenantId: string,
    ledgerId: string
  ): Promise<void> {
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
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildTenantSlug(user: WorkspaceBootstrapUser): string {
  const emailPrefix = user.email.split('@')[0] ?? 'workspace';
  const base = slugify(emailPrefix) || 'workspace';
  const suffix = user.id.slice(-8).toLowerCase();
  return `${base}-${suffix}`.slice(0, 191);
}

function buildTenantName(user: WorkspaceBootstrapUser): string {
  const base = user.name.trim() || user.email.split('@')[0] || '사업';
  return `${base} 워크스페이스`.slice(0, 191);
}

function formatYearMonth(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
