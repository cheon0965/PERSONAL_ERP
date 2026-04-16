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
