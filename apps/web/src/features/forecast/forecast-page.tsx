'use client';

import * as React from 'react';
import { Stack } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { appLayout } from '@/shared/ui/layout-metrics';
import { SegmentedTabs } from '@/shared/ui/section-tabs';
import {
  accountingPeriodsQueryKey,
  getAccountingPeriods
} from '@/features/accounting-periods/accounting-periods.api';
import {
  FORECAST_TABS,
  ForecastContent,
  ForecastMissingPeriodState,
  ForecastPeriodSelectionSection,
  ForecastUnavailableState,
  readBasisStatusLabel,
  readPeriodStatusLabel
} from './forecast-page.sections';
import type { ForecastTab } from './forecast-page.sections';
import { getForecast } from './forecast.api';

export function ForecastPage() {
  const periodsQuery = useQuery({
    queryKey: accountingPeriodsQueryKey,
    queryFn: getAccountingPeriods
  });
  const periods = periodsQuery.data ?? [];
  const defaultPeriodId =
    periods.find((period) => period.status !== 'LOCKED')?.id ??
    periods[0]?.id ??
    '';
  const [selectedPeriodId, setSelectedPeriodId] = React.useState<string>('');
  const [activeTab, setActiveTab] = React.useState<ForecastTab>('summary');

  React.useEffect(() => {
    if (!selectedPeriodId && defaultPeriodId) {
      setSelectedPeriodId(defaultPeriodId);
    }
  }, [defaultPeriodId, selectedPeriodId]);

  const selectedPeriod =
    periods.find((period) => period.id === selectedPeriodId) ?? null;
  const forecastQuery = useQuery({
    queryKey: ['forecast', selectedPeriodId || 'none'],
    queryFn: () => getForecast({ periodId: selectedPeriodId || null }),
    enabled: Boolean(selectedPeriodId)
  });
  const forecast = forecastQuery.data;

  useDomainHelp({
    title: '기간 운영 전망 사용 가이드',
    description:
      '이 화면은 선택한 운영 월의 확정 전표와 남은 계획을 함께 읽어 월말 예상 잔액과 안전 여력을 판단하는 곳입니다. 다음 달 운영 준비 상태를 볼 때도 사용합니다.',
    primaryEntity: '운영 월',
    relatedEntities: ['계획 항목', '전표', '월 마감 스냅샷', '공식 재무제표'],
    truthSource:
      '잠금된 기간의 공식 기준은 월 마감 결과와 공식 재무제표이며, 전망은 마감 전 운영 판단용 수치입니다.',
    supplementarySections: [
      {
        title: '바로 쓰는 순서',
        items: [
          '전망 대상 선택에서 열린 운영 월 또는 다시 볼 잠금 월을 고릅니다.',
          '상단 상태 칩으로 운영 전망 기준인지 공식 잠금 기준인지 먼저 구분합니다.',
          '현재 자금 잔액, 예상 수입, 남은 계획 지출, 안전 잉여를 확인합니다.',
          '전망 드라이버에서 어떤 확정 전표와 남은 계획이 계산에 들어갔는지 확인합니다.',
          '공식 비교 카드와 화면 도움말의 참고 메모를 함께 읽어 잠금 기준 숫자와 해석 포인트를 확인합니다.'
        ]
      },
      {
        title: '막히면 확인',
        items: [
          '운영 기간이 없으면 월 운영 화면에서 먼저 월을 엽니다.',
          '계획이 비어 있으면 계획 항목 화면에서 선택 월의 계획 항목을 생성합니다.',
          '확정 지출이 기대와 다르면 전표 조회 또는 수집 거래 화면에서 전표 반영 상태를 확인합니다.'
        ]
      },
      {
        title: '이어지는 화면',
        links: [
          {
            title: '계획 항목',
            description:
              '남은 계획 지출을 줄이거나 누락된 월 계획을 생성합니다.',
            href: '/plan-items',
            actionLabel: '계획 항목 보기'
          },
          {
            title: '수집 거래',
            description:
              '전망에 반영되지 않은 실제 입출금 후보를 보완하고 전표로 확정합니다.',
            href: '/transactions',
            actionLabel: '수집 거래 보기'
          },
          {
            title: '월 마감',
            description:
              '전망 확인 후 마감 가능 여부와 차단 사유를 운영 관점에서 점검합니다.',
            href: '/operations/month-end',
            actionLabel: '월 마감 보기'
          },
          {
            title: '재무제표 생성 / 선택',
            description:
              '잠금된 월의 공식 보고 숫자와 전망 숫자를 비교합니다.',
            href: '/financial-statements',
            actionLabel: '재무제표 보기'
          }
        ]
      },
      {
        title: '참고 메모',
        description:
          '본문의 참고사항은 화면 도움말로 옮겨 관리합니다. 전망을 해석할 때 아래 메모를 함께 확인합니다.',
        items:
          forecast?.notes.length
            ? forecast.notes
            : [
                '전망 메모가 아직 없으면 현재 확정 전표, 남은 계획, 공식 비교 기준을 먼저 확인합니다.'
              ]
      }
    ],
    readModelNote:
      '전망은 공식 보고서가 아닙니다. 잠금 전 기간에서는 수치가 계속 움직일 수 있으므로 경고와 공식 비교 카드를 함께 봅니다.'
  });

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="기간 운영"
        title="기간 운영 전망"
        description="선택한 운영 월의 확정 전표와 남은 계획을 함께 읽어 예상 월말 잔액과 안전 여력을 계산합니다."
        badges={[
          {
            label: selectedPeriod
              ? `${selectedPeriod.monthLabel} 선택`
              : '운영 기간 선택 필요',
            color: selectedPeriod ? 'primary' : 'warning'
          },
          ...(forecast
            ? [
                {
                  label: readBasisStatusLabel(forecast.basisStatus),
                  color:
                    forecast.basisStatus === 'OFFICIAL_LOCKED'
                      ? ('info' as const)
                      : ('warning' as const)
                }
              ]
            : [])
        ]}
        metadata={[
          {
            label: '대상 상태',
            value: selectedPeriod
              ? readPeriodStatusLabel(selectedPeriod.status)
              : '-'
          },
          {
            label: '최근 공식 비교',
            value: forecast?.officialComparison?.monthLabel ?? '없음'
          }
        ]}
        primaryActionLabel="대시보드 보기"
        primaryActionHref="/dashboard"
        secondaryActionLabel="운영 월 보기"
        secondaryActionHref="/periods"
      />

      <SegmentedTabs
        items={FORECAST_TABS}
        value={activeTab}
        onChange={setActiveTab}
        ariaLabel="전망 탭 선택"
      />

      {periodsQuery.error ? (
        <QueryErrorAlert
          title="운영 기간 목록을 불러오지 못했습니다."
          error={periodsQuery.error}
        />
      ) : null}

      {forecastQuery.error ? (
        <QueryErrorAlert
          title="전망 조회에 실패했습니다."
          error={forecastQuery.error}
        />
      ) : null}

      <ForecastPeriodSelectionSection
        periods={periods}
        selectedPeriodId={selectedPeriodId}
        selectedPeriod={selectedPeriod}
        onSelectedPeriodChange={setSelectedPeriodId}
      />

      {!selectedPeriod ? (
        <ForecastMissingPeriodState />
      ) : forecast == null ? (
        <ForecastUnavailableState />
      ) : (
        <ForecastContent forecast={forecast} activeTab={activeTab} />
      )}
    </Stack>
  );
}
