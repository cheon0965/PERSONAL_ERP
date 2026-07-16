import {
  AccountType,
  CategoryKind,
  CollectedTransactionStatus,
  FundingAccountDirection,
  PostingPolicyKey,
  Prisma,
  PrismaClient
} from '@prisma/client';
import { writeFile } from 'node:fs/promises';
import {
  readGenericAccountSubjectCode,
  STANDARD_ACCOUNT_SUBJECT_CATALOG,
  STANDARD_ACCOUNT_SUBJECT_CODES
} from '../src/common/prisma/standard-account-subject.catalog';

type BackfillBlocker = {
  ledgerId: string;
  code: string;
  resourceId: string | null;
  message: string;
};

type LedgerBackfillSummary = {
  ledgerId: string;
  blockers: BackfillBlocker[];
  planned: {
    accountSubjectsCreated: number;
    fundingAccountsLinked: number;
    categoriesMapped: number;
    transactionDirectionsSet: number;
    cardSpendPoliciesCorrected: number;
    incompleteTransactionsReviewed: number;
    recurringDirectionsSet: number;
    planDirectionsSet: number;
  };
  applied: boolean;
};

const UNPOSTED_STATUSES: CollectedTransactionStatus[] = [
  CollectedTransactionStatus.COLLECTED,
  CollectedTransactionStatus.REVIEWED,
  CollectedTransactionStatus.READY_TO_POST
];

const EXPECTED_SIMPLE_DIRECTIONS: Partial<
  Record<PostingPolicyKey, FundingAccountDirection>
> = {
  INCOME_BASIC: FundingAccountDirection.INFLOW,
  EXPENSE_BASIC: FundingAccountDirection.OUTFLOW,
  CARD_SPEND: FundingAccountDirection.OUTFLOW
};

const COUNTERPARTY_POLICIES: PostingPolicyKey[] = [
  PostingPolicyKey.TRANSFER_BASIC,
  PostingPolicyKey.CARD_PAYMENT
];

async function inspectLedger(
  prisma: PrismaClient,
  ledgerId: string
): Promise<LedgerBackfillSummary> {
  const [subjects, accounts, categories, transactions, recurringRules, planItems] =
    await Promise.all([
      prisma.accountSubject.findMany({ where: { ledgerId } }),
      prisma.account.findMany({
        where: { ledgerId },
        include: { linkedAccountSubject: true }
      }),
      prisma.category.findMany({
        where: { ledgerId },
        include: { defaultAccountSubject: true }
      }),
      prisma.collectedTransaction.findMany({
        where: { ledgerId },
        include: { ledgerTransactionType: true, fundingAccount: true }
      }),
      prisma.recurringRule.findMany({
        where: { ledgerId },
        include: { ledgerTransactionType: true }
      }),
      prisma.planItem.findMany({
        where: { ledgerId },
        include: { ledgerTransactionType: true }
      })
    ]);

  const blockers: BackfillBlocker[] = [];
  const byCode = new Map(subjects.map((subject) => [subject.code, subject]));

  for (const expected of STANDARD_ACCOUNT_SUBJECT_CATALOG) {
    const existing = byCode.get(expected.code);
    if (!existing) continue;
    if (
      existing.name !== expected.name ||
      existing.statementType !== expected.statementType ||
      existing.normalSide !== expected.normalSide ||
      existing.subjectKind !== expected.subjectKind ||
      !existing.isSystem ||
      !existing.isActive
    ) {
      blockers.push({
        ledgerId,
        code: 'STANDARD_ACCOUNT_SUBJECT_CONFLICT',
        resourceId: existing.id,
        message: `표준 코드 ${expected.code}가 다른 속성으로 이미 사용되고 있습니다.`
      });
    }
  }

  for (const account of accounts) {
    const expectedCode =
      account.type === AccountType.CARD
        ? STANDARD_ACCOUNT_SUBJECT_CODES.CARD_PAYABLE
        : STANDARD_ACCOUNT_SUBJECT_CODES.CASH_AND_DEPOSITS;
    if (
      account.linkedAccountSubject &&
      account.linkedAccountSubject.code !== expectedCode
    ) {
      blockers.push({
        ledgerId,
        code: 'FUNDING_ACCOUNT_SUBJECT_CONFLICT',
        resourceId: account.id,
        message: `${account.name}의 연결 계정과목이 계정 유형과 일치하지 않습니다.`
      });
    }
  }

  for (const category of categories) {
    if (category.kind === CategoryKind.TRANSFER) continue;
    const mapped = category.defaultAccountSubject;
    if (
      mapped &&
      (mapped.ledgerId !== ledgerId ||
        mapped.statementType !== 'PROFIT_AND_LOSS' ||
        mapped.subjectKind !== category.kind ||
        !mapped.isSystem ||
        !mapped.isActive)
    ) {
      blockers.push({
        ledgerId,
        code: 'CATEGORY_ACCOUNT_SUBJECT_CONFLICT',
        resourceId: category.id,
        message: `${category.name}의 공식 계정과목 매핑이 카테고리 종류와 일치하지 않습니다.`
      });
    }
  }

  for (const transaction of transactions) {
    const expected =
      EXPECTED_SIMPLE_DIRECTIONS[
        transaction.ledgerTransactionType.postingPolicyKey
      ];
    if (
      expected &&
      transaction.fundingAccountDirection &&
      transaction.fundingAccountDirection !== expected
    ) {
      blockers.push({
        ledgerId,
        code: 'TRANSACTION_DIRECTION_CONFLICT',
        resourceId: transaction.id,
        message: '기존 수집 거래 방향이 거래유형의 표준 방향과 다릅니다.'
      });
    }
  }

  return {
    ledgerId,
    blockers,
    planned: {
      accountSubjectsCreated: STANDARD_ACCOUNT_SUBJECT_CATALOG.filter(
        (item) => !byCode.has(item.code)
      ).length,
      fundingAccountsLinked: accounts.filter(
        (account) => !account.linkedAccountSubjectId
      ).length,
      categoriesMapped: categories.filter(
        (category) =>
          category.kind !== CategoryKind.TRANSFER &&
          !category.defaultAccountSubjectId
      ).length,
      transactionDirectionsSet: transactions.filter((transaction) => {
        const expected =
          EXPECTED_SIMPLE_DIRECTIONS[
            transaction.ledgerTransactionType.postingPolicyKey
          ];
        return Boolean(expected && !transaction.fundingAccountDirection);
      }).length,
      cardSpendPoliciesCorrected: transactions.filter(
        (transaction) =>
          UNPOSTED_STATUSES.includes(transaction.status) &&
          transaction.ledgerTransactionType.postingPolicyKey ===
            PostingPolicyKey.EXPENSE_BASIC &&
          transaction.fundingAccount.type === AccountType.CARD
      ).length,
      incompleteTransactionsReviewed: transactions.filter(
        (transaction) =>
          transaction.status === CollectedTransactionStatus.READY_TO_POST &&
          COUNTERPARTY_POLICIES.includes(
            transaction.ledgerTransactionType.postingPolicyKey
          ) &&
          (!transaction.counterpartyFundingAccountId ||
            !transaction.fundingAccountDirection)
      ).length,
      recurringDirectionsSet: recurringRules.filter((rule) => {
        const policy = rule.ledgerTransactionType?.postingPolicyKey;
        return Boolean(
          policy && EXPECTED_SIMPLE_DIRECTIONS[policy] && !rule.fundingAccountDirection
        );
      }).length,
      planDirectionsSet: planItems.filter(
        (item) =>
          Boolean(
            EXPECTED_SIMPLE_DIRECTIONS[
              item.ledgerTransactionType.postingPolicyKey
            ]
          ) && !item.fundingAccountDirection
      ).length
    },
    applied: false
  };
}

