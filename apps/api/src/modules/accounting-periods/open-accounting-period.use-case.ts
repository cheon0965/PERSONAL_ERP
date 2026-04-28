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
  AccountingPeriodStatus,
  AuditActorType,
  JournalEntrySourceKind,
  JournalEntryStatus
} from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import {
  readWorkspaceActorRef,
  readWorkspaceCreatedByActorRef
} from '../../common/auth/workspace-actor-ref.util';
import { assertWorkspaceActionAllowed } from '../../common/auth/workspace-action.policy';
import { requirePositiveMoneyWon } from '../../common/money/money-won';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OperationalAuditPublisher } from '../../common/infrastructure/operational/operational-audit-publisher.service';
import { publishPeriodStatusHistoryAudit } from '../../common/infrastructure/operational/period-status-history-audit';
import { parseMonthRange } from '../../common/utils/date.util';
import { mapAccountingPeriodRecordToItem } from './accounting-period.mapper';
import { buildJournalEntryEntryNumber } from '../journal-entries/public';
import {
  compareYearMonth,
  normalizeMonthToken,
  normalizeOptionalText,
  readYearMonth
} from './accounting-period.policy';
import { assertAccountingPeriodCanRecordInitialOpen } from './accounting-period-transition.policy';

/**
 * 새 운영월을 OPEN 상태로 시작하는 유스케이스입니다.
 *
 * 첫 월은 사용자가 입력한 기초 잔액으로 시작하고, 이후 월은 차기 이월이 만든 오프닝 스냅샷을 사용합니다.
 * 이 규칙을 분리해두면 월별 운영 체인이 "오픈 -> 수집/전표 -> 마감 -> 이월 -> 다음 오픈" 순서로 유지됩니다.
 */
@Injectable()
export class OpenAccountingPeriodUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditPublisher: OperationalAuditPublisher
  ) {}

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

    // 첫 운영월은 이전 마감 잔액이 없으므로 사용자가 직접 기초 잔액을 제공해야 한다.
    // 반대로 두 번째 달부터는 차기 이월이 오프닝 기준을 만들어야 하므로 직접 입력을 막는다.
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
      // 월 운영은 하나의 최신 진행월만 허용한다. 과거월 재개나 미래월 선오픈을 허용하면
      // 계획 생성, 업로드 승격, 마감 스냅샷의 기준월이 어긋날 수 있다.
      if (
        compareYearMonth(year, month, latestPeriod.year, latestPeriod.month) <=
        0
      ) {
        throw new BadRequestException(
          '새 운영 기간은 최근 운영 기간보다 이후 월이어야 합니다.'
        );
      }

      if (latestPeriod.status !== AccountingPeriodStatus.LOCKED) {
        throw new ConflictException(
          '새 운영 기간은 최근 운영 기간을 먼저 마감한 뒤 열 수 있습니다. 운영 중에는 하나의 최신 진행월만 열어 둡니다.'
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
        // 기간, 상태 이력, 선택적 기초 잔액 스냅샷은 하나의 운영 시작 단위이므로
        // 트랜잭션 안에서 함께 생성해 중간 상태가 남지 않게 한다.
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

          // 기초 잔액 라인에 대한 기초전표를 생성한다.
          // 스냅샷은 잔액 anchor, 전표는 회계 감사 추적 경로를 제공한다.
          const equitySubject = await tx.accountSubject.findFirst({
            where: {
              tenantId: workspace.tenantId,
              ledgerId: workspace.ledgerId,
              subjectKind: AccountSubjectKind.EQUITY,
              isActive: true
            },
            select: {
              id: true
            }
          });

          if (equitySubject) {
            let journalSequence = 1;

            for (const line of validatedOpeningBalanceLines) {
              const entryNumber = buildJournalEntryEntryNumber(
                year,
                month,
                journalSequence
              );

              const isDebitNormal =
                line.accountSubjectKind === 'ASSET';

              const journalLines = isDebitNormal
                ? [
                    {
                      lineNumber: 1,
                      accountSubjectId: line.accountSubjectId,
                      fundingAccountId: line.fundingAccountId,
                      debitAmount: line.balanceAmount,
                      creditAmount: 0,
                      description: '기초금액 등록'
                    },
                    {
                      lineNumber: 2,
                      accountSubjectId: equitySubject.id,
                      debitAmount: 0,
                      creditAmount: line.balanceAmount,
                      description: '기초금액 등록'
                    }
                  ]
                : [
                    {
                      lineNumber: 1,
                      accountSubjectId: equitySubject.id,
                      debitAmount: line.balanceAmount,
                      creditAmount: 0,
                      description: '기초금액 등록'
                    },
                    {
                      lineNumber: 2,
                      accountSubjectId: line.accountSubjectId,
                      fundingAccountId: line.fundingAccountId,
                      debitAmount: 0,
                      creditAmount: line.balanceAmount,
                      description: '기초금액 등록'
                    }
                  ];

              await tx.journalEntry.create({
                data: {
                  tenantId: workspace.tenantId,
                  ledgerId: workspace.ledgerId,
                  periodId: createdPeriod.id,
                  entryNumber,
                  entryDate: start,
                  sourceKind: JournalEntrySourceKind.OPENING_BALANCE,
                  status: JournalEntryStatus.POSTED,
                  memo: '기초금액 등록',
                  createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
                  createdByMembershipId: workspace.membershipId,
                  lines: {
                    createMany: {
                      data: journalLines
                    }
                  }
                }
              });

              journalSequence += 1;
            }

            // 기초전표 생성 후 전표번호 시퀀스를 갱신한다.
            await tx.accountingPeriod.update({
              where: {
                id: createdPeriod.id
              },
              data: {
                nextJournalEntrySequence: journalSequence
              }
            });
          }
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

    publishPeriodStatusHistoryAudit(this.auditPublisher, createdStatusHistory);

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
  // 첫 월 기초 잔액은 이후 모든 스냅샷의 시작점이므로 계정과목/자금수단/금액을 저장 전에 엄격히 검증한다.
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
    // 기초 잔액은 재무상태표 계정만 허용한다. 수익/비용 계정은 기간 손익으로
    // 흘러야 하므로 오프닝 스냅샷에 직접 넣으면 다음 마감 합계가 왜곡된다.
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
