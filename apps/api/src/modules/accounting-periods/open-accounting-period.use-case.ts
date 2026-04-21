import {
  BadRequestException,
  ConflictException,
  Injectable
} from '@nestjs/common';
import type {
  AccountingPeriodItem,
  AuthenticatedUser,
  OpenAccountingPeriodRequest
} from '@personal-erp/contracts';
import {
  AccountSubjectKind,
  AccountingPeriodEventType,
  AccountingPeriodStatus
} from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import {
  readWorkspaceActorRef,
  readWorkspaceCreatedByActorRef
} from '../../common/auth/workspace-actor-ref.util';
import { assertWorkspaceActionAllowed } from '../../common/auth/workspace-action.policy';
import { requirePositiveMoneyWon } from '../../common/money/money-won';
import { PrismaService } from '../../common/prisma/prisma.service';
import { parseMonthRange } from '../../common/utils/date.util';
import { mapAccountingPeriodRecordToItem } from './accounting-period.mapper';
import {
  compareYearMonth,
  normalizeMonthToken,
  normalizeOptionalText,
  readYearMonth
} from './accounting-period.policy';
import {
  assertAccountingPeriodCanRecordInitialOpen
} from './accounting-period-transition.policy';

@Injectable()
export class OpenAccountingPeriodUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    user: AuthenticatedUser,
    input: OpenAccountingPeriodRequest
  ): Promise<AccountingPeriodItem> {
    const workspace = requireCurrentWorkspace(user);
    const actorRef = readWorkspaceActorRef(workspace);
    const createdByActorRef = readWorkspaceCreatedByActorRef(workspace);
    assertOpenPermission(workspace.membershipRole);

    const monthToken = normalizeMonthToken(input.month);
    const { start, end } = parseMonthRange(monthToken);
    const { year, month } = readYearMonth(monthToken);

    const existingPeriod = await this.prisma.accountingPeriod.findFirst({
      where: {
        ledgerId: workspace.ledgerId,
        year,
        month
      }
    });

    if (existingPeriod) {
      throw new ConflictException('해당 월 운영 기간이 이미 존재합니다.');
    }

    const latestPeriod = await this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    });

    const isFirstPeriod = latestPeriod == null;
    const shouldCreateOpeningSnapshot = Boolean(input.initializeOpeningBalance);
    const openingBalanceLineDrafts = normalizeOpeningBalanceLineDrafts(
      input.openingBalanceLines
    );

    if (!shouldCreateOpeningSnapshot && openingBalanceLineDrafts.length > 0) {
      throw new BadRequestException(
        '오프닝 잔액 라인을 입력하려면 기초 잔액 기준 생성을 함께 선택해 주세요.'
      );
    }

    if (isFirstPeriod && !shouldCreateOpeningSnapshot) {
      throw new BadRequestException(
        '첫 월 운영 시작에는 오프닝 잔액 스냅샷 생성이 필요합니다.'
      );
    }

    if (!isFirstPeriod && shouldCreateOpeningSnapshot) {
      throw new BadRequestException(
        '오프닝 잔액 스냅샷 직접 생성은 첫 월 운영 시작에서만 허용합니다.'
      );
    }

    if (isFirstPeriod && openingBalanceLineDrafts.length === 0) {
      throw new BadRequestException(
        '첫 월 운영 시작에는 최소 1건 이상의 오프닝 잔액 라인이 필요합니다.'
      );
    }

    if (latestPeriod) {
      if (
        compareYearMonth(year, month, latestPeriod.year, latestPeriod.month) <=
        0
      ) {
        throw new BadRequestException(
          '새 운영 기간은 최근 운영 기간보다 이후 월이어야 합니다.'
        );
      }
    }

    assertAccountingPeriodCanRecordInitialOpen();

    const validatedOpeningBalanceLines = shouldCreateOpeningSnapshot
      ? buildValidatedOpeningBalanceLines({
          lineDrafts: openingBalanceLineDrafts,
          accountSubjects: await this.prisma.accountSubject.findMany({
            where: {
              tenantId: workspace.tenantId,
              ledgerId: workspace.ledgerId,
              isActive: true
            }
          }),
          fundingAccounts: await this.prisma.account.findMany({
            where: {
              tenantId: workspace.tenantId,
              ledgerId: workspace.ledgerId
            }
          })
        })
      : [];

    const { createdPeriod, createdStatusHistory, openingBalanceSnapshot } =
      await this.prisma.$transaction(async (tx) => {
        const createdPeriod = await tx.accountingPeriod.create({
          data: {
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId,
            year,
            month,
            startDate: start,
            endDate: end,
            status: AccountingPeriodStatus.OPEN
          }
        });

        const createdStatusHistory = await tx.periodStatusHistory.create({
          data: {
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId,
            periodId: createdPeriod.id,
            fromStatus: null,
            toStatus: AccountingPeriodStatus.OPEN,
            eventType: AccountingPeriodEventType.OPEN,
            reason: normalizeOptionalText(input.note),
            ...actorRef
          }
        });

        const openingBalanceSnapshot = shouldCreateOpeningSnapshot
          ? await tx.openingBalanceSnapshot.create({
              data: {
                tenantId: workspace.tenantId,
                ledgerId: workspace.ledgerId,
                effectivePeriodId: createdPeriod.id,
                sourceKind: 'INITIAL_SETUP',
                ...createdByActorRef
              }
            })
          : null;

        if (openingBalanceSnapshot && validatedOpeningBalanceLines.length > 0) {
          await tx.balanceSnapshotLine.createMany({
            data: validatedOpeningBalanceLines.map((line) => ({
              snapshotKind: 'OPENING',
              openingSnapshotId: openingBalanceSnapshot.id,
              accountSubjectId: line.accountSubjectId,
              fundingAccountId: line.fundingAccountId,
              balanceAmount: line.balanceAmount
            }))
          });
        }

        return {
          createdPeriod,
          createdStatusHistory,
          openingBalanceSnapshot: openingBalanceSnapshot
            ? {
                sourceKind: openingBalanceSnapshot.sourceKind
              }
            : null
        };
      });

    return mapAccountingPeriodRecordToItem({
      ...createdPeriod,
      openingBalanceSnapshot,
      statusHistory: [createdStatusHistory]
    });
  }
}

