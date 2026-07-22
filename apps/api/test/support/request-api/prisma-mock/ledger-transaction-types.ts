import type { RequestPrismaMockContext } from './shared';

type PostingPolicyKey =
  | 'INCOME_BASIC'
  | 'EXPENSE_BASIC'
  | 'TRANSFER_BASIC'
  | 'CARD_SPEND'
  | 'CARD_PAYMENT'
  | 'OPENING_BALANCE'
  | 'CARRY_FORWARD'
  | 'MANUAL_ADJUSTMENT';

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
          postingPolicyKey: PostingPolicyKey;
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
          postingPolicyKey: PostingPolicyKey;
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
          id?: string;
          tenantId?: string;
          ledgerId?: string;
          code?: string;
          postingPolicyKey?: PostingPolicyKey;
          isActive?: boolean;
        };
        select?: {
          id?: boolean;
          postingPolicyKey?: boolean;
        };
      }) => {
        const item =
          state.ledgerTransactionTypes.find((candidate) => {
            const matchesId = !args.where.id || candidate.id === args.where.id;
            const matchesTenant =
              !args.where.tenantId ||
              candidate.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where.ledgerId ||
              candidate.ledgerId === args.where.ledgerId;
            const matchesCode =
              !args.where.code || candidate.code === args.where.code;
            const matchesPostingPolicy =
              !args.where.postingPolicyKey ||
              candidate.postingPolicyKey === args.where.postingPolicyKey;
            const matchesActive =
              args.where.isActive === undefined ||
              candidate.isActive === args.where.isActive;

            return (
              matchesId &&
              matchesTenant &&
              matchesLedger &&
              matchesCode &&
              matchesPostingPolicy &&
              matchesActive
            );
          }) ?? null;

        if (!item) {
          return null;
        }

        if (args.select) {
          return {
            ...(args.select.id ? { id: item.id } : {}),
            ...(args.select.postingPolicyKey
              ? { postingPolicyKey: item.postingPolicyKey }
              : {})
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
