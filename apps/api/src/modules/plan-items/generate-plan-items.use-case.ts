import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  AuthenticatedUser,
  GeneratePlanItemsRequest,
  GeneratePlanItemsResponse
} from '@personal-erp/contracts';
import {
  AccountingPeriodStatus,
  LedgerTransactionFlowKind
} from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { assertWorkspaceActionAllowed } from '../../common/auth/workspace-action.policy';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  buildPlannedDates,
  resolveLedgerTransactionTypeId
} from './plan-item-generation.policy';
import { PlanItemsService } from './plan-items.service';

type PlanItemCreateDraft = {
  tenantId: string;
  ledgerId: string;
  periodId: string;
  recurringRuleId: string;
  ledgerTransactionTypeId: string;
  fundingAccountId: string;
  categoryId?: string;
  title: string;
  plannedAmount: number;
  plannedDate: Date;
};

@Injectable()
export class GeneratePlanItemsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planItemsService: PlanItemsService
  ) {}

  async execute(
    user: AuthenticatedUser,
    input: GeneratePlanItemsRequest
  ): Promise<GeneratePlanItemsResponse> {
    const workspace = requireCurrentWorkspace(user);
    assertGeneratePermission(workspace.membershipRole);

    const period = await this.planItemsService.findPeriodByIdInWorkspace(
      workspace.tenantId,
      workspace.ledgerId,
      input.periodId
    );

    if (!period) {
      throw new NotFoundException(
        '계획 항목을 생성할 운영 기간을 찾을 수 없습니다.'
      );
    }

    if (period.status === AccountingPeriodStatus.LOCKED) {
      throw new BadRequestException(
        '잠금된 운영 기간에는 새로운 계획 항목을 생성할 수 없습니다.'
      );
    }

    const [recurringRules, existingItems, transactionTypes] = await Promise.all(
      [
        this.prisma.recurringRule.findMany({
          where: {
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId,
            isActive: true,
            startDate: {
              lt: period.endDate
            },
            OR: [{ endDate: null }, { endDate: { gte: period.startDate } }]
          },
          include: {
            account: {
              select: {
                id: true,
                name: true
              }
            },
            category: {
              select: {
                id: true,
                name: true,
                kind: true
              }
            },
            ledgerTransactionType: {
              select: {
                id: true,
                flowKind: true,
                isActive: true
              }
            }
          },
          orderBy: [{ nextRunDate: 'asc' }, { createdAt: 'asc' }]
        }),
        this.prisma.planItem.findMany({
          where: {
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId,
            periodId: period.id
          },
          select: {
            recurringRuleId: true,
            plannedDate: true
          }
        }),
        this.prisma.ledgerTransactionType.findMany({
          where: {
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId,
            isActive: true
          },
          select: {
            id: true,
            flowKind: true
          },
          orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }]
        })
      ]
    );

    const defaultTypeIdByFlow = new Map<LedgerTransactionFlowKind, string>();
    for (const transactionType of transactionTypes) {
      if (!defaultTypeIdByFlow.has(transactionType.flowKind)) {
        defaultTypeIdByFlow.set(transactionType.flowKind, transactionType.id);
      }
    }

    const existingKeys = new Set(
      existingItems
        .filter((item) => item.recurringRuleId)
        .map(
          (item) =>
            `${item.recurringRuleId}:${item.plannedDate.toISOString().slice(0, 10)}`
        )
    );

    const createData: PlanItemCreateDraft[] = [];
    let skippedExistingCount = 0;
    let excludedRuleCount = 0;

    for (const rule of recurringRules) {
      const plannedDates = buildPlannedDates(
        rule,
        period.startDate,
        period.endDate
      );
      if (plannedDates.length === 0) {
        continue;
      }

      const ledgerTransactionTypeId = resolveLedgerTransactionTypeId(
        rule.ledgerTransactionType,
        rule.category?.kind ?? null,
        defaultTypeIdByFlow
      );

      if (!ledgerTransactionTypeId) {
        excludedRuleCount += 1;
        continue;
      }

      for (const plannedDate of plannedDates) {
        const duplicateKey = `${rule.id}:${plannedDate.toISOString().slice(0, 10)}`;
        if (existingKeys.has(duplicateKey)) {
          skippedExistingCount += 1;
          continue;
        }

        existingKeys.add(duplicateKey);
        createData.push({
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          periodId: period.id,
          recurringRuleId: rule.id,
          ledgerTransactionTypeId,
          fundingAccountId: rule.accountId,
          categoryId: rule.categoryId ?? undefined,
          title: rule.title,
          plannedAmount: rule.amountWon,
          plannedDate
        });
      }
    }

    if (createData.length > 0) {
      await this.prisma.planItem.createMany({
        data: createData
      });
    }

    const view = await this.planItemsService.findViewInWorkspace(
      workspace.tenantId,
      workspace.ledgerId,
      period.id
    );

    if (!view) {
      throw new NotFoundException(
        '생성된 계획 항목 결과를 다시 불러오지 못했습니다.'
      );
    }

    return {
      ...view,
      generation: {
        createdCount: createData.length,
        skippedExistingCount,
        excludedRuleCount
      }
    };
  }
}

function assertGeneratePermission(
  membershipRole: ReturnType<typeof requireCurrentWorkspace>['membershipRole']
) {
  return assertWorkspaceActionAllowed(membershipRole, 'plan_item.generate');

}
