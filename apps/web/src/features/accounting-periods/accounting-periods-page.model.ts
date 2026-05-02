import type * as React from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { Route } from 'next';
import type {
  AccountSubjectItem,
  AccountingPeriodItem,
  CloseAccountingPeriodResponse,
  FundingAccountItem
} from '@personal-erp/contracts';
import { formatWon } from '@/shared/lib/format';
import {
  accountingPeriodsQueryKey,
  currentAccountingPeriodQueryKey
} from './accounting-periods.api';
import {
  isBalanceSheetAccountSubject,
  readMembershipRoleLabel
} from './accounting-periods-page.helpers';
import type { PeriodOperationsSection } from './accounting-periods-page.lifecycle-section';
import type { PeriodOperationTab } from './accounting-periods-page.lifecycle-section';
import type { CurrentPeriodStatusSection } from './accounting-periods-page.status-section';
import type { PeriodWorkspaceSection } from './periods-section-nav';

type MembershipRole = string | null;
type PageHeaderHref = Route | `#${string}`;

export function buildAccountingPeriodsPageModel({
  accountSubjects,
  fundingAccounts,
  membershipRole,
  periods,
  readiness,
  section,
  workspaceLabel,
  ledgerLabel
}: {
  accountSubjects: AccountSubjectItem[];
  fundingAccounts: FundingAccountItem[];
  membershipRole: MembershipRole;
  periods: AccountingPeriodItem[];
  readiness: boolean;
  section: PeriodWorkspaceSection;
  workspaceLabel: string;
  ledgerLabel: string;
}) {
  const hasWorkspace = ledgerLabel !== '-';
  const canOpenPeriodByRole =
    membershipRole === 'OWNER' || membershipRole === 'MANAGER';
  const canClosePeriod = membershipRole === 'OWNER';
  const canReopenPeriod = membershipRole === 'OWNER';
  const isFirstPeriod = periods.length === 0;
  const openPeriod =
    periods.find((period) => period.status !== 'LOCKED') ?? null;
  const lockedPeriods = periods.filter((period) => period.status === 'LOCKED');
  const latestPeriod = periods[0] ?? null;
  const canOpenPeriodByLifecycle =
    isFirstPeriod || latestPeriod?.status === 'LOCKED';
  const canOpenPeriod = canOpenPeriodByRole && canOpenPeriodByLifecycle;
  const openPeriodBlockReason = readOpenPeriodBlockReason({
    canOpenPeriodByRole,
    canOpenPeriodByLifecycle,
    latestPeriod,
    membershipRole
  });
  const reopenPeriod = lockedPeriods[0] ?? null;
  const currentPeriod = openPeriod ?? latestPeriod ?? null;
  const lockedPeriodCount = lockedPeriods.length;
  const periodStatusSummary = periods.reduce(
    (counts, period) => {
      counts[period.status] += 1;
      return counts;
    },
    {
      OPEN: 0,
      IN_REVIEW: 0,
      CLOSING: 0,
      LOCKED: 0
    }
  );
  const balanceSheetAccountSubjects = accountSubjects.filter((accountSubject) =>
    isBalanceSheetAccountSubject(accountSubject)
  );
  const openingBalanceFundingAccounts = fundingAccounts.filter(
    (fundingAccount) => fundingAccount.status !== 'CLOSED'
  );
  const focusedOperationTab: PeriodOperationTab =
    section === 'open'
      ? 'open'
      : openPeriod
        ? 'close'
        : reopenPeriod
          ? 'reopen'
          : 'close';
  const pageTitle =
    section === 'overview'
      ? '운영 기간'
      : section === 'open'
        ? '월 운영 시작'
        : section === 'close'
          ? '월 마감 / 재오픈'
          : '운영 기간 이력';
  const pageDescription =
    section === 'overview'
      ? '현재 운영 월 상태와 다음 작업을 먼저 확인하고, 실제 시작·마감·이력 화면으로 이어지는 기준 허브입니다.'
      : section === 'open'
        ? '새 운영 월과 기초 잔액 기준을 집중해서 준비하는 화면입니다.'
        : section === 'close'
          ? '열린 운영 월의 마감과 잠금 월 재오픈 여부를 별도 작업 화면에서 관리합니다.'
          : '운영 기간 상태 이력과 기초 잔액 출처를 이력 중심으로 검토하는 화면입니다.';
  const primaryAction =
    section === 'overview'
      ? openPeriod
        ? {
            label: '월 마감 작업',
            href: '/periods/close' as const
          }
        : {
            label: '월 운영 시작',
            href: '/periods/open' as const
          }
      : section === 'open'
        ? openPeriod
          ? {
              label: '현재 상태 보기',
              href: '/periods' as const
            }
          : {
              label: '입력 작업대로 이동',
              href: '#open-accounting-period-form' as const
            }
        : section === 'close'
          ? {
              label: '마감 작업대로 이동',
              href: '#accounting-period-workbench' as const
            }
          : {
              label: '월 운영 시작',
              href: '/periods/open' as const
            };
  const secondaryAction =
    section === 'history'
      ? {
          label: '현재 상태 보기',
          href: '/periods' as const
        }
      : {
          label: '기간 이력',
          href: '/periods/history' as const
        };

  return {
    balanceSheetAccountSubjects,
    canClosePeriod,
    canOpenPeriod,
    canReopenPeriod,
    currentPeriod,
    focusedOperationTab,
    hasWorkspace,
    isFirstPeriod,
    isReadyForMonthlyOperation: readiness,
    ledgerLabel,
    lockedPeriods,
    lockedPeriodCount,
    openingBalanceFundingAccounts,
    openPeriodBlockReason,
    openPeriod,
    pageDescription,
    pageTitle,
    periodStatusSummary,
    primaryAction,
    reopenPeriod,
    secondaryAction,
    workspaceLabel,
    membershipRole: readMembershipRoleLabel(membershipRole)
  };
}

