import type { RequestPrismaMockContext } from './request-api.test-prisma-mock-shared';

export function createLedgerTransactionTypesPrismaMock(
  context: RequestPrismaMockContext
): Record<string, unknown> {
  const { state } = context;

  return {
    ledgerTransactionType: {
      upsert: async (args: {
        where: { ledgerId_code: { ledgerId: string; code: string } };
        update: {
          name: string;
          flowKind:
            | 'INCOME'
            | 'EXPENSE'
            | 'TRANSFER'
            | 'ADJUSTMENT'
            | 'OPENING_BALANCE'
            | 'CARRY_FORWARD';
          postingPolicyKey:
            | 'INCOME_BASIC'
            | 'EXPENSE_BASIC'
            | 'TRANSFER_BASIC'
            | 'CARD_SPEND'
            | 'CARD_PAYMENT'
            | 'OPENING_BALANCE'
            | 'CARRY_FORWARD'
            | 'MANUAL_ADJUSTMENT';
          isActive: boolean;
          sortOrder: number;
        };
        create: {
          tenantId: string;
          ledgerId: string;
          code: string;
          name: string;
          flowKind:
            | 'INCOME'
            | 'EXPENSE'
            | 'TRANSFER'
            | 'ADJUSTMENT'
            | 'OPENING_BALANCE'
            | 'CARRY_FORWARD';
          postingPolicyKey:
            | 'INCOME_BASIC'
            | 'EXPENSE_BASIC'
            | 'TRANSFER_BASIC'
            | 'CARD_SPEND'
            | 'CARD_PAYMENT'
            | 'OPENING_BALANCE'
            | 'CARRY_FORWARD'
            | 'MANUAL_ADJUSTMENT';
          isActive: boolean;
          sortOrder: number;
        };
      }) => {
        const existing = state.ledgerTransactionTypes.find(
          (candidate) =>
            candidate.ledgerId === args.where.ledgerId_code.ledgerId &&
            candidate.code === args.where.ledgerId_code.code
        );

        if (existing) {
          Object.assign(existing, args.update);
          return existing;
        }

        const created = {
          id: `ledger-transaction-type-${state.ledgerTransactionTypes.length + 1}`,
          ...args.create
        };
        state.ledgerTransactionTypes.push(created);
        return created;
      },
      findFirst: async (args: {
        where: {
          tenantId?: string;
          ledgerId?: string;
          code?: string;
          isActive?: boolean;
        };
        select?: {
          id?: boolean;
        };
      }) => {
        const item =
          state.ledgerTransactionTypes.find((candidate) => {
            const matchesTenant =
              !args.where.tenantId ||
              candidate.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where.ledgerId ||
              candidate.ledgerId === args.where.ledgerId;
            const matchesCode =
              !args.where.code || candidate.code === args.where.code;
            const matchesActive =
              args.where.isActive === undefined ||
              candidate.isActive === args.where.isActive;

            return (
              matchesTenant && matchesLedger && matchesCode && matchesActive
            );
          }) ?? null;

        if (!item) {
          return null;
        }

        if (args.select?.id) {
          return {
            id: item.id
          };
        }

        return item;
      },
      findMany: async (args: {
        where?: {
          tenantId?: string;
          ledgerId?: string;
          isActive?: boolean;
        };
      }) => {
        return state.ledgerTransactionTypes.filter((candidate) => {
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;
          const matchesActive =
            args.where?.isActive === undefined ||
            candidate.isActive === args.where.isActive;

          return matchesTenant && matchesLedger && matchesActive;
        });
      }
    }
  };
}
