import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException
} from '@nestjs/common';
import { addMoneyWon } from '@personal-erp/money';
import type {
  AuthenticatedUser,
  CreateLiabilityAgreementRequest,
  CreateLiabilityRepaymentScheduleRequest,
  GenerateLiabilityPlanItemResponse,
  LiabilityAgreementItem,
  LiabilityOverviewResponse,
  LiabilityRepaymentScheduleItem,
  UpdateLiabilityAgreementRequest,
  UpdateLiabilityRepaymentScheduleRequest
} from '@personal-erp/contracts';
import {
  AccountSubjectKind,
  CategoryKind,
  CollectedTransactionStatus,
  LedgerTransactionFlowKind,
  LiabilityAgreementStatus,
  LiabilityRepaymentScheduleStatus,
  PlanItemStatus,
  Prisma
} from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import {
  requireNonNegativeMoneyWon,
  requirePositiveMoneyWon
} from '../../common/money/money-won';
import { fromPrismaMoneyWon } from '../../common/money/prisma-money';
import { PrismaService } from '../../common/prisma/prisma.service';
import { normalizeCaseInsensitiveText } from '../../common/utils/normalize-unique-key.util';
import {
  AccountingPeriodWriteGuardPort,
  readCollectingAccountingPeriodStatuses
} from '../accounting-periods/public';
import {
  buildLiabilityAgreementTitle,
  mapLiabilityAgreementToItem,
  mapLiabilityRepaymentScheduleToItem
} from './liabilities.mapper';

const DEFAULT_LIABILITY_ACCOUNT_SUBJECT_CODE = '2100';

const liabilityAgreementInclude =
  Prisma.validator<Prisma.LiabilityAgreementInclude>()({
    defaultFundingAccount: {
      select: {
        name: true
      }
    },
    liabilityAccountSubject: {
      select: {
        name: true
      }
    },
    interestExpenseCategory: {
      select: {
        name: true
      }
    },
    feeExpenseCategory: {
      select: {
        name: true
      }
    }
  });

const repaymentScheduleInclude =
  Prisma.validator<Prisma.LiabilityRepaymentScheduleInclude>()({
    agreement: {
      select: {
        lenderName: true,
        productName: true
      }
    },
    linkedPlanItem: {
      select: {
        matchedCollectedTransaction: {
          select: {
            id: true,
            title: true
          }
        }
      }
    },
    postedJournalEntry: {
      select: {
        id: true,
        entryNumber: true
      }
    }
  });

type LiabilityAgreementRecord = Prisma.LiabilityAgreementGetPayload<{
  include: typeof liabilityAgreementInclude;
}>;

type WorkspaceScope = {
  userId: string;
  tenantId: string;
  ledgerId: string;
};

type NormalizedLiabilityAgreementInput = {
  lenderName: string;
  productName: string;
  loanNumberLast4: string | null;
  principalAmount: number;
  borrowedAt: Date;
  maturityDate: Date | null;
  interestRate: number | null;
  interestRateType: CreateLiabilityAgreementRequest['interestRateType'];
  repaymentMethod: CreateLiabilityAgreementRequest['repaymentMethod'];
  paymentDay: number | null;
  defaultFundingAccountId: string;
  liabilityAccountSubjectId: string | null;
  interestExpenseCategoryId: string | null;
  feeExpenseCategoryId: string | null;
  status: LiabilityAgreementStatus;
  memo: string | null;
};

type LiabilityAgreementWriteData = Omit<
  NormalizedLiabilityAgreementInput,
  'lenderName' | 'productName'
> & {
  lenderName: string;
  normalizedLenderName: string;
  productName: string;
  normalizedProductName: string;
};

/**
 * 부채 약정, 상환 일정, 계획 항목 연결을 담당하는 서비스입니다.
 *
 * 부채는 단순 메모가 아니라 향후 현금 유출과 원금/이자 분개로 이어지는 운영 데이터입니다.
 * 그래서 약정 기준정보 검증, 상환 일정 합계 검증, 계획 항목 생성, 전표 확정 이후 상태 추적을 한 서비스에서 묶습니다.
 */