function readOpenPeriodBlockReason(input: {
  canOpenPeriodByRole: boolean;
  canOpenPeriodByLifecycle: boolean;
  latestPeriod: AccountingPeriodItem | null;
  membershipRole: MembershipRole;
}) {
  if (!input.canOpenPeriodByRole) {
    return `월 운영 시작은 소유자 또는 관리자만 실행할 수 있습니다. 현재 역할은 ${readMembershipRoleLabel(input.membershipRole)} 입니다.`;
  }

  if (!input.canOpenPeriodByLifecycle && input.latestPeriod) {
    return `${input.latestPeriod.monthLabel} 운영 월이 아직 ${input.latestPeriod.status} 상태입니다. 새 운영 월은 최근 운영 월을 먼저 마감한 뒤 열 수 있습니다.`;
  }

  return null;
}

export function buildAccountingPeriodsHeaderConfig({
  currentPeriod,
  isReadyForMonthlyOperation,
  pageDescription,
  pageTitle,
  periodsLength,
  primaryAction,
  section,
  secondaryAction,
  workspaceLabel,
  ledgerLabel,
  membershipRole
}: {
  currentPeriod: AccountingPeriodItem | null;
  isReadyForMonthlyOperation: boolean;
  pageDescription: string;
  pageTitle: string;
  periodsLength: number;
  primaryAction: { label: string; href: PageHeaderHref };
  section: PeriodWorkspaceSection;
  secondaryAction: { label: string; href: PageHeaderHref };
  workspaceLabel: string;
  ledgerLabel: string;
  membershipRole: string;
}) {
  return {
    eyebrow: '월 운영',
    title: pageTitle,
    description: pageDescription,
    badges: [
      {
        label:
          section === 'overview'
            ? currentPeriod
              ? currentPeriod.monthLabel
              : '운영 기간 없음'
            : section === 'open'
              ? '운영 시작 작업'
              : section === 'close'
                ? '마감 / 재오픈 작업'
                : '기간 이력 검토',
        color: currentPeriod ? ('primary' as const) : ('default' as const)
      },
      {
        label: isReadyForMonthlyOperation
          ? '시작 준비됨'
          : '기준 데이터 점검 필요',
        color: isReadyForMonthlyOperation
          ? ('success' as const)
          : ('warning' as const)
      }
    ],
    metadata: [
      {
        label: '사업장',
        value: workspaceLabel
      },
      {
        label: '장부',
        value: ledgerLabel
      },
      {
        label: section === 'history' ? '운영 기간 수' : '현재 운영 월',
        value:
          section === 'history'
            ? `${periodsLength}개`
            : (currentPeriod?.monthLabel ?? '-')
      },
      {
        label: '권한',
        value: membershipRole
      }
    ],
    metadataSingleRow: true,
    primaryActionLabel: primaryAction.label,
    primaryActionHref: primaryAction.href,
    secondaryActionLabel: secondaryAction.label,
    secondaryActionHref: secondaryAction.href
  };
}

