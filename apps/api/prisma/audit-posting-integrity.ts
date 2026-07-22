import {
  CollectedTransactionStatus,
  FundingAccountDirection,
  PostingPolicyKey,
  PrismaClient
} from '@prisma/client';
import { writeFile } from 'node:fs/promises';

type FindingSeverity = 'BLOCKER' | 'WARNING';

type PostingIntegrityFinding = {
  severity: FindingSeverity;
  code: string;
  ledgerId: string;
  resourceType: 'CollectedTransaction' | 'RecurringRule' | 'PlanItem';
  resourceId: string;
  message: string;
};

export type PostingIntegrityAuditReport = {
  generatedAt: string;
  ledgerId: string | null;
  inspected: {
    collectedTransactions: number;
    recurringRules: number;
    planItems: number;
  };
  blockerCount: number;
  warningCount: number;
  findings: PostingIntegrityFinding[];
};

const SIMPLE_DIRECTIONS: Partial<
  Record<PostingPolicyKey, FundingAccountDirection>
> = {
  INCOME_BASIC: FundingAccountDirection.INFLOW,
  EXPENSE_BASIC: FundingAccountDirection.OUTFLOW,
  CARD_SPEND: FundingAccountDirection.OUTFLOW
};

const READY_OR_POSTED_STATUSES: CollectedTransactionStatus[] = [
  CollectedTransactionStatus.READY_TO_POST,
  CollectedTransactionStatus.POSTED,
  CollectedTransactionStatus.CORRECTED,
  CollectedTransactionStatus.LOCKED
];

const BASIC_CASH_POLICIES: PostingPolicyKey[] = [
  PostingPolicyKey.INCOME_BASIC,
  PostingPolicyKey.EXPENSE_BASIC
];

const COUNTERPARTY_POLICIES: PostingPolicyKey[] = [
  PostingPolicyKey.TRANSFER_BASIC,
  PostingPolicyKey.CARD_PAYMENT
];