async function applyLedgerBackfill(
  prisma: PrismaClient,
  summary: LedgerBackfillSummary
) {
  if (summary.blockers.length > 0) return summary;

  await prisma.$transaction(async (tx) => {
    const ledger = await tx.ledger.findUniqueOrThrow({
      where: { id: summary.ledgerId },
      select: { id: true, tenantId: true }
    });

    for (const subject of STANDARD_ACCOUNT_SUBJECT_CATALOG) {
      await tx.accountSubject.upsert({
        where: {
          ledgerId_code: { ledgerId: ledger.id, code: subject.code }
        },
        create: {
          tenantId: ledger.tenantId,
          ledgerId: ledger.id,
          ...subject
        },
        update: {}
      });
    }

    const subjects = await tx.accountSubject.findMany({
      where: {
        ledgerId: ledger.id,
        code: { in: STANDARD_ACCOUNT_SUBJECT_CATALOG.map((item) => item.code) }
      },
      select: { id: true, code: true }
    });
    const subjectIdByCode = new Map(
      subjects.map((subject) => [subject.code, subject.id])
    );

    const accounts = await tx.account.findMany({ where: { ledgerId: ledger.id } });
    for (const account of accounts) {
      if (account.linkedAccountSubjectId) continue;
      const code =
        account.type === AccountType.CARD
          ? STANDARD_ACCOUNT_SUBJECT_CODES.CARD_PAYABLE
          : STANDARD_ACCOUNT_SUBJECT_CODES.CASH_AND_DEPOSITS;
      await tx.account.update({
        where: { id: account.id },
        data: { linkedAccountSubjectId: requireSubjectId(subjectIdByCode, code) }
      });
    }

    const categories = await tx.category.findMany({ where: { ledgerId: ledger.id } });
    for (const category of categories) {
      if (category.kind === CategoryKind.TRANSFER) {
        if (category.defaultAccountSubjectId) {
          await tx.category.update({
            where: { id: category.id },
            data: { defaultAccountSubjectId: null }
          });
        }
        continue;
      }
      if (category.defaultAccountSubjectId) continue;
      const code = readGenericAccountSubjectCode(category.kind);
      await tx.category.update({
        where: { id: category.id },
        data: {
          defaultAccountSubjectId: requireSubjectId(subjectIdByCode, code!)
        }
      });
    }

    const transactionTypes = await tx.ledgerTransactionType.findMany({
      where: { ledgerId: ledger.id },
      select: { id: true, postingPolicyKey: true }
    });
    const typeByPolicy = new Map(
      transactionTypes.map((item) => [item.postingPolicyKey, item.id])
    );
    const transactions = await tx.collectedTransaction.findMany({
      where: { ledgerId: ledger.id },
      include: { ledgerTransactionType: true, fundingAccount: true }
    });
    for (const transaction of transactions) {
      let ledgerTransactionTypeId: string | undefined;
      let fundingAccountDirection = transaction.fundingAccountDirection;
      let status = transaction.status;

      if (
        UNPOSTED_STATUSES.includes(transaction.status) &&
        transaction.ledgerTransactionType.postingPolicyKey ===
          PostingPolicyKey.EXPENSE_BASIC &&
        transaction.fundingAccount.type === AccountType.CARD
      ) {
        ledgerTransactionTypeId = requireSubjectId(
          typeByPolicy,
          PostingPolicyKey.CARD_SPEND
        );
        fundingAccountDirection = FundingAccountDirection.OUTFLOW;
      } else {
        fundingAccountDirection ??=
          EXPECTED_SIMPLE_DIRECTIONS[
            transaction.ledgerTransactionType.postingPolicyKey
          ] ?? null;
      }

      if (
        status === CollectedTransactionStatus.READY_TO_POST &&
        COUNTERPARTY_POLICIES.includes(
          transaction.ledgerTransactionType.postingPolicyKey
        ) &&
        (!transaction.counterpartyFundingAccountId ||
          !transaction.fundingAccountDirection)
      ) {
        status = CollectedTransactionStatus.REVIEWED;
      }

      if (
        ledgerTransactionTypeId ||
        fundingAccountDirection !== transaction.fundingAccountDirection ||
        status !== transaction.status
      ) {
        await tx.collectedTransaction.update({
          where: { id: transaction.id },
          data: {
            ledgerTransactionTypeId,
            fundingAccountDirection,
            status
          }
        });
      }
    }

    const recurringRules = await tx.recurringRule.findMany({
      where: { ledgerId: ledger.id },
      include: { ledgerTransactionType: true }
    });
    for (const rule of recurringRules) {
      const policy = rule.ledgerTransactionType?.postingPolicyKey;
      const direction = policy ? EXPECTED_SIMPLE_DIRECTIONS[policy] : undefined;
      if (direction && !rule.fundingAccountDirection) {
        await tx.recurringRule.update({
          where: { id: rule.id },
          data: { fundingAccountDirection: direction }
        });
      }
    }

    const planItems = await tx.planItem.findMany({
      where: { ledgerId: ledger.id },
      include: { ledgerTransactionType: true }
    });
    for (const item of planItems) {
      const direction =
        EXPECTED_SIMPLE_DIRECTIONS[
          item.ledgerTransactionType.postingPolicyKey
        ];
      if (direction && !item.fundingAccountDirection) {
        await tx.planItem.update({
          where: { id: item.id },
          data: { fundingAccountDirection: direction }
        });
      }
    }

    await tx.workspaceAuditEvent.create({
      data: {
        tenantId: ledger.tenantId,
        ledgerId: ledger.id,
        eventCategory: 'accounting',
        eventName: 'accounting.master_data.backfill',
        action: 'backfill',
        resourceType: 'Ledger',
        resourceId: ledger.id,
        result: 'SUCCESS',
        metadata: summary.planned as unknown as Prisma.InputJsonValue
      }
    });
  });

  return { ...summary, applied: true };
}

