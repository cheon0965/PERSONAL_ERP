'use client';

import { Stack } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import {
  DashboardEmptyState,
  DashboardSummarySections,
  readBasisStatusLabel,
  readPeriodStatusLabel
} from './dashboard-page.sections';
import { getDashboardSummary } from './dashboard.api';

export function DashboardPage() {
  const { status, user } = useAuthSession();
  const currentWorkspace = user?.currentWorkspace ?? null;
  const summaryQuery = useQuery({
    queryKey: [
      'dashboard-summary',
      user?.id ?? 'anonymous',
      currentWorkspace?.tenant.id ?? 'no-tenant',
      currentWorkspace?.ledger?.id ?? 'no-ledger'
    ],
    queryFn: () => getDashboardSummary(),
    enabled: status === 'authenticated' && Boolean(user)
  });

  useDomainHelp({
    title: '월 운영 대시보드 화면 도움말',
    description:
      '대시보드는 월 운영 사이클 중간중간 현재 자금 상태, 확정 지출, 남은 계획, 안전 잉여를 빠르게 읽는 점검 화면입니다.',
    primaryEntity: '사업 장부 / 운영 월',
    relatedEntities: [
      '계획 항목',
      '전표와 전표 라인',
      '월 마감 스냅샷',
      '공식 재무제표'
    ],
    truthSource:
      '공식 수치는 마감 완료된 월의 마감 스냅샷과 공식 재무제표를 기준으로 확인합니다.',
    supplementarySections: [
      {
        title: '작업 진행 순서',
        items: [
          '상단 운영 기간과 기준 상태를 확인해 현재 화면이 열린 월 기준인지 공식 잠금 기준인지 구분합니다.',
          '현재 자금 잔액과 안전 잉여로 단기 운영 여력을 봅니다.',
          '확정 전표 지출과 남은 계획 지출을 비교해 아직 확정하지 않은 비용을 찾습니다.',
          '최근 기간 추이에서 수입, 확정 지출, 남은 계획 지출의 흐름을 확인합니다.',
          '더 자세히 판단하려면 운영 전망 보기로 이동합니다.'
        ]
      },
      {
        title: '언제 확인하나',
        items: [
          '월 운영을 연 직후 기준 상태를 빠르게 확인합니다.',
          '계획 항목 생성 후 남은 계획 지출이 반영됐는지 봅니다.',
          '수집 거래를 전표로 확정한 뒤 확정 지출이 반영됐는지 봅니다.',
          '월 마감 직전 이상 징후가 없는지 마지막으로 확인합니다.'
        ]
      },
      {
        title: '이어지는 화면',
        links: [
          {
            title: '기간 운영 전망',
            description:
              '월말 예상 잔액과 안전 여력을 더 자세히 해석할 때 이어서 확인합니다.',
            href: '/forecast',
            actionLabel: '기간 전망 보기'
          },
          {
            title: '재무제표 생성 / 선택',
            description:
              '공식 잠금 기준 숫자와 전기 비교가 필요할 때 이동합니다.',
            href: '/financial-statements',
            actionLabel: '재무제표 보기'
          },
          {
            title: '전표 조회',
            description:
              '확정 지출 근거가 되는 전표 라인과 조정 흐름을 확인합니다.',
            href: '/journal-entries',
            actionLabel: '전표 보기'
          },
          {
            title: '이월 기준 생성 / 선택',
            description:
              '다음 월 시작 기준까지 이어서 확인하려면 차기 이월 화면으로 이동합니다.',
            href: '/carry-forwards',
            actionLabel: '차기 이월 보기'
          }
        ]
      }
    ],
    readModelNote:
      '이 화면의 카드와 추이는 운영 판단용입니다. 공식 보고 숫자는 월 마감 후 재무제표 화면의 스냅샷을 기준으로 확인합니다.'
  });

  const summary = summaryQuery.data;

  if (summaryQuery.error) {
    return (
      <Stack spacing={appLayout.pageGap}>
        <PageHeader
          eyebrow="장부 운영"
          title="월 운영 대시보드"
          description="현재 운영 월을 기준으로 사업 현황을 요약해 보여주는 화면입니다."
        />
        <QueryErrorAlert
          title="대시보드 요약 조회에 실패했습니다."
          error={summaryQuery.error}
        />
      </Stack>
    );
  }

  if (!summary) {
    return (
      <Stack spacing={appLayout.pageGap}>
        <PageHeader
          eyebrow="장부 운영"
          title="월 운영 대시보드"
          description="현재 운영 월을 기준으로 사업 현황을 요약해 보여주는 화면입니다."
        />
        <DashboardEmptyState />
      </Stack>
    );
  }

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="장부 운영"
        title="월 운영 대시보드"
        description="현재 운영 월의 운영 숫자와 최근 공식 숫자를 구분해 보면서 월간 판단 흐름을 빠르게 점검합니다."
        badges={[
          {
            label: `${summary.period.monthLabel} 운영 월`,
            color: 'primary'
          },
          {
            label: readBasisStatusLabel(summary.basisStatus),
            color:
              summary.basisStatus === 'OFFICIAL_LOCKED' ? 'info' : 'warning'
          }
        ]}
        metadata={[
          {
            label: '기간 상태',
            value: readPeriodStatusLabel(summary.period.status)
          },
          {
            label: '최근 공식 비교',
            value: summary.officialComparison?.monthLabel ?? '없음'
          },
          {
            label: '주의 항목',
            value: `${summary.warnings.length}건`
          }
        ]}
        primaryActionLabel="운영 전망 보기"
        primaryActionHref="/forecast"
        secondaryActionLabel="재무제표 보기"
        secondaryActionHref="/financial-statements"
      />
      <DashboardSummarySections summary={summary} />
    </Stack>
  );
}