@Injectable()
export class LiabilitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingPeriodWriteGuard: AccountingPeriodWriteGuardPort
  ) {}

  async findAll(
    user: AuthenticatedUser,
    input?: {
      includeArchived?: boolean;
    }
  ): Promise<LiabilityAgreementItem[]> {
    const workspace = requireCurrentWorkspace(user);
    const records = await this.prisma.liabilityAgreement.findMany({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        ...(input?.includeArchived
          ? {}
          : {
              status: {
                not: LiabilityAgreementStatus.ARCHIVED
              }
            })
      },
      include: liabilityAgreementInclude,
      orderBy: [
        { status: 'asc' },
        { lenderName: 'asc' },
        { productName: 'asc' }
      ]
    });

    return records.map(mapLiabilityAgreementToItem);
  }

  async findOverview(
    user: AuthenticatedUser
  ): Promise<LiabilityOverviewResponse> {
    const workspace = requireCurrentWorkspace(user);
    const [period, agreements] = await Promise.all([
      this.prisma.accountingPeriod.findFirst({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          status: {
            in: [...readCollectingAccountingPeriodStatuses()]
          }
        },
        select: {
          startDate: true,
          endDate: true
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }]
      }),
      this.prisma.liabilityAgreement.findMany({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          status: {
            not: LiabilityAgreementStatus.ARCHIVED
          }
        },
        include: {
          repaymentSchedules: {
            orderBy: { dueDate: 'asc' }
          }
        },
        orderBy: [{ lenderName: 'asc' }, { productName: 'asc' }]
      })
    ]);

    const items = agreements.map((agreement) => {
      const schedules = agreement.repaymentSchedules;
      const postedPrincipal = schedules
        .filter((schedule) => schedule.status === 'POSTED')
        .reduce(
          (total, schedule) =>
            total + fromPrismaMoneyWon(schedule.principalAmount),
          0
        );
      const remainingPrincipal = Math.max(
        0,
        fromPrismaMoneyWon(agreement.principalAmount) - postedPrincipal
      );
      const openSchedules = schedules.filter(
        (schedule) =>
          !['POSTED', 'SKIPPED', 'CANCELLED'].includes(schedule.status)
      );
      const currentPeriodDue = period
        ? openSchedules
            .filter(
              (schedule) =>
                schedule.dueDate >= period.startDate &&
                schedule.dueDate < period.endDate
            )
            .reduce(
              (total, schedule) =>
                total + fromPrismaMoneyWon(schedule.totalAmount),
              0
            )
        : 0;

      return {
        liabilityAgreementId: agreement.id,
        lenderName: agreement.lenderName,
        productName: agreement.productName,
        status: agreement.status,
        remainingPrincipalWon: remainingPrincipal,
        nextDueDate:
          openSchedules[0]?.dueDate.toISOString().slice(0, 10) ?? null,
        currentPeriodDueWon: currentPeriodDue,
        scheduledCount: schedules.filter(
          (schedule) => schedule.status === 'SCHEDULED'
        ).length,
        plannedCount: schedules.filter(
          (schedule) => schedule.status === 'PLANNED'
        ).length,
        matchedCount: schedules.filter(
          (schedule) => schedule.status === 'MATCHED'
        ).length,
        postedCount: schedules.filter(
          (schedule) => schedule.status === 'POSTED'
        ).length
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      totalAgreementCount: agreements.length,
      activeAgreementCount: agreements.filter(
        (agreement) => agreement.status === 'ACTIVE'
      ).length,
      remainingPrincipalWon: items.reduce(
        (total, item) => total + item.remainingPrincipalWon,
        0
      ),
      currentPeriodDueWon: items.reduce(
        (total, item) => total + item.currentPeriodDueWon,
        0
      ),
      nextDueDate:
        items
          .map((item) => item.nextDueDate)
          .filter((value): value is string => Boolean(value))
          .sort()[0] ?? null,
      items
    };
  }

  async createAgreement(
    user: AuthenticatedUser,
    input: CreateLiabilityAgreementRequest
  ): Promise<LiabilityAgreementItem> {
    const workspace = requireCurrentWorkspace(user);
    const normalized = await this.normalizeAgreementInput(workspace, input);
    await this.assertAgreementUnique(workspace, normalized);

    const created = await this.prisma.liabilityAgreement.create({
      data: {
        userId: workspace.userId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        ...this.buildAgreementWriteData(normalized)
      },
      include: liabilityAgreementInclude
    });

    return mapLiabilityAgreementToItem(created);
  }

  async updateAgreement(
    user: AuthenticatedUser,
    liabilityAgreementId: string,
    input: UpdateLiabilityAgreementRequest
  ): Promise<LiabilityAgreementItem> {
    const workspace = requireCurrentWorkspace(user);
    const existing = await this.findAgreementRecord(
      workspace,
      liabilityAgreementId
    );
    const normalized = await this.normalizeAgreementInput(workspace, input);
    await this.assertAgreementUnique(workspace, normalized, existing.id);

    const updated = await this.prisma.liabilityAgreement.update({
      where: {
        id: existing.id
      },
      data: this.buildAgreementWriteData(normalized),
      include: liabilityAgreementInclude
    });

    return mapLiabilityAgreementToItem(updated);
  }

  async archiveAgreement(
    user: AuthenticatedUser,
    liabilityAgreementId: string
  ): Promise<LiabilityAgreementItem> {
    const workspace = requireCurrentWorkspace(user);
    const existing = await this.findAgreementRecord(
      workspace,
      liabilityAgreementId
    );

    const updated = await this.prisma.liabilityAgreement.update({
      where: {
        id: existing.id
      },
      data: {
        status: LiabilityAgreementStatus.ARCHIVED
      },
      include: liabilityAgreementInclude
    });

    return mapLiabilityAgreementToItem(updated);
  }

  async findRepayments(
    user: AuthenticatedUser,
    liabilityAgreementId: string
  ): Promise<LiabilityRepaymentScheduleItem[]> {
    const workspace = requireCurrentWorkspace(user);
    await this.findAgreementRecord(workspace, liabilityAgreementId);

    const records = await this.prisma.liabilityRepaymentSchedule.findMany({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        liabilityAgreementId
      },
      include: repaymentScheduleInclude,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }]
    });

    return records.map(mapLiabilityRepaymentScheduleToItem);
  }

  async createRepayment(
    user: AuthenticatedUser,
    liabilityAgreementId: string,
    input: CreateLiabilityRepaymentScheduleRequest
  ): Promise<LiabilityRepaymentScheduleItem> {
    const workspace = requireCurrentWorkspace(user);
    const agreement = await this.findAgreementRecord(
      workspace,
      liabilityAgreementId
    );
    const normalized = this.normalizeRepaymentInput(input);

    const created = await this.prisma.liabilityRepaymentSchedule.create({
      data: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        liabilityAgreementId: agreement.id,
        ...normalized,
        status: LiabilityRepaymentScheduleStatus.SCHEDULED
      },
      include: repaymentScheduleInclude
    });

    return mapLiabilityRepaymentScheduleToItem(created);
  }

  async updateRepayment(
    user: AuthenticatedUser,
    liabilityAgreementId: string,
    repaymentId: string,
    input: UpdateLiabilityRepaymentScheduleRequest
  ): Promise<LiabilityRepaymentScheduleItem> {
    const workspace = requireCurrentWorkspace(user);
    const existing = await this.findRepaymentRecord(
      workspace,
      liabilityAgreementId,
      repaymentId
    );

    if (existing.postedJournalEntryId || existing.status === 'POSTED') {
      throw new ConflictException(
        '이미 전표 확정된 상환 예정은 수정할 수 없습니다.'
      );
    }

    if (existing.linkedPlanItemId) {
      throw new ConflictException(
        '계획 항목과 연결된 상환 예정은 먼저 연결 상태를 확인한 뒤 수정해야 합니다.'
      );
    }

    const normalized = this.normalizeRepaymentInput(input);
    const updated = await this.prisma.liabilityRepaymentSchedule.update({
      where: {
        id: existing.id
      },
      data: {
        ...normalized,
        status: input.status ?? existing.status
      },
      include: repaymentScheduleInclude
    });

    return mapLiabilityRepaymentScheduleToItem(updated);
  }

  async generatePlanItem(
    user: AuthenticatedUser,
    liabilityAgreementId: string,
    repaymentId: string
  ): Promise<GenerateLiabilityPlanItemResponse> {
    const workspace = requireCurrentWorkspace(user);
    const repayment = await this.findRepaymentRecord(
      workspace,
      liabilityAgreementId,
      repaymentId
    );

    if (repayment.linkedPlanItemId) {
      throw new ConflictException('이미 계획 항목과 연결된 상환 예정입니다.');
    }

    if (['POSTED', 'SKIPPED', 'CANCELLED'].includes(repayment.status)) {
      throw new BadRequestException(
        '확정, 제외, 취소된 상환 예정은 계획 항목으로 생성할 수 없습니다.'
      );
    }

    const businessDate = repayment.dueDate.toISOString().slice(0, 10);
    const period =
      await this.accountingPeriodWriteGuard.assertCollectingDateAllowed(
        workspace,
        businessDate
      );
    const ledgerTransactionType =
      await this.findExpenseTransactionType(workspace);
    const title = `${buildLiabilityAgreementTitle(repayment.agreement)} 상환`;
    const amount = fromPrismaMoneyWon(repayment.totalAmount);
    const categoryId =
      repayment.agreement.interestExpenseCategoryId ??
      repayment.agreement.feeExpenseCategoryId ??
      null;

    // 부채 상환 계획 생성은 PlanItem과 수집 거래를 한 번에 만든다.
    // 이후 수집 거래 확정 단계에서 원금/이자/수수료가 실제 전표 라인으로 분리된다.
    const updatedRepayment = await this.prisma.$transaction(async (tx) => {
      const planItem = await tx.planItem.create({
        data: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          periodId: period.id,
          recurringRuleId: null,
          ledgerTransactionTypeId: ledgerTransactionType.id,
          fundingAccountId: repayment.agreement.defaultFundingAccountId,
          categoryId,
          title,
          plannedAmount: amount,
          plannedDate: repayment.dueDate,
          status: PlanItemStatus.MATCHED
        },
        select: {
          id: true
        }
      });

      const collectedTransaction = await tx.collectedTransaction.create({
        data: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          periodId: period.id,
          ledgerTransactionTypeId: ledgerTransactionType.id,
          fundingAccountId: repayment.agreement.defaultFundingAccountId,
          categoryId,
          matchedPlanItemId: planItem.id,
          title,
          occurredOn: repayment.dueDate,
          amount,
          status: CollectedTransactionStatus.READY_TO_POST,
          memo: repayment.memo ?? title
        },
        select: {
          id: true
        }
      });

      await tx.liabilityRepaymentSchedule.update({
        where: {
          id: repayment.id
        },
        data: {
          linkedPlanItemId: planItem.id,
          status: LiabilityRepaymentScheduleStatus.MATCHED
        }
      });

      const latest = await tx.liabilityRepaymentSchedule.findFirstOrThrow({
        where: {
          id: repayment.id
        },
        include: repaymentScheduleInclude
      });

      return {
        latest,
        planItemId: planItem.id,
        collectedTransactionId: collectedTransaction.id
      };
    });

    return {
      repayment: mapLiabilityRepaymentScheduleToItem(updatedRepayment.latest),
      createdPlanItemId: updatedRepayment.planItemId,
      createdCollectedTransactionId: updatedRepayment.collectedTransactionId
    };
  }

  private async findAgreementRecord(
    workspace: WorkspaceScope,
    liabilityAgreementId: string
  ): Promise<LiabilityAgreementRecord> {
    const agreement = await this.prisma.liabilityAgreement.findFirst({
      where: {
        id: liabilityAgreementId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      include: liabilityAgreementInclude
    });

    if (!agreement) {
      throw new NotFoundException('Liability agreement not found');
    }

    return agreement;
  }

  private async findRepaymentRecord(
    workspace: WorkspaceScope,
    liabilityAgreementId: string,
    repaymentId: string
  ) {
    const repayment = await this.prisma.liabilityRepaymentSchedule.findFirst({
      where: {
        id: repaymentId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        liabilityAgreementId
      },
      include: {
        ...repaymentScheduleInclude,
        agreement: {
          select: {
            id: true,
            lenderName: true,
            productName: true,
            defaultFundingAccountId: true,
            liabilityAccountSubjectId: true,
            interestExpenseCategoryId: true,
            feeExpenseCategoryId: true
          }
        }
      }
    });

    if (!repayment) {
      throw new NotFoundException('Liability repayment schedule not found');
    }

    return repayment;
  }

  private async normalizeAgreementInput(
    workspace: WorkspaceScope,
    input: CreateLiabilityAgreementRequest | UpdateLiabilityAgreementRequest
  ) {
    const lenderName = normalizeRequiredText(
      input.lenderName,
      '금융기관명을 입력해 주세요.'
    );
    const productName = normalizeRequiredText(
      input.productName,
      '대출 상품명을 입력해 주세요.'
    );
    const borrowedAt = parseDateInput(input.borrowedAt, '차입일');
    const maturityDate = input.maturityDate
      ? parseDateInput(input.maturityDate, '만기일')
      : null;

    if (maturityDate && maturityDate < borrowedAt) {
      throw new BadRequestException('만기일은 차입일보다 빠를 수 없습니다.');
    }

    if (
      input.paymentDay != null &&
      (!Number.isInteger(input.paymentDay) ||
        input.paymentDay < 1 ||
        input.paymentDay > 31)
    ) {
      throw new BadRequestException('상환일은 1일부터 31일 사이여야 합니다.');
    }

    // 부채 계약의 참조값은 자금수단, 부채 계정과목, 비용 카테고리가 서로 다른 표에 걸쳐 있다.
    // 입력 정규화 단계에서 모두 한 번에 읽고 검증해 쓰기 이후의 전표 생성 실패를 줄인다.
    const referenceState = await this.readAgreementReferenceState(workspace, {
      defaultFundingAccountId: normalizeRequiredText(
        input.defaultFundingAccountId,
        '상환 자금수단을 선택해 주세요.'
      ),
      liabilityAccountSubjectId: normalizeNullableText(
        input.liabilityAccountSubjectId
      ),
      interestExpenseCategoryId: normalizeNullableText(
        input.interestExpenseCategoryId
      ),
      feeExpenseCategoryId: normalizeNullableText(input.feeExpenseCategoryId)
    });
    this.assertAgreementReferences(referenceState);

    return {
      lenderName,
      productName,
      loanNumberLast4: normalizeLoanNumberLast4(input.loanNumberLast4),
      principalAmount: requirePositiveMoneyWon(
        input.principalAmount,
        '대출 원금은 0보다 큰 안전한 정수여야 합니다.'
      ),
      borrowedAt,
      maturityDate,
      interestRate: input.interestRate ?? null,
      interestRateType: input.interestRateType,
      repaymentMethod: input.repaymentMethod,
      paymentDay: input.paymentDay ?? null,
      defaultFundingAccountId: referenceState.defaultFundingAccountId,
      liabilityAccountSubjectId: referenceState.liabilityAccountSubjectId,
      interestExpenseCategoryId: referenceState.interestExpenseCategoryId,
      feeExpenseCategoryId: referenceState.feeExpenseCategoryId,
      status: input.status ?? LiabilityAgreementStatus.ACTIVE,
      memo: normalizeNullableText(input.memo)
    };
  }

  private buildAgreementWriteData(
    input: NormalizedLiabilityAgreementInput
  ): LiabilityAgreementWriteData {
    return {
      defaultFundingAccountId: input.defaultFundingAccountId,
      liabilityAccountSubjectId: input.liabilityAccountSubjectId,
      interestExpenseCategoryId: input.interestExpenseCategoryId,
      feeExpenseCategoryId: input.feeExpenseCategoryId,
      lenderName: input.lenderName,
      normalizedLenderName: normalizeCaseInsensitiveText(input.lenderName),
      productName: input.productName,
      normalizedProductName: normalizeCaseInsensitiveText(input.productName),
      loanNumberLast4: input.loanNumberLast4,
      principalAmount: input.principalAmount,
      borrowedAt: input.borrowedAt,
      maturityDate: input.maturityDate,
      interestRate: input.interestRate,
      interestRateType: input.interestRateType,
      repaymentMethod: input.repaymentMethod,
      paymentDay: input.paymentDay,
      status: input.status,
      memo: input.memo
    };
  }

  private normalizeRepaymentInput(
    input:
      | CreateLiabilityRepaymentScheduleRequest
      | UpdateLiabilityRepaymentScheduleRequest
  ) {
    const principalAmount = requireNonNegativeMoneyWon(
      input.principalAmount,
      '원금 상환액은 0 이상의 안전한 정수여야 합니다.'
    );
    const interestAmount = requireNonNegativeMoneyWon(
      input.interestAmount ?? 0,
      '이자 금액은 0 이상의 안전한 정수여야 합니다.'
    );
    const feeAmount = requireNonNegativeMoneyWon(
      input.feeAmount ?? 0,
      '수수료 금액은 0 이상의 안전한 정수여야 합니다.'
    );
    const totalAmount = addMoneyWon(
      addMoneyWon(principalAmount, interestAmount),
      feeAmount
    );

    // 상환 일정은 원금 없이 이자/수수료만 있을 수도 있지만, 전체 금액이 0이면
    // 계획 항목과 수집 거래를 만들 근거가 없으므로 거부한다.
    if (totalAmount <= 0) {
      throw new BadRequestException(
        '상환 예정 총액은 원금, 이자, 수수료 중 하나 이상을 포함해야 합니다.'
      );
    }

    return {
      dueDate: parseDateInput(input.dueDate, '상환 예정일'),
      principalAmount,
      interestAmount,
      feeAmount,
      totalAmount,
      memo: normalizeNullableText(input.memo)
    };
  }

  private async assertAgreementUnique(
    workspace: WorkspaceScope,
    input: {
      lenderName: string;
      productName: string;
    },
    excludeAgreementId?: string
  ) {
    const duplicate = await this.prisma.liabilityAgreement.findFirst({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        normalizedLenderName: normalizeCaseInsensitiveText(input.lenderName),
        normalizedProductName: normalizeCaseInsensitiveText(input.productName),
        ...(excludeAgreementId
          ? {
              id: {
                not: excludeAgreementId
              }
            }
          : {})
      },
      select: {
        id: true,
        status: true
      }
    });

    if (!duplicate) {
      return;
    }

    throw new ConflictException(
      duplicate.status === LiabilityAgreementStatus.ARCHIVED
        ? '같은 금융기관과 상품명의 보관된 부채 계약이 있습니다.'
        : '같은 금융기관과 상품명의 부채 계약이 이미 있습니다.'
    );
  }

  private async readAgreementReferenceState(
    workspace: WorkspaceScope,
    input: {
      defaultFundingAccountId: string;
      liabilityAccountSubjectId: string | null;
      interestExpenseCategoryId: string | null;
      feeExpenseCategoryId: string | null;
    }
  ) {
    const [
      fundingAccount,
      requestedLiabilitySubject,
      defaultLiabilitySubject,
      interestCategory,
      feeCategory
    ] = await Promise.all([
      // 기본 출금 자금수단과 선택 참조값을 동시에 확인한다.
      // 부채 계정과목을 지정하지 않은 경우에는 기본 부채 계정과목을 fallback으로 사용한다.
      this.prisma.account.findFirst({
        where: {
          id: input.defaultFundingAccountId,
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId
        },
        select: { id: true }
      }),
      input.liabilityAccountSubjectId
        ? this.prisma.accountSubject.findFirst({
            where: {
              id: input.liabilityAccountSubjectId,
              tenantId: workspace.tenantId,
              ledgerId: workspace.ledgerId
            },
            select: {
              id: true,
              subjectKind: true,
              isActive: true
            }
          })
        : null,
      this.prisma.accountSubject.findFirst({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          code: DEFAULT_LIABILITY_ACCOUNT_SUBJECT_CODE,
          subjectKind: AccountSubjectKind.LIABILITY,
          isActive: true
        },
        select: {
          id: true,
          subjectKind: true,
          isActive: true
        }
      }),
      input.interestExpenseCategoryId
        ? this.prisma.category.findFirst({
            where: {
              id: input.interestExpenseCategoryId,
              tenantId: workspace.tenantId,
              ledgerId: workspace.ledgerId
            },
            select: {
              id: true,
              kind: true,
              isActive: true
            }
          })
        : null,
      input.feeExpenseCategoryId
        ? this.prisma.category.findFirst({
            where: {
              id: input.feeExpenseCategoryId,
              tenantId: workspace.tenantId,
              ledgerId: workspace.ledgerId
            },
            select: {
              id: true,
              kind: true,
              isActive: true
            }
          })
        : null
    ]);

    return {
      fundingAccountExists: Boolean(fundingAccount),
      defaultFundingAccountId:
        fundingAccount?.id ?? input.defaultFundingAccountId,
      liabilityAccountSubject:
        requestedLiabilitySubject ?? defaultLiabilitySubject,
      liabilityAccountSubjectId:
        (requestedLiabilitySubject ?? defaultLiabilitySubject)?.id ?? null,
      interestExpenseCategory: interestCategory,
      interestExpenseCategoryId: interestCategory?.id ?? null,
      feeExpenseCategory: feeCategory,
      feeExpenseCategoryId: feeCategory?.id ?? null,
      requestedInterestExpenseCategoryId: input.interestExpenseCategoryId,
      requestedFeeExpenseCategoryId: input.feeExpenseCategoryId
    };
  }

  private assertAgreementReferences(
    state: Awaited<ReturnType<typeof this.readAgreementReferenceState>>
  ) {
    if (!state.fundingAccountExists) {
      throw new NotFoundException('Funding account not found');
    }

    if (!state.liabilityAccountSubject) {
      throw new NotFoundException('Liability account subject not found');
    }

    if (
      state.liabilityAccountSubject.subjectKind !==
        AccountSubjectKind.LIABILITY ||
      !state.liabilityAccountSubject.isActive
    ) {
      throw new BadRequestException(
        '부채 계정과목은 활성 부채 계정과목이어야 합니다.'
      );
    }

    if (
      state.requestedInterestExpenseCategoryId &&
      !state.interestExpenseCategory
    ) {
      throw new NotFoundException('Interest expense category not found');
    }

    if (
      state.interestExpenseCategory &&
      (state.interestExpenseCategory.kind !== CategoryKind.EXPENSE ||
        !state.interestExpenseCategory.isActive)
    ) {
      throw new BadRequestException(
        '이자 카테고리는 활성 지출 분류여야 합니다.'
      );
    }

    if (state.requestedFeeExpenseCategoryId && !state.feeExpenseCategory) {
      throw new NotFoundException('Fee expense category not found');
    }

    if (
      state.feeExpenseCategory &&
      (state.feeExpenseCategory.kind !== CategoryKind.EXPENSE ||
        !state.feeExpenseCategory.isActive)
    ) {
      throw new BadRequestException(
        '수수료 카테고리는 활성 지출 분류여야 합니다.'
      );
    }
  }

  private async findExpenseTransactionType(workspace: WorkspaceScope) {
    const ledgerTransactionType =
      await this.prisma.ledgerTransactionType.findFirst({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          flowKind: LedgerTransactionFlowKind.EXPENSE,
          isActive: true
        },
        select: {
          id: true
        },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }]
      });

    if (!ledgerTransactionType) {
      throw new InternalServerErrorException(
        '현재 Ledger에 부채 상환 계획용 지출 거래유형이 준비되어 있지 않습니다.'
      );
    }

    return ledgerTransactionType;
  }
}

function normalizeRequiredText(value: string, message: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new BadRequestException(message);
  }

  return normalized;
}

function normalizeNullableText(value?: string | null) {
  const normalized = value?.trim() ?? '';

  return normalized.length > 0 ? normalized : null;
}

function normalizeLoanNumberLast4(value?: string | null) {
  const normalized = normalizeNullableText(value);

  if (!normalized) {
    return null;
  }

  if (!/^\d{1,4}$/.test(normalized)) {
    throw new BadRequestException(
      '대출번호는 마지막 4자리 이하 숫자만 입력해 주세요.'
    );
  }

  return normalized;
}

function parseDateInput(value: string, label: string) {
  const normalized = typeof value === 'string' ? value.trim() : '';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new BadRequestException(`${label} 형식이 올바르지 않습니다.`);
  }

  const date = new Date(`${normalized}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== normalized
  ) {
    throw new BadRequestException(`${label} 형식이 올바르지 않습니다.`);
  }

  return date;
}
