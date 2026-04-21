import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  AuthenticatedUser,
  CarryForwardView,
  GenerateCarryForwardRequest
} from '@personal-erp/contracts';
import { AccountingPeriodStatus } from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import {
  readWorkspaceActorRef,
  readWorkspaceCreatedByActorRef
} from '../../common/auth/workspace-actor-ref.util';
import { assertWorkspaceActionAllowed } from '../../common/auth/workspace-action.policy';
import { CarryForwardGenerationPort } from './application/ports/carry-forward-generation.port';
import {
  isCarryForwardAccount,
  readNextMonth,
  readPeriodBoundary
} from './carry-forward.policy';
import { CarryForwardsService } from './carry-forwards.service';
import {
  buildCarryForwardReplaceReason,
  CancelCarryForwardUseCase
} from './cancel-carry-forward.use-case';

@Injectable()
export class GenerateCarryForwardUseCase {
  constructor(
    @Inject(CarryForwardGenerationPort)
    private readonly carryForwardGenerationPort: CarryForwardGenerationPort,
    private readonly carryForwardsService: CarryForwardsService,
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
      await this.carryForwardsService.findPeriodByIdInWorkspace(
        workspace.tenantId,
        workspace.ledgerId,
        input.fromPeriodId
      );

    if (!sourcePeriod) {
      throw new NotFoundException(
        '이월 기준이 되는 운영 기간을 찾을 수 없습니다.'
      );
    }

    if (sourcePeriod.status !== AccountingPeriodStatus.LOCKED) {
      throw new BadRequestException(
        '차기 이월은 잠금된 운영 기간에 대해서만 생성할 수 있습니다.'
      );
    }

    const {
      year: nextYear,
      month: nextMonth,
      monthLabel
    } = readNextMonth(sourcePeriod.year, sourcePeriod.month);

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
      throw new BadRequestException(
        '마감 스냅샷이 없는 기간에는 차기 이월을 생성할 수 없습니다.'
      );
    }

    if (existingRecord && !input.replaceExisting) {
      throw new ConflictException(
        '해당 운영 기간의 차기 이월이 이미 생성되었습니다.'
      );
    }

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
        throw new BadRequestException(
          '마감 스냅샷이 없는 기간에는 차기 이월을 생성할 수 없습니다.'
        );
      }

      if (existingRecord) {
        throw new ConflictException(
          '기존 차기 이월 취소 이후에도 차기 이월 기록이 남아 있습니다.'
        );
      }
    }

    if (existingTargetPeriod?.status === AccountingPeriodStatus.LOCKED) {
      throw new ConflictException(
        '이미 잠금된 다음 운영 기간에는 차기 이월을 생성할 수 없습니다.'
      );
    }

    if (existingTargetPeriod?.openingBalanceSnapshot) {
      throw new ConflictException(
        `${monthLabel} 운영 기간에는 이미 오프닝 밸런스 스냅샷이 존재합니다.`
      );
    }

    const carryableLines = sourceClosingSnapshot.lines
      .filter((line) => isCarryForwardAccount(line.accountSubject.subjectKind))
      .map((line) => ({
        accountSubjectId: line.accountSubjectId,
        fundingAccountId: line.fundingAccountId,
        balanceAmount: line.balanceAmount
      }));

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
      carryableLines,
      sourceClosingSnapshotId: sourceClosingSnapshot.id,
      actorRef,
      createdByActorRef
    });

    const view = await this.carryForwardsService.findViewInWorkspace(
      workspace.tenantId,
      workspace.ledgerId,
      sourcePeriod.id
    );

    if (!view) {
      throw new NotFoundException(
        '차기 이월 생성 결과를 다시 불러오지 못했습니다.'
      );
    }

    return view;
  }
}

function assertGeneratePermission(
  membershipRole: ReturnType<typeof requireCurrentWorkspace>['membershipRole']
) {
  return assertWorkspaceActionAllowed(membershipRole, 'carry_forward.generate');
}
