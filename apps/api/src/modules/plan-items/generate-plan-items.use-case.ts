import {
  BadRequestException,
  Inject,
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
import { fromPrismaMoneyWon } from '../../common/money/prisma-money';
import {
  buildPlannedDates,
  resolveLedgerTransactionTypeId
} from './plan-item-generation.policy';
import { PlanItemGenerationPort } from './application/ports/plan-item-generation.port';
import { PlanItemsService } from './plan-items.service';

@Injectable()
export class GeneratePlanItemsUseCase {
  constructor(
    @Inject(PlanItemGenerationPort)
    private readonly planItemGenerationPort: PlanItemGenerationPort,
    private readonly planItemsService: PlanItemsService
  ) {}

  async execute(
    user: AuthenticatedUser,
    input: GeneratePlanItemsRequest
  ): Promise<GeneratePlanItemsResponse> {
    const workspace = requireCurrentWorkspace(user);
    assertGeneratePermission(workspace.membershipRole);

    const period = await this.planItemGenerationPort.findPeriodByIdInWorkspace(
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

    const latestCollectingPeriod =
      await this.planItemGenerationPort.findLatestCollectingPeriodInWorkspace(
        workspace.tenantId,
        workspace.ledgerId
      );

    if (!latestCollectingPeriod || latestCollectingPeriod.id !== period.id) {
      throw new BadRequestException(
        `계획 항목은 최신 진행월에서만 생성할 수 있습니다. 현재 선택월은 ${formatYearMonth(period.year, period.month)}이고, 최신 진행월은 ${latestCollectingPeriod ? formatYearMonth(latestCollectingPeriod.year, latestCollectingPeriod.month) : '없음'}입니다.`
      );
    }

    const [recurringRules, existingItems, transactionTypes] = await Promise.all(
      [
        this.planItemGenerationPort.listRecurringRulesForPeriod(
          workspace.tenantId,
          workspace.ledgerId,
          period.startDate,
          period.endDate
        ),
        this.planItemGenerationPort.listExistingItemsForPeriod(
          workspace.tenantId,
          workspace.ledgerId,
          period.id
        ),
        this.planItemGenerationPort.listActiveTransactionTypes(
          workspace.tenantId,
          workspace.ledgerId
        )
      ]
    );

    const defaultTypeIdByFlow = new Map<LedgerTransactionFlowKind, string>();
    const flowKindByTransactionTypeId = new Map<
      string,
      LedgerTransactionFlowKind
    >();
    for (const transactionType of transactionTypes) {
      if (!defaultTypeIdByFlow.has(transactionType.flowKind)) {
        defaultTypeIdByFlow.set(transactionType.flowKind, transactionType.id);
      }
      flowKindByTransactionTypeId.set(
        transactionType.id,
        transactionType.flowKind
      );
    }

    const existingKeys = new Set(
      existingItems
        .filter((item) => item.recurringRuleId)
        .map(
          (item) =>
            `${item.recurringRuleId}:${item.plannedDate.toISOString().slice(0, 10)}`
        )
    );

    const createData: Array<{
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
      matchedCollectedTransactionStatus: 'READY_TO_POST' | 'REVIEWED';
    }> = [];
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

      const flowKind = flowKindByTransactionTypeId.get(ledgerTransactionTypeId);
      if (!flowKind) {
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
          plannedAmount: fromPrismaMoneyWon(rule.amountWon),
          plannedDate,
          matchedCollectedTransactionStatus:
            resolveAutoCollectedTransactionStatus({
              flowKind,
              categoryId: rule.categoryId ?? undefined
            })
        });
      }
    }

    const creationResult =
      await this.planItemGenerationPort.createGeneratedPlanItems(createData);
    const createdCount = creationResult.createdCount;
    skippedExistingCount += creationResult.skippedExistingCount;

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
        createdCount,
        skippedExistingCount,
        excludedRuleCount
      }
    };
  }
}

function formatYearMonth(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function assertGeneratePermission(
  membershipRole: ReturnType<typeof requireCurrentWorkspace>['membershipRole']
) {
  return assertWorkspaceActionAllowed(membershipRole, 'plan_item.generate');
}

function resolveAutoCollectedTransactionStatus(input: {
  flowKind: LedgerTransactionFlowKind;
  categoryId?: string;
}) {
  if (
    input.flowKind === LedgerTransactionFlowKind.TRANSFER ||
    input.flowKind === LedgerTransactionFlowKind.OPENING_BALANCE ||
    input.flowKind === LedgerTransactionFlowKind.CARRY_FORWARD
  ) {
    return 'READY_TO_POST' as const;
  }

  return input.categoryId?.trim()
    ? ('READY_TO_POST' as const)
    : ('REVIEWED' as const);
}
