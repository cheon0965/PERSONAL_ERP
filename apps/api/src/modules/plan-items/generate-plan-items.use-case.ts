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

/**
 * 반복 규칙과 부채 상환 일정을 최신 진행월의 계획 항목으로 펼치는 유스케이스입니다.
 *
 * 계획 항목은 실제 거래가 들어오기 전의 운영 예상치이며, 이후 수집 거래와 매칭되어 전표 확정까지 이어집니다.
 * 그래서 이 파일은 같은 월 중복 생성 방지, 기본 거래유형 선택, 계획 기반 수집 거래의 초기 상태 결정을 함께 다룹니다.
 */
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

    // 계획 생성은 반복 규칙, 기존 계획, 거래유형, 부채 상환 일정을 한 번에 읽어
    // 같은 기간 안에서 중복 없이 계획 항목과 연결 수집 거래를 만들 준비를 한다.
    const [
      recurringRules,
      existingItems,
      transactionTypes,
      liabilityRepaymentSchedules
    ] = await Promise.all([
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
      ),
      this.planItemGenerationPort.listLiabilityRepaymentSchedulesForPeriod(
        workspace.tenantId,
        workspace.ledgerId,
        period.startDate,
        period.endDate
      )
    ]);

    // 기본 거래유형은 flowKind별 첫 번째 활성 항목을 사용한다.
    // 반복 규칙이 명시 거래유형을 갖지 않은 경우 카테고리 성격으로 수입/지출 기본값을 찾는다.
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

    // 반복 규칙은 "규칙 ID + 예정일"을 중복 키로 삼는다.
    // 같은 달에 생성 버튼을 여러 번 눌러도 같은 예정 거래가 중복 생성되지 않게 한다.
    const createData: Array<{
      tenantId: string;
      ledgerId: string;
      periodId: string;
      recurringRuleId?: string | null;
      liabilityRepaymentScheduleId?: string | null;
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

    const liabilityExpenseTypeId = defaultTypeIdByFlow.get(
      LedgerTransactionFlowKind.EXPENSE
    );
    // 부채 상환 일정은 반복 규칙과 별개의 원천이다.
    // 상환 확정 시 원금/이자 분개가 필요하므로 계획 단계에서 상환 schedule ID를 함께 남긴다.
    for (const repaymentSchedule of liabilityRepaymentSchedules) {
      if (!liabilityExpenseTypeId) {
        excludedRuleCount += 1;
        continue;
      }

      createData.push({
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        periodId: period.id,
        recurringRuleId: null,
        liabilityRepaymentScheduleId: repaymentSchedule.id,
        ledgerTransactionTypeId: liabilityExpenseTypeId,
        fundingAccountId: repaymentSchedule.agreement.defaultFundingAccountId,
        categoryId:
          repaymentSchedule.agreement.interestExpenseCategoryId ??
          repaymentSchedule.agreement.feeExpenseCategoryId ??
          undefined,
        title: [
          repaymentSchedule.agreement.lenderName,
          repaymentSchedule.agreement.productName,
          '상환'
        ]
          .filter(Boolean)
          .join(' '),
        plannedAmount: fromPrismaMoneyWon(repaymentSchedule.totalAmount),
        plannedDate: repaymentSchedule.dueDate,
        matchedCollectedTransactionStatus: 'READY_TO_POST'
      });
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
  // 전표 확정에 필요한 기준이 이미 충분하면 바로 READY_TO_POST로 보낸다.
  // 카테고리가 필요한 수입/지출인데 비어 있으면 사용자가 검토할 수 있도록 REVIEWED에 둔다.
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
