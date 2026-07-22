import { ApplicationService } from '../../../../common/application/application-service.decorator';
import {
  conflictError,
  notFoundError,
  validationError
} from '../../../../common/application/errors/app-error';
import type {
  AuthenticatedUser,
  CarryForwardView,
  GenerateCarryForwardRequest
} from '@personal-erp/contracts';
import { addMoneyWon } from '@personal-erp/money';
import { requireCurrentWorkspace } from '../../../../common/auth/required-workspace.util';
import {
  readWorkspaceActorRef,
  readWorkspaceCreatedByActorRef
} from '../../../../common/auth/workspace-actor-ref.util';
import { assertWorkspaceActionAllowed } from '../../../../common/auth/workspace-action.policy';
import { CarryForwardGenerationPort } from '../ports/carry-forward-generation.port';
import { CarryForwardViewPort } from '../ports/carry-forward-view.port';
import {
  isCarryForwardAccount,
  readNextMonth,
  readPeriodBoundary
} from '../../domain/carry-forward.policy';
import {
  buildCarryForwardReplaceReason,
  CancelCarryForwardUseCase
} from './cancel-carry-forward.use-case';
import {
  assertAccountingEquationBalanced,
  assertClosingSnapshotIntegrity,
  summarizeAccountingEquationLines
} from '../../../accounting-periods/public';

/**
 * 잠금 완료된 운영월의 마감 잔액을 다음 운영월의 기초 잔액으로 넘기는 유스케이스입니다.
 *
 * 이 흐름은 월마감과 다음 월 오픈을 잇는 회계 체인의 연결부입니다. 사용자가 대상 월을 임의로 고르지
 * 못하게 하고, 이미 잠겼거나 오프닝 스냅샷이 있는 다음 월은 보호해 과거 기준이 뒤늦게 바뀌지 않도록 합니다.
 */
@ApplicationService()
export class GenerateCarryForwardUseCase {
  constructor(
    private readonly carryForwardGenerationPort: CarryForwardGenerationPort,
    private readonly carryForwardViewPort: CarryForwardViewPort,
    private readonly cancelCarryForwardUseCase: CancelCarryForwardUseCase
  ) {}