function assertOpenPermission(
  membershipRole: ReturnType<typeof requireCurrentWorkspace>['membershipRole']
) {
  return assertWorkspaceActionAllowed(membershipRole, 'accounting_period.open');
}

function normalizeOpeningBalanceLineDrafts(
  lines: OpenAccountingPeriodRequest['openingBalanceLines']
) {
  return (lines ?? []).map((line) => ({
    accountSubjectId: line.accountSubjectId,
    fundingAccountId: normalizeOptionalIdentifier(line.fundingAccountId),
    balanceAmount: line.balanceAmount
  }));
}

function buildValidatedOpeningBalanceLines(input: {
  lineDrafts: Array<{
    accountSubjectId: string;
    fundingAccountId: string | null;
    balanceAmount: number;
  }>;
  accountSubjects: Array<{
    id: string;
    code: string;
    name: string;
    subjectKind: AccountSubjectKind;
    isActive: boolean;
  }>;
  fundingAccounts: Array<{
    id: string;
    name: string;
    status: 'ACTIVE' | 'INACTIVE' | 'CLOSED';
  }>;
}) {
  const accountSubjectById = new Map(
    input.accountSubjects.map((candidate) => [candidate.id, candidate])
  );
  const fundingAccountById = new Map(
    input.fundingAccounts
      .filter((candidate) => candidate.status !== 'CLOSED')
      .map((candidate) => [candidate.id, candidate])
  );
  const seenKeys = new Set<string>();

  return input.lineDrafts.map((line, index) => {
    const accountSubject = accountSubjectById.get(line.accountSubjectId);
    if (!accountSubject) {
      throw new BadRequestException(
        `오프닝 잔액 라인 ${index + 1}의 계정과목을 찾을 수 없습니다.`
      );
    }

    if (!isOpeningBalanceSubjectKind(accountSubject.subjectKind)) {
      throw new BadRequestException(
        `오프닝 잔액 라인 ${index + 1}에는 재무상태표 계정과목만 사용할 수 있습니다.`
      );
    }

    if (
      line.fundingAccountId &&
      !fundingAccountById.has(line.fundingAccountId)
    ) {
      throw new BadRequestException(
        `오프닝 잔액 라인 ${index + 1}의 자금수단을 찾을 수 없습니다.`
      );
    }

    const lineKey = `${accountSubject.id}:${line.fundingAccountId ?? 'none'}`;
    if (seenKeys.has(lineKey)) {
      throw new BadRequestException(
        '동일한 계정과목과 자금수단 조합의 오프닝 잔액 라인은 한 번만 입력할 수 있습니다.'
      );
    }

    seenKeys.add(lineKey);

    return {
      accountSubjectId: accountSubject.id,
      accountSubjectKind: accountSubject.subjectKind,
      fundingAccountId: line.fundingAccountId,
      balanceAmount: requirePositiveMoneyWon(
        line.balanceAmount,
        `오프닝 잔액 라인 ${index + 1}의 금액은 0보다 큰 안전한 정수여야 합니다.`
      )
    };
  });
}

function isOpeningBalanceSubjectKind(subjectKind: AccountSubjectKind) {
  return (
    subjectKind === 'ASSET' ||
    subjectKind === 'LIABILITY' ||
    subjectKind === 'EQUITY'
  );
}

function normalizeOptionalIdentifier(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}
