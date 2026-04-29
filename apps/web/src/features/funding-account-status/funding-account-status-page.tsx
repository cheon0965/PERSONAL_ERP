'use client';

import * as React from 'react';
import { Stack } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import type { FundingAccountOverviewBasis } from '@personal-erp/contracts';
import {
  accountingPeriodsQueryKey,
  getAccountingPeriods
} from '@/features/accounting-periods/accounting-periods.api';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import {
  fundingAccountStatusQueryKey,
  getFundingAccountStatusSummary
} from './funding-account-status.api';
import {
  FundingAccountStatusContent,
  FundingAccountStatusControls,
  FundingAccountStatusEmptyState,
  readFundingAccountOverviewBasisLabel,
  readPeriodStatusLabel
} from './funding-account-status-page.sections';

export function FundingAccountStatusPage() {
  const [basis, setBasis] =
    React.useState<FundingAccountOverviewBasis>('COLLECTED_TRANSACTIONS');
  const [selectedPeriodId, setSelectedPeriodId] = React.useState('');
  const [selectedFundingAccountId, setSelectedFundingAccountId] =
    React.useState('');

  const periodsQuery = useQuery({
    queryKey: accountingPeriodsQueryKey,
    queryFn: getAccountingPeriods
  });
  const periods = periodsQuery.data ?? [];
  const summaryInput = {
    basis,
    periodId: selectedPeriodId || null,
    fundingAccountId: selectedFundingAccountId || null
  };
  const summaryQuery = useQuery({
    queryKey: fundingAccountStatusQueryKey(summaryInput),
    queryFn: () => getFundingAccountStatusSummary(summaryInput)
  });
  const summary = summaryQuery.data ?? null;
  const selectedPeriod =
    periods.find((period) => period.id === selectedPeriodId) ??
    summary?.period ??
    null;

  useDomainHelp({
    title: '자금수단별 현황 사용 가이드',
    description:
      '자금수단별 현황은 등록한 통장, 카드, 현금별로 월초 잔액부터 수입, 지출, 이체, 예상 기간말 잔액까지 한 화면에서 비교하는 월별 재무관리 화면입니다.',
    primaryEntity: '자금수단',
    relatedEntities: ['수집 거래', '전표', '계획 항목', '월 마감 스냅샷'],
    truthSource:
      '공식 보고 수치는 잠금된 기간의 전표와 마감 스냅샷이며, 수집 거래 기준은 월중 운영 판단용으로 사용합니다.',
    supplementarySections: [
      {
        title: '바로 쓰는 순서',
        items: [
          '조회 기준에서 운영 월과 자금수단을 선택합니다.',
          '수집 거래 기준으로 월중 실제 사용 흐름과 미확정 거래를 먼저 확인합니다.',
          '확정 전표 기준으로 공식 숫자에 반영된 수입과 지출만 다시 검토합니다.',
          '자금수단 카드에서 예상 기간말 잔액과 미확정 거래 수를 확인합니다.',
          '거래 내역에서 이상 금액을 찾으면 수집 거래 또는 전표 조회 화면으로 이동합니다.'
        ]
      },
      {
        title: '화면 조작 팁',
        items: [
          '자금수단 선택을 전체로 두면 계정 간 비교가 쉽고, 특정 계정으로 좁히면 잔액 변동 원인을 찾기 쉽습니다.',
          '기준 토글을 바꿔도 같은 운영 월을 유지하므로 수집 거래 기준과 확정 전표 기준 차이를 바로 비교할 수 있습니다.',
          '미확정 거래 수가 남아 있으면 공식 숫자보다 운영 기준 잔액이 먼저 움직일 수 있습니다.'
        ]
      },
      {
        title: '막히면 확인',
        items: [
          '자금수단이 보이지 않으면 기준 데이터의 자금수단 등록 상태를 확인합니다.',
          '확정 전표 기준 숫자가 작으면 수집 거래의 전표 반영 상태를 확인합니다.',
          '시작 잔액이 0원으로 보이면 운영 월의 오프닝 잔액 스냅샷을 확인합니다.'
        ]
      },
      {
        title: '이어지는 화면',
        links: [
          {
            title: '수집 거래',
            description:
              '미확정 거래를 보완하거나 전표 준비 상태 거래를 확정합니다.',
            href: '/transactions',
            actionLabel: '수집 거래 보기'
          },
          {
            title: '전표 조회',
            description:
              '확정 전표 기준 잔액에 반영된 공식 라인을 추적합니다.',
            href: '/journal-entries',
            actionLabel: '전표 보기'
          },
          {
            title: '자금수단 관리',
            description:
              '통장, 카드, 현금 계정의 활성 상태와 기초 등록 상태를 정리합니다.',
            href: '/reference-data/funding-accounts',
            actionLabel: '자금수단 보기'
          }
        ]
      }
    ],
    readModelNote:
      '이 화면은 자금수단을 기준으로 돈의 위치와 흐름을 보는 읽기 모델입니다. 공식 재무제표와 월중 운영 판단을 기준 토글로 분리합니다.'
  });

  const headerMonthLabel =
    selectedPeriod?.monthLabel ?? (selectedPeriodId ? '선택 기간' : '자동 선택');
  const headerPeriodStatus = selectedPeriod
    ? readPeriodStatusLabel(selectedPeriod.status)
    : '기간 확인 중';

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="보고 / 판단"
        title="자금수단별 현황"
        description="등록한 통장, 카드, 현금별로 월 수입과 지출, 이체, 잔액 흐름을 비교하고 운영 기준과 공식 기준을 분리해서 확인합니다."
        badges={[
          {
            label: `${headerMonthLabel} · ${headerPeriodStatus}`,
            color: selectedPeriod ? 'primary' : 'warning'
          },
          {
            label: readFundingAccountOverviewBasisLabel(basis),
            color: basis === 'POSTED_JOURNALS' ? 'info' : 'warning'
          }
        ]}
        metadata={[
          {
            label: '자금수단',
            value: summary
              ? `${summary.totals.fundingAccountCount}개`
              : '조회 중'
          },
          {
            label: '미확정 거래',
            value: summary
              ? `${summary.totals.pendingTransactionCount}건`
              : '조회 중'
          }
        ]}
        primaryActionLabel="수집 거래 보기"
        primaryActionHref="/transactions"
        secondaryActionLabel="자금수단 관리"
        secondaryActionHref="/reference-data/funding-accounts"
      />

      {periodsQuery.error ? (
        <QueryErrorAlert
          title="운영 기간 목록을 불러오지 못했습니다."
          error={periodsQuery.error}
        />
      ) : null}

      {summaryQuery.error ? (
        <QueryErrorAlert
          title="자금수단별 현황을 불러오지 못했습니다."
          error={summaryQuery.error}
        />
      ) : null}

      <FundingAccountStatusControls
        periods={periods}
        accounts={summary?.accounts ?? []}
        basis={basis}
        selectedPeriodId={selectedPeriodId}
        selectedFundingAccountId={selectedFundingAccountId}
        loading={summaryQuery.isFetching}
        onBasisChange={setBasis}
        onSelectedPeriodChange={setSelectedPeriodId}
        onSelectedFundingAccountChange={setSelectedFundingAccountId}
        onClearFilters={() => {
          setSelectedPeriodId('');
          setSelectedFundingAccountId('');
        }}
      />

      {summary ? (
        <FundingAccountStatusContent
          summary={summary}
          selectedFundingAccountId={
            summary.selectedFundingAccountId ?? selectedFundingAccountId
          }
          onSelectFundingAccount={setSelectedFundingAccountId}
        />
      ) : (
        <FundingAccountStatusEmptyState />
      )}
    </Stack>
  );
}