  async execute(
    user: AuthenticatedUser,
    input: GenerateCarryForwardRequest
  ): Promise<CarryForwardView> {
    const workspace = requireCurrentWorkspace(user);
    const actorRef = readWorkspaceActorRef(workspace);
    const createdByActorRef = readWorkspaceCreatedByActorRef(workspace);
    assertGeneratePermission(workspace.membershipRole);

    const sourcePeriod =
      await this.carryForwardViewPort.findPeriodByIdInWorkspace(
        workspace.tenantId,
        workspace.ledgerId,
        input.fromPeriodId
      );

    if (!sourcePeriod) {
      throw notFoundError('이월 기준이 되는 운영 기간을 찾을 수 없습니다.');
    }

    if (sourcePeriod.status !== 'LOCKED') {
      throw validationError(
        '차기 이월은 잠금된 운영 기간에 대해서만 생성할 수 있습니다.'
      );
    }

    // 이월 대상 월은 원천 기간의 바로 다음 달로 고정한다.
    // 사용자가 임의 월을 지정하지 못하게 하여 월별 운영 체인의 순서를 보장한다.
    const {
      year: nextYear,
      month: nextMonth,
      monthLabel
    } = readNextMonth(sourcePeriod.year, sourcePeriod.month);

    // 이월 가능 여부는 원천 마감 스냅샷과 다음 월 상태를 함께 봐야 판단할 수 있다.
    // 포트에서 한 번에 읽어 정책 판단이 유스케이스 안에 모이도록 한다.
    let generationContext =
      await this.carryForwardGenerationPort.readGenerationContext(
        workspace.tenantId,
        workspace.ledgerId,
        sourcePeriod.id,
        nextYear,
        nextMonth
      );
    let sourceClosingSnapshot = generationContext.sourceClosingSnapshot;
    let existingRecord = generationContext.existingRecord;
    let existingTargetPeriod = generationContext.existingTargetPeriod;

    if (!sourceClosingSnapshot) {
      throw validationError(
        '마감 스냅샷이 없는 기간에는 차기 이월을 생성할 수 없습니다.'
      );
    }

    assertClosingSnapshotIntegrity({
      snapshot: sourceClosingSnapshot,
      lines: sourceClosingSnapshot.lines.map((line) => ({
        accountSubjectKind: line.accountSubject.subjectKind,
        balanceAmount: line.balanceAmount
      }))
    });

    if (existingRecord && !input.replaceExisting) {
      throw conflictError('해당 운영 기간의 차기 이월이 이미 생성되었습니다.');
    }

    // `replaceExisting`은 기존 이월을 먼저 취소한 뒤 새 이월을 만드는 경로다.
    // 같은 기간에 두 개의 활성 이월 기준이 공존하지 않도록 취소 후 컨텍스트를 다시 읽는다.
    if (existingRecord && input.replaceExisting) {
      await this.cancelCarryForwardUseCase.cancelExistingByFromPeriod(
        user,
        sourcePeriod.id,
        input.replaceReason ??
          buildCarryForwardReplaceReason(sourcePeriod.year, sourcePeriod.month)
      );

      generationContext =
        await this.carryForwardGenerationPort.readGenerationContext(
          workspace.tenantId,
          workspace.ledgerId,
          sourcePeriod.id,
          nextYear,
          nextMonth
        );
      sourceClosingSnapshot = generationContext.sourceClosingSnapshot;
      existingRecord = generationContext.existingRecord;
      existingTargetPeriod = generationContext.existingTargetPeriod;

      if (!sourceClosingSnapshot) {
        throw validationError(
          '마감 스냅샷이 없는 기간에는 차기 이월을 생성할 수 없습니다.'
        );
      }

      if (existingRecord) {
        throw conflictError(
          '기존 차기 이월 취소 이후에도 차기 이월 기록이 남아 있습니다.'
        );
      }
    }

    // 다음 월이 이미 잠겼거나 오프닝 스냅샷을 갖고 있으면 이월 기준을 덮어쓸 수 없다.
    // 이월은 다음 월 운영 시작 전 기준을 세우는 작업으로만 허용한다.
    if (existingTargetPeriod && existingTargetPeriod.status !== 'OPEN') {
      throw conflictError(
        'OPEN 상태가 아닌 다음 운영 기간에는 차기 이월을 생성할 수 없습니다.'
      );
    }

    if (existingTargetPeriod?.openingBalanceSnapshot) {
      throw conflictError(
        `${monthLabel} 운영 기간에는 이미 오프닝 밸런스 스냅샷이 존재합니다.`
      );
    }

    if (generationContext.targetOperationalUsageCount > 0) {
      throw conflictError(
        '다음 운영 기간에 거래, 업로드, 전표 또는 마감 산출물이 있어 차기 이월을 생성할 수 없습니다.'
      );
    }

    // 손익 계정은 다음 달 기초 잔액으로 넘어가지 않는다.
    // 자산/부채/자본 계정만 이월해 다음 월 opening balance snapshot을 구성한다.
    const carryableLines = sourceClosingSnapshot.lines.flatMap((line) => {
      const accountSubjectKind = line.accountSubject.subjectKind;
      return isCarryForwardAccount(accountSubjectKind)
        ? [
            {
              accountSubjectId: line.accountSubjectId,
              accountSubjectCode: line.accountSubject.code,
              accountSubjectKind,
              fundingAccountId: line.fundingAccountId,
              balanceAmount: line.balanceAmount
            }
          ]
        : [];
    });

    const periodPnLAmount = sourceClosingSnapshot.periodPnLAmount;
    if (periodPnLAmount !== 0) {
      const netAssetsLineIndex = carryableLines.findIndex(
        (line) =>
          line.accountSubjectCode === '3100' &&
          line.accountSubjectKind === 'EQUITY' &&
          line.fundingAccountId === null
      );

      if (netAssetsLineIndex >= 0) {
        const existingLine = carryableLines[netAssetsLineIndex]!;
        const adjustedAmount = addMoneyWon(
          existingLine.balanceAmount,
          periodPnLAmount
        );
        if (adjustedAmount === 0) {
          carryableLines.splice(netAssetsLineIndex, 1);
        } else {
          carryableLines[netAssetsLineIndex] = {
            ...existingLine,
            balanceAmount: adjustedAmount
          };
        }
      } else {
        if (!generationContext.netAssetsAccountSubject) {
          throw validationError(
            '당기손익 이월에 필요한 3100 순자산 계정과목을 찾을 수 없습니다.'
          );
        }

        carryableLines.push({
          accountSubjectId: generationContext.netAssetsAccountSubject.id,
          accountSubjectCode: '3100',
          accountSubjectKind: 'EQUITY',
          fundingAccountId: null,
          balanceAmount: periodPnLAmount
        });
      }
    }

    assertAccountingEquationBalanced(
      summarizeAccountingEquationLines(
        carryableLines.map((line) => ({
          accountSubjectKind: line.accountSubjectKind,
          balanceAmount: line.balanceAmount
        }))
      ),
      '차기 이월 기초 잔액의 회계등식이 성립하지 않습니다.'
    );

    const nextPeriodBoundary = readPeriodBoundary(nextYear, nextMonth);

    await this.carryForwardGenerationPort.createCarryForward({
      tenantId: workspace.tenantId,
      ledgerId: workspace.ledgerId,
      sourcePeriod: {
        id: sourcePeriod.id,
        year: sourcePeriod.year,
        month: sourcePeriod.month
      },
      nextYear,
      nextMonth,
      nextPeriodBoundary,
      existingTargetPeriod,
      carryableLines: carryableLines.map((line) => ({
        accountSubjectId: line.accountSubjectId,
        fundingAccountId: line.fundingAccountId,
        balanceAmount: line.balanceAmount
      })),
      sourceClosingSnapshotId: sourceClosingSnapshot.id,
      equityAdjustmentKind: 'PERIOD_PNL_ROLLOVER',
      equityAdjustmentAmount: periodPnLAmount,
      actorRef,
      createdByActorRef
    });

    const view = await this.carryForwardViewPort.findViewInWorkspace(
      workspace.tenantId,
      workspace.ledgerId,
      sourcePeriod.id
    );

    if (!view) {
      throw notFoundError('차기 이월 생성 결과를 다시 불러오지 못했습니다.');
    }

    return view;
  }
}

function assertGeneratePermission(
  membershipRole: ReturnType<typeof requireCurrentWorkspace>['membershipRole']
) {
  return assertWorkspaceActionAllowed(membershipRole, 'carry_forward.generate');
}