export async function auditPostingIntegrity(
  prisma: PrismaClient,
  ledgerId?: string
): Promise<PostingIntegrityAuditReport> {
  const where = ledgerId ? { ledgerId } : undefined;
  const [transactions, recurringRules, planItems] = await Promise.all([
    prisma.collectedTransaction.findMany({
      where,
      include: {
        ledgerTransactionType: true,
        fundingAccount: {
          select: {
            id: true,
            ledgerId: true,
            type: true,
            status: true,
            linkedAccountSubjectId: true
          }
        },
        counterpartyFundingAccount: {
          select: {
            id: true,
            ledgerId: true,
            type: true,
            status: true,
            linkedAccountSubjectId: true
          }
        },
        postedJournalEntry: { select: { id: true } }
      }
    }),
    prisma.recurringRule.findMany({
      where,
      include: {
        ledgerTransactionType: true,
        account: { select: { id: true, ledgerId: true, type: true, status: true } },
        counterpartyFundingAccount: {
          select: { id: true, ledgerId: true, type: true, status: true }
        }
      }
    }),
    prisma.planItem.findMany({
      where,
      include: {
        ledgerTransactionType: true,
        fundingAccount: {
          select: { id: true, ledgerId: true, type: true, status: true }
        },
        counterpartyFundingAccount: {
          select: { id: true, ledgerId: true, type: true, status: true }
        }
      }
    })
  ]);

  const findings: PostingIntegrityFinding[] = [];

  for (const transaction of transactions) {
    const policy = transaction.ledgerTransactionType.postingPolicyKey;
    const base = {
      ledgerId: transaction.ledgerId,
      resourceType: 'CollectedTransaction' as const,
      resourceId: transaction.id
    };

    if (!transaction.fundingAccount.linkedAccountSubjectId) {
      findings.push({
        ...base,
        severity: 'BLOCKER',
        code: 'PRIMARY_ACCOUNT_SUBJECT_LINK_MISSING',
        message: '기준 자금수단에 연결 계정과목이 없습니다.'
      });
    }

    if (
      policy === PostingPolicyKey.EXPENSE_BASIC &&
      transaction.fundingAccount.type === 'CARD' &&
      transaction.postedJournalEntry
    ) {
      findings.push({
        ...base,
        severity: 'BLOCKER',
        code: 'POSTED_CARD_EXPENSE_POLICY_MISMATCH',
        message:
          'CARD 자금수단의 확정 전표가 EXPENSE_BASIC으로 게시되어 수동 정정이 필요합니다.'
      });
    }

    inspectPostingShape(findings, {
      ...base,
      policy,
      primary: transaction.fundingAccount,
      counterparty: transaction.counterpartyFundingAccount,
      direction: transaction.fundingAccountDirection,
      readyOrPosted: READY_OR_POSTED_STATUSES.includes(transaction.status)
    });
  }

  for (const rule of recurringRules) {
    const base = {
      ledgerId: rule.ledgerId,
      resourceType: 'RecurringRule' as const,
      resourceId: rule.id
    };
    if (!rule.ledgerTransactionType) {
      findings.push({
        ...base,
        severity: rule.isActive ? 'BLOCKER' : 'WARNING',
        code: 'RECURRING_TRANSACTION_TYPE_MISSING',
        message: '반복규칙에 거래유형이 없습니다.'
      });
      continue;
    }

    inspectPostingShape(findings, {
      ...base,
      policy: rule.ledgerTransactionType.postingPolicyKey,
      primary: rule.account,
      counterparty: rule.counterpartyFundingAccount,
      direction: rule.fundingAccountDirection,
      readyOrPosted: rule.isActive
    });
  }

  for (const item of planItems) {
    inspectPostingShape(findings, {
      ledgerId: item.ledgerId,
      resourceType: 'PlanItem',
      resourceId: item.id,
      policy: item.ledgerTransactionType.postingPolicyKey,
      primary: item.fundingAccount,
      counterparty: item.counterpartyFundingAccount,
      direction: item.fundingAccountDirection,
      readyOrPosted: !['SKIPPED', 'EXPIRED'].includes(item.status)
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    ledgerId: ledgerId ?? null,
    inspected: {
      collectedTransactions: transactions.length,
      recurringRules: recurringRules.length,
      planItems: planItems.length
    },
    blockerCount: findings.filter((item) => item.severity === 'BLOCKER').length,
    warningCount: findings.filter((item) => item.severity === 'WARNING').length,
    findings
  };
}

function inspectPostingShape(
  findings: PostingIntegrityFinding[],
  input: {
    ledgerId: string;
    resourceType: PostingIntegrityFinding['resourceType'];
    resourceId: string;
    policy: PostingPolicyKey;
    primary: {
      id: string;
      ledgerId: string;
      type: 'BANK' | 'CASH' | 'CARD';
      status: 'ACTIVE' | 'INACTIVE' | 'CLOSED';
    };
    counterparty: {
      id: string;
      ledgerId: string;
      type: 'BANK' | 'CASH' | 'CARD';
      status: 'ACTIVE' | 'INACTIVE' | 'CLOSED';
    } | null;
    direction: FundingAccountDirection | null;
    readyOrPosted: boolean;
  }
) {
  const base = {
    ledgerId: input.ledgerId,
    resourceType: input.resourceType,
    resourceId: input.resourceId
  };
  const severity: FindingSeverity = input.readyOrPosted ? 'BLOCKER' : 'WARNING';

  if (input.primary.ledgerId !== input.ledgerId) {
    findings.push({
      ...base,
      severity: 'BLOCKER',
      code: 'PRIMARY_ACCOUNT_CROSS_LEDGER',
      message: '기준 자금수단이 다른 장부에 속합니다.'
    });
  }

  if (input.primary.status !== 'ACTIVE' && input.readyOrPosted) {
    findings.push({
      ...base,
      severity,
      code: 'PRIMARY_ACCOUNT_NOT_ACTIVE',
      message: '처리 가능한 거래의 기준 자금수단이 ACTIVE 상태가 아닙니다.'
    });
  }

  const expectedDirection = SIMPLE_DIRECTIONS[input.policy];
  if (expectedDirection && input.direction !== expectedDirection) {
    findings.push({
      ...base,
      severity,
      code: 'FUNDING_DIRECTION_MISMATCH',
      message: `${input.policy} 거래의 방향은 ${expectedDirection}여야 합니다.`
    });
  }

  if (
    BASIC_CASH_POLICIES.includes(input.policy) &&
    input.primary.type === 'CARD'
  ) {
    findings.push({
      ...base,
      severity,
      code: 'BANK_OR_CASH_REQUIRED',
      message: `${input.policy} 거래에는 BANK/CASH 자금수단이 필요합니다.`
    });
  }

  if (
    input.policy === PostingPolicyKey.CARD_SPEND &&
    input.primary.type !== 'CARD'
  ) {
    findings.push({
      ...base,
      severity,
      code: 'CARD_REQUIRED',
      message: 'CARD_SPEND 거래에는 CARD 자금수단이 필요합니다.'
    });
  }

  if (
    !COUNTERPARTY_POLICIES.includes(input.policy)
  ) {
    if (input.counterparty) {
      findings.push({
        ...base,
        severity: 'WARNING',
        code: 'UNEXPECTED_COUNTERPARTY_ACCOUNT',
        message: `${input.policy} 거래에는 상대 자금수단이 필요하지 않습니다.`
      });
    }
    return;
  }

  if (!input.counterparty || !input.direction) {
    findings.push({
      ...base,
      severity,
      code: 'COUNTERPARTY_OR_DIRECTION_MISSING',
      message: `${input.policy} 거래에 상대 자금수단 또는 방향이 없습니다.`
    });
    return;
  }

  if (input.counterparty.id === input.primary.id) {
    findings.push({
      ...base,
      severity: 'BLOCKER',
      code: 'SAME_FUNDING_ACCOUNT',
      message: '기준 자금수단과 상대 자금수단이 같습니다.'
    });
  }

  if (input.counterparty.ledgerId !== input.ledgerId) {
    findings.push({
      ...base,
      severity: 'BLOCKER',
      code: 'COUNTERPARTY_ACCOUNT_CROSS_LEDGER',
      message: '상대 자금수단이 다른 장부에 속합니다.'
    });
  }

  if (input.counterparty.status !== 'ACTIVE' && input.readyOrPosted) {
    findings.push({
      ...base,
      severity,
      code: 'COUNTERPARTY_ACCOUNT_NOT_ACTIVE',
      message: '처리 가능한 거래의 상대 자금수단이 ACTIVE 상태가 아닙니다.'
    });
  }

  const source =
    input.direction === FundingAccountDirection.OUTFLOW
      ? input.primary
      : input.counterparty;
  const destination =
    input.direction === FundingAccountDirection.OUTFLOW
      ? input.counterparty
      : input.primary;

  if (
    input.policy === PostingPolicyKey.TRANSFER_BASIC &&
    (source.type === 'CARD' || destination.type === 'CARD')
  ) {
    findings.push({
      ...base,
      severity,
      code: 'TRANSFER_CARD_NOT_ALLOWED',
      message: 'TRANSFER_BASIC은 BANK/CASH 계정 사이에서만 허용됩니다.'
    });
  }

  if (
    input.policy === PostingPolicyKey.CARD_PAYMENT &&
    (source.type === 'CARD' || destination.type !== 'CARD')
  ) {
    findings.push({
      ...base,
      severity,
      code: 'CARD_PAYMENT_ACCOUNT_COMBINATION_INVALID',
      message: 'CARD_PAYMENT은 BANK/CASH 출발과 CARD 도착 조합이어야 합니다.'
    });
  }
}

function readFlagValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const report = await auditPostingIntegrity(
      prisma,
      readFlagValue('--ledger-id')
    );
    const output = `${JSON.stringify(report, null, 2)}\n`;
    const reportPath = readFlagValue('--report');
    if (reportPath) {
      await writeFile(reportPath, output, 'utf8');
    }
    process.stdout.write(output);
    if (
      process.argv.includes('--fail-on-findings') &&
      report.findings.length > 0
    ) {
      process.exitCode = 2;
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