export function buildAccountingPeriodsDomainHelp({
  latestClosingResult,
  ledgerLabel,
  ledgerMetaLabel,
  membershipRole,
  section,
  workspaceLabel
}: {
  latestClosingResult: CloseAccountingPeriodResponse | null;
  ledgerLabel: string;
  ledgerMetaLabel: string;
  membershipRole: string | null;
  section: PeriodWorkspaceSection;
  workspaceLabel: string;
}) {
  const helpCopy = readAccountingPeriodsHelpCopy(section);
  const latestClosingSnapshotFacts = latestClosingResult
    ? [
        {
          label: '마감 월',
          value: latestClosingResult.period.monthLabel
        },
        {
          label: '자산 합계',
          value: formatWon(latestClosingResult.closingSnapshot.totalAssetAmount)
        },
        {
          label: '부채 합계',
          value: formatWon(
            latestClosingResult.closingSnapshot.totalLiabilityAmount
          )
        },
        {
          label: '자본 합계',
          value: formatWon(
            latestClosingResult.closingSnapshot.totalEquityAmount
          )
        },
        {
          label: '당기 손익',
          value: formatWon(latestClosingResult.closingSnapshot.periodPnLAmount)
        }
      ]
    : undefined;
  const latestClosingSnapshotItems = latestClosingResult
    ? latestClosingResult.closingSnapshot.lines.map((line) => {
        const fundingAccountSuffix = line.fundingAccountName
          ? ` / ${line.fundingAccountName}`
          : '';

        return `${line.accountSubjectCode} ${line.accountSubjectName}${fundingAccountSuffix} · ${formatWon(line.balanceAmount)}`;
      })
    : [
        '아직 이 세션에서 생성한 마감 스냅샷이 없습니다. 현재 열린 기간을 마감하면 요약이 화면 도움말에 표시됩니다.'
      ];

  return {
    title: helpCopy.title,
    description: helpCopy.description,
    primaryEntity: helpCopy.primaryEntity,
    relatedEntities: helpCopy.relatedEntities,
    truthSource:
      '운영 기간의 상태가 월별 쓰기 가능 여부를 결정하며, 첫 월 시작 시 입력한 기초 잔액이 이후 마감과 이월의 시작 기준이 됩니다.',
    supplementarySections: [
      {
        title: '현재 이용 기준',
        description:
          '월 운영 시작과 마감은 현재 로그인한 사용자의 사업장과 장부 안에서만 실행됩니다.',
        facts: [
          {
            label: '사업장',
            value: workspaceLabel
          },
          {
            label: '장부',
            value: ledgerLabel
          },
          {
            label: '권한',
            value: readMembershipRoleLabel(membershipRole)
          },
          {
            label: '기준 통화 / 시간대',
            value: ledgerMetaLabel
          }
        ]
      },
      {
        title: helpCopy.sectionTitle,
        description: helpCopy.sectionDescription,
        items: helpCopy.sectionItems
      },
      {
        title: '이어지는 화면',
        links: buildAccountingPeriodsHelpLinks(section)
      },
      {
        title: '최근 마감 스냅샷',
        description: latestClosingResult
          ? '가장 최근에 실행한 월 마감 요약입니다.'
          : '최근 마감 결과는 본문 대신 화면 도움말에서 확인할 수 있습니다.',
        facts: latestClosingSnapshotFacts,
        items: latestClosingSnapshotItems
      }
    ],
    readModelNote: helpCopy.readModelNote
  };
}

