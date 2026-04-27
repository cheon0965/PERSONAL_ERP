import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  AuthenticatedUser,
  FinancialStatementsView,
  GenerateFinancialStatementSnapshotsRequest
} from '@personal-erp/contracts';
import { subtractMoneyWon } from '@personal-erp/money';
import { AccountingPeriodStatus } from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { assertWorkspaceActionAllowed } from '../../common/auth/workspace-action.policy';
import { fromPrismaMoneyWon } from '../../common/money/prisma-money';
import { FinancialStatementGenerationPort } from './application/ports/financial-statement-generation.port';
import { buildStatementPayloads } from './financial-statement-payload.policy';
import { FinancialStatementsService } from './financial-statements.service';

/**
 * 잠금된 운영월의 마감 데이터를 공식 재무제표 스냅샷으로 고정하는 유스케이스입니다.
 *
 * 재무제표는 사용자가 보는 리포트이면서 이후 비교/감사 기준이 되므로, 실시간 거래가 아니라
 * LOCKED 기간의 closing snapshot과 POSTED 전표만 원천으로 삼습니다.
 */
@Injectable()
export class GenerateFinancialStatementsUseCase {
  constructor(
    @Inject(FinancialStatementGenerationPort)
    private readonly financialStatementGenerationPort: FinancialStatementGenerationPort,
    private readonly financialStatementsService: FinancialStatementsService
  ) {}

  async execute(
    user: AuthenticatedUser,
    input: GenerateFinancialStatementSnapshotsRequest
  ): Promise<FinancialStatementsView> {
    const workspace = requireCurrentWorkspace(user);
    assertGeneratePermission(workspace.membershipRole);

    const generationContext =
      await this.financialStatementGenerationPort.readGenerationContext(
        workspace.tenantId,
        workspace.ledgerId,
        input.periodId
      );
    const {
      period,
      closingSnapshot,
      closingLines,
      journalLines,
      previousClosingSnapshot
    } = generationContext;

    if (!period) {
      throw new NotFoundException(
        '재무제표를 생성할 운영 기간을 찾을 수 없습니다.'
      );
    }

    if (period.status !== AccountingPeriodStatus.LOCKED) {
      throw new BadRequestException(
        '공식 재무제표는 잠금된 운영 기간에 대해서만 생성할 수 있습니다.'
      );
    }

    if (!closingSnapshot) {
      throw new BadRequestException(
        '마감 스냅샷이 없는 운영 기간에는 공식 재무제표를 생성할 수 없습니다.'
      );
    }

    // 재무제표는 마감 스냅샷과 POSTED 전표 라인을 공식 원천으로 삼는다.
    // 전월 순자산은 순자산 변동표 비교 기준으로만 사용하고 현재 월 수치는 마감 기준에서 산출한다.
    const payloads = buildStatementPayloads({
      monthLabel: `${period.year}-${String(period.month).padStart(2, '0')}`,
      closingSnapshot,
      closingLines,
      journalLines,
      openingNetWorth:
        previousClosingSnapshot == null
          ? 0
          : subtractMoneyWon(
              fromPrismaMoneyWon(previousClosingSnapshot.totalAssetAmount),
              fromPrismaMoneyWon(previousClosingSnapshot.totalLiabilityAmount)
            )
    });

    await this.financialStatementGenerationPort.upsertStatementSnapshots({
      tenantId: workspace.tenantId,
      ledgerId: workspace.ledgerId,
      periodId: period.id,
      currency: period.ledger.baseCurrency,
      payloads: [...payloads]
    });

    // 생성 직후 조회 모델을 다시 읽어 화면에서 보는 구조와 동일한 결과를 반환한다.
    // 이 경로를 유지하면 생성 API와 조회 API의 표현 차이를 줄일 수 있다.
    const view = await this.financialStatementsService.findViewInWorkspace(
      workspace.tenantId,
      workspace.ledgerId,
      period.id
    );

    if (!view) {
      throw new NotFoundException(
        '생성된 재무제표 결과를 다시 불러오지 못했습니다.'
      );
    }

    return view;
  }
}

function assertGeneratePermission(
  membershipRole: ReturnType<typeof requireCurrentWorkspace>['membershipRole']
) {
  return assertWorkspaceActionAllowed(
    membershipRole,
    'financial_statement.generate'
  );
}
