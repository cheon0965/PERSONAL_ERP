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
  const canOpenPeriod =
    membershipRole === 'OWNER' || membershipRole === 'MANAGER';
  const canClosePeriod = membershipRole === 'OWNER';
  const canReopenPeriod = membershipRole === 'OWNER';
  const isFirstPeriod = periods.length === 0;
  const openPeriod =
    periods.find((period) => period.status !== 'LOCKED') ?? null;
  const latestPeriod = periods[0] ?? null;
  const reopenPeriod = latestPeriod?.status === 'LOCKED' ? latestPeriod : null;
  const currentPeriod = openPeriod ?? latestPeriod ?? null;
  const lockedPeriodCount = periods.filter(
    (period) => period.status === 'LOCKED'
  ).length;
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
          ? '열린 운영 월의 마감과 최근 잠금 월 재오픈 여부를 별도 작업 화면에서 관리합니다.'
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
    lockedPeriodCount,
    openingBalanceFundingAccounts,
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
  workspaceLabel
}: {
  latestClosingResult: CloseAccountingPeriodResponse | null;
  ledgerLabel: string;
  ledgerMetaLabel: string;
  membershipRole: string | null;
  workspaceLabel: string;
}) {
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
        '아직 이 세션에서 생성한 마감 스냅샷이 없습니다. 현재 열린 기간을 마감하면 요약이 도메인 가이드에 표시됩니다.'
      ];

  return {
    title: '월 운영 사용 가이드',
    description:
      '이 화면은 한 달 운영을 열고 닫는 기준점입니다. 운영 기간을 열어야 계획 항목, 업로드 승격, 수집 거래 입력, 전표 확정이 같은 월 안에서 움직입니다.',
    primaryEntity: '운영 기간',
    relatedEntities: [
      '기간 상태 이력',
      '기초 잔액 기준',
      '사업 장부',
      '사용자 권한'
    ],
    truthSource:
      '운영 기간의 상태가 월별 쓰기 가능 여부를 결정하며, 첫 월 시작 시 입력한 기초 잔액이 이후 마감과 이월의 시작 기준이 됩니다.',
    supplementarySections: [
      {
        title: '현재 작업 문맥',
        description:
          '월 운영 시작과 마감은 현재 로그인한 사용자의 사업 장부 문맥 안에서만 실행됩니다.',
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
            value: membershipRole ?? '-'
          },
          {
            label: '기준 통화 / 시간대',
            value: ledgerMetaLabel
          }
        ]
      },
      {
        title: '바로 쓰는 순서',
        description:
          '월 운영은 시작, 진행, 마감, 필요 시 재오픈 순서로 다룹니다.',
        items: [
          '열린 기간이 없으면 기준 데이터 readiness를 확인한 뒤 월 운영 시작에서 대상 월을 엽니다.',
          '첫 월이면 기초 잔액 라인을 1건 이상 입력해 시작 기준을 남깁니다.',
          '열린 기간이 있으면 계획 항목, 업로드 배치, 수집 거래 화면에서 월 운영을 진행합니다.',
          '전표 준비 거래를 모두 확정한 뒤 월 마감에서 현재 열린 월을 잠급니다.',
          '마감 후 정정이 필요할 때만 재오픈 사유를 남기고 다시 엽니다.'
        ]
      },
      {
        title: '최근 마감 스냅샷',
        description: latestClosingResult
          ? '가장 최근에 실행한 월 마감 요약입니다.'
          : '최근 마감 결과는 본문 대신 도메인 가이드에서 확인할 수 있습니다.',
        facts: latestClosingSnapshotFacts,
        items: latestClosingSnapshotItems
      }
    ],
    readModelNote:
      '마감은 미확정 수집 거래가 남아 있으면 실패할 수 있습니다. 막히면 수집 거래 화면에서 전표 준비와 확정 상태를 먼저 정리합니다.'
  };
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