function readAccountingPeriodsHelpCopy(section: PeriodWorkspaceSection) {
  switch (section) {
    case 'open':
      return {
        title: '월 운영 시작 도움말',
        description:
          '이 화면은 새 운영 월을 열고 첫 월이라면 기초 잔액 기준까지 함께 잡는 시작 작업 화면입니다.',
        primaryEntity: '운영 월 시작',
        relatedEntities: [
          '기초 잔액 기준',
          '기준 데이터 준비 상태',
          '사업 장부',
          '사용자 권한'
        ],
        sectionTitle: '시작 작업 순서',
        sectionDescription:
          '운영 월을 여는 순간부터 계획, 업로드, 수집 거래가 같은 월 기준으로 움직입니다.',
        sectionItems: [
          '열린 기간이 이미 있는지 먼저 확인하고, 없을 때만 새 운영 월을 엽니다.',
          '첫 운영 월이면 기초 잔액 라인을 1건 이상 입력해 시작 기준을 남깁니다.',
          '자금수단별 기초 잔액 합계가 실제 통장·카드·현금 시작 기준과 맞는지 저장 전 다시 확인합니다.',
          '시작이 끝나면 계획 항목, 업로드 배치, 수집 거래 화면에서 실제 월 운영을 이어갑니다.'
        ],
        readModelNote:
          '첫 월 기초 잔액은 이후 마감과 이월의 시작점이 됩니다. 월을 잘못 열지 않도록 대상 월과 장부 기준을 먼저 확인합니다.'
      };
    case 'close':
      return {
        title: '월 마감 / 재오픈 도움말',
        description:
          '이 화면은 열린 운영 월을 잠그거나, 필요한 잠금 월을 재오픈해야 하는 상황만 집중해서 다루는 작업 화면입니다.',
        primaryEntity: '운영 월 마감 / 재오픈',
        relatedEntities: [
          '전표 준비 거래',
          '월 마감 스냅샷',
          '차기 이월 기록',
          '재무제표'
        ],
        sectionTitle: '마감 / 재오픈 순서',
        sectionDescription:
          '마감은 공식 보고와 차기 이월의 기준을 만드는 작업이고, 재오픈은 꼭 필요한 경우만 사용합니다.',
        sectionItems: [
          '현재 열린 월이 있으면 먼저 미확정 거래와 예외 항목이 남아 있는지 확인합니다.',
          '마감 실행 전 메모를 남겨 두면 이후 운영 메모와 감사 흐름에서 근거를 추적하기 쉽습니다.',
          '마감이 실패하면 오류 메시지의 차단 사유를 기준으로 수집 거래, 업로드, 계획, 보고 자료를 순서대로 정리합니다.',
          '마감 후 정정이 꼭 필요할 때만 재오픈 대상 잠금 월과 사유를 남기고 다시 엽니다.'
        ],
        readModelNote:
          '마감은 미확정 수집 거래가 남아 있으면 실패할 수 있습니다. 차단되면 화면 상단 오류 메시지의 사유를 확인하고 수집 거래와 예외 처리함을 먼저 정리합니다.'
      };
    case 'history':
      return {
        title: '운영 기간 이력 도움말',
        description:
          '이 화면은 운영 기간 상태 변화, 잠금 이력, 시작 기준선을 이력 중심으로 확인하는 검토 화면입니다.',
        primaryEntity: '운영 기간 이력',
        relatedEntities: [
          '기간 상태 이력',
          '기초 잔액 기준',
          '월 마감 스냅샷',
          '차기 이월'
        ],
        sectionTitle: '이력 확인 순서',
        sectionDescription:
          '운영 중 문제가 생겼을 때 현재 월보다 먼저 이력과 시작 기준선이 맞는지 확인합니다.',
        sectionItems: [
          '잠금 월과 현재 열린 월이 어떤 순서로 이어지는지 먼저 봅니다.',
          '기초 잔액 출처와 잠금 이력을 확인해 숫자 기준선이 어디서 시작됐는지 추적합니다.',
          '재오픈이나 다시 마감한 흔적이 있으면 사유와 최근 마감 스냅샷을 함께 비교합니다.',
          '공식 보고 검토가 필요하면 재무제표나 차기 이월 결과 화면으로 이어서 확인합니다.'
        ],
        readModelNote:
          '이력 화면은 상태와 기준선을 읽는 곳입니다. 실제 시작·마감 작업은 각각의 전용 탭에서 진행합니다.'
      };
    case 'overview':
    default:
      return {
        title: '운영 기간 도움말',
        description:
          '이 화면은 현재 운영 월 상태와 다음 작업 방향을 먼저 확인하는 월 운영 허브입니다.',
        primaryEntity: '운영 기간',
        relatedEntities: [
          '기간 상태 이력',
          '기초 잔액 기준',
          '사업 장부',
          '사용자 권한'
        ],
        sectionTitle: '이 화면에서 먼저 볼 것',
        sectionDescription:
          '월 운영 전체 흐름을 보기 전에 현재 열린 월과 준비 상태를 여기서 먼저 확인합니다.',
        sectionItems: [
          '현재 열린 운영 월이 있는지, 잠금 월이 몇 개인지 먼저 확인합니다.',
          '기준 데이터 준비 상태와 권한 조건이 월 운영 시작 또는 마감에 충분한지 확인합니다.',
          '상단 액션으로 새 월 시작, 마감/재오픈, 이력 검토 중 지금 필요한 작업으로 이동합니다.',
          '이후 실제 작업은 월 운영 시작, 월 마감 / 재오픈, 운영 기간 이력 탭으로 나눠 이어갑니다.'
        ],
        readModelNote:
          '운영 기간 상태가 월별 쓰기 가능 범위를 결정합니다. 같은 사업장이라도 열린 월이 없으면 계획, 업로드, 수집 거래 흐름이 제한될 수 있습니다.'
      };
  }
}

