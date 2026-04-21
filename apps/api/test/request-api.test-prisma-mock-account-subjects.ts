import type { RequestPrismaMockContext } from './request-api.test-prisma-mock-shared';

export function createAccountSubjectsPrismaMock(
  context: RequestPrismaMockContext
): Record<string, unknown> {
  const { state } = context;

  return {
    accountSubject: {
      upsert: async (args: {
        where: { ledgerId_code: { ledgerId: string; code: string } };
        update: {
          name: string;
          statementType: 'BALANCE_SHEET' | 'PROFIT_AND_LOSS';
          normalSide: 'DEBIT' | 'CREDIT';
          subjectKind: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
          isSystem: boolean;
          isActive: boolean;
          sortOrder: number;
        };
        create: {
          tenantId: string;
          ledgerId: string;
          code: string;
          name: string;
          statementType: 'BALANCE_SHEET' | 'PROFIT_AND_LOSS';
          normalSide: 'DEBIT' | 'CREDIT';
          subjectKind: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
          isSystem: boolean;
          isActive: boolean;
          sortOrder: number;
        };
      }) => {
        const existing = state.accountSubjects.find(
          (candidate) =>
            candidate.ledgerId === args.where.ledgerId_code.ledgerId &&
            candidate.code === args.where.ledgerId_code.code
        );

        if (existing) {
          Object.assign(existing, args.update);
          return existing;
        }

        const created = {
          id: `account-subject-${state.accountSubjects.length + 1}`,
          ...args.create
        };
        state.accountSubjects.push(created);
        return created;
      },
      findMany: async (args: {
        where?: {
          tenantId?: string;
          ledgerId?: string;
          code?: { in?: string[] };
          isActive?: boolean;
        };
        select?: {
          id?: boolean;
          code?: boolean;
          subjectKind?: boolean;
        };
      }) => {
        const items = state.accountSubjects.filter((candidate) => {
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;
          const matchesCode =
            !args.where?.code?.in ||
            args.where.code.in.includes(candidate.code);
          const matchesActive =
            args.where?.isActive === undefined ||
            candidate.isActive === args.where.isActive;

          return matchesTenant && matchesLedger && matchesCode && matchesActive;
        });

        if (!args.select) {
          return items;
        }

        return items.map((candidate) => ({
          ...(args.select?.id ? { id: candidate.id } : {}),
          ...(args.select?.code ? { code: candidate.code } : {}),
          ...(args.select?.subjectKind
            ? { subjectKind: candidate.subjectKind }
            : {})
        }));
      }
    }
  };
}
