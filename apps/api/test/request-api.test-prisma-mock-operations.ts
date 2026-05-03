import type { OperationalNoteKind } from '@prisma/client';
import type { RequestPrismaMockContext } from './request-api.test-prisma-mock-shared';

export function createOperationsPrismaMock(
  context: RequestPrismaMockContext
): Record<string, unknown> {
  const { state, findAccountingPeriod } = context;

  return {
    workspaceOperationalNote: {
      count: async (args: {
        where?: {
          tenantId?: string;
          ledgerId?: string;
          periodId?: string | null;
        };
      }) => {
        return state.workspaceOperationalNotes.filter((candidate) => {
          const matchesTenant =
            !args.where?.tenantId || candidate.tenantId === args.where.tenantId;
          const matchesLedger =
            !args.where?.ledgerId || candidate.ledgerId === args.where.ledgerId;
          const matchesPeriod =
            args.where?.periodId === undefined ||
            candidate.periodId === args.where.periodId;

          return matchesTenant && matchesLedger && matchesPeriod;
        }).length;
      },
      findMany: async (args: {
        where?: {
          tenantId?: string;
          ledgerId?: string;
        };
        include?: {
          period?: {
            select?: {
              year?: boolean;
              month?: boolean;
            };
          };
        };
        orderBy?: {
          createdAt?: 'asc' | 'desc';
        };
        take?: number;
      }) => {
        const items = state.workspaceOperationalNotes
          .filter((candidate) => {
            const matchesTenant =
              !args.where?.tenantId ||
              candidate.tenantId === args.where.tenantId;
            const matchesLedger =
              !args.where?.ledgerId ||
              candidate.ledgerId === args.where.ledgerId;

            return matchesTenant && matchesLedger;
          })
          .sort((left, right) => {
            const diff = left.createdAt.getTime() - right.createdAt.getTime();
            return args.orderBy?.createdAt === 'asc' ? diff : -diff;
          });

        const limited =
          args.take === undefined ? items : items.slice(0, args.take);

        return limited.map((candidate) => ({
          ...candidate,
          ...(args.include?.period
            ? {
                period: candidate.periodId
                  ? projectPeriod(
                      findAccountingPeriod(candidate.periodId),
                      args.include.period.select
                    )
                  : null
              }
            : {})
        }));
      },
      create: async (args: {
        data: {
          tenantId: string;
          ledgerId: string;
          periodId: string | null;
          authorMembershipId: string;
          kind: OperationalNoteKind;
          title: string;
          body: string;
          relatedHref: string | null;
        };
        include?: {
          period?: {
            select?: {
              year?: boolean;
              month?: boolean;
            };
          };
        };
      }) => {
        const created = {
          id: `workspace-operational-note-${state.workspaceOperationalNotes.length + 1}`,
          tenantId: args.data.tenantId,
          ledgerId: args.data.ledgerId,
          periodId: args.data.periodId,
          authorMembershipId: args.data.authorMembershipId,
          kind: args.data.kind,
          title: args.data.title,
          body: args.data.body,
          relatedHref: args.data.relatedHref,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        state.workspaceOperationalNotes.push(created);

        return {
          ...created,
          ...(args.include?.period
            ? {
                period: created.periodId
                  ? projectPeriod(
                      findAccountingPeriod(created.periodId),
                      args.include.period.select
                    )
                  : null
              }
            : {})
        };
      }
    }
  };
}

function projectPeriod(
  period: {
    year: number;
    month: number;
  } | null,
  select:
    | {
        year?: boolean;
        month?: boolean;
      }
    | undefined
) {
  if (!period) {
    return null;
  }

  return {
    ...(select?.year ? { year: period.year } : {}),
    ...(select?.month ? { month: period.month } : {})
  };
}