function requireSubjectId<TKey>(map: Map<TKey, string>, key: TKey) {
  const id = map.get(key);
  if (!id) throw new Error(`필수 기준 데이터 ${String(key)}를 찾을 수 없습니다.`);
  return id;
}

function readFlagValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const apply = process.argv.includes('--apply');
    const ledgerId = readFlagValue('--ledger-id');
    const ledgers = await prisma.ledger.findMany({
      where: ledgerId ? { id: ledgerId } : undefined,
      select: { id: true },
      orderBy: { id: 'asc' }
    });
    const summaries: LedgerBackfillSummary[] = [];
    for (const ledger of ledgers) {
      const inspected = await inspectLedger(prisma, ledger.id);
      summaries.push(
        apply ? await applyLedgerBackfill(prisma, inspected) : inspected
      );
    }

    const report = {
      generatedAt: new Date().toISOString(),
      mode: apply ? 'APPLY' : 'DRY_RUN',
      ledgerId: ledgerId ?? null,
      blockerCount: summaries.reduce(
        (sum, item) => sum + item.blockers.length,
        0
      ),
      summaries
    };
    const output = `${JSON.stringify(report, null, 2)}\n`;
    const reportPath = readFlagValue('--report');
    if (reportPath) await writeFile(reportPath, output, 'utf8');
    process.stdout.write(output);
    if (report.blockerCount > 0) process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