function buildAccountingPeriodsHelpLinks(section: PeriodWorkspaceSection) {
  const currentHref =
    section === 'overview'
      ? '/periods'
      : section === 'open'
        ? '/periods/open'
        : section === 'close'
          ? '/periods/close'
          : '/periods/history';

  return [
    {
      title: '운영 기간',
      description: '현재 운영 월 상태와 다음 작업 방향을 먼저 확인합니다.',
      href: '/periods',
      actionLabel: '운영 기간 보기'
    },
    {
      title: '월 운영 시작',
      description: '새 운영 월과 첫 월 기초 잔액 기준을 준비합니다.',
      href: '/periods/open',
      actionLabel: '월 운영 시작 보기'
    },
    {
      title: '월 마감 / 재오픈',
      description:
        '열린 월 마감 또는 필요한 잠금 월 재오픈을 집중해서 처리합니다.',
      href: '/periods/close',
      actionLabel: '월 마감 / 재오픈 보기'
    },
    {
      title: '운영 기간 이력',
      description:
        '운영 기간 상태 변화와 기초 잔액 출처를 이력 중심으로 확인합니다.',
      href: '/periods/history',
      actionLabel: '운영 기간 이력 보기'
    }
  ].filter((link) => link.href !== currentHref);
}

export function buildLatestClosingAlertMessage(
  latestClosingResult: CloseAccountingPeriodResponse
) {
  return `${latestClosingResult.period.monthLabel} 월 마감이 완료되었습니다. 생성된 스냅샷 라인 ${latestClosingResult.closingSnapshot.lines.length}건, 당기손익 ${formatWon(latestClosingResult.closingSnapshot.periodPnLAmount)} 입니다.`;
}

export function buildStatusSectionProps(input: {
  canClosePeriod: boolean;
  canReopenPeriod: boolean;
  currentPeriod: AccountingPeriodItem | null;
  isReadyForMonthlyOperation: boolean;
  openPeriod: AccountingPeriodItem | null;
  reopenPeriod: AccountingPeriodItem | null;
}): React.ComponentProps<typeof CurrentPeriodStatusSection> {
  return input;
}

export function buildPeriodOperationsSectionProps(
  input: React.ComponentProps<typeof PeriodOperationsSection>
) {
  return input;
}

export async function invalidateAccountingPeriodQueries(
  queryClient: QueryClient
) {
  await queryClient.invalidateQueries({
    queryKey: accountingPeriodsQueryKey
  });
  await queryClient.invalidateQueries({
    queryKey: currentAccountingPeriodQueryKey
  });
}
