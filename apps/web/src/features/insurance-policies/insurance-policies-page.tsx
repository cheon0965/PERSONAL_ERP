'use client';

import { useQuery } from '@tanstack/react-query';
import { Grid, Stack } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import type { InsurancePolicyItem } from '@personal-erp/contracts';
import { formatDate, formatWon } from '@/shared/lib/format';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { DomainContextCard } from '@/shared/ui/domain-context-card';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SummaryCard } from '@/shared/ui/summary-card';
import { getInsurancePolicies } from './insurance-policies.api';

const cycleLabelMap: Record<string, string> = {
  MONTHLY: '매월',
  YEARLY: '매년'
};

const columns: GridColDef<InsurancePolicyItem>[] = [
  { field: 'provider', headerName: '보험사', flex: 1 },
  { field: 'productName', headerName: '상품명', flex: 1.4 },
  {
    field: 'monthlyPremiumWon',
    headerName: '월 보험료',
    flex: 1,
    valueFormatter: (value) => formatWon(Number(value))
  },
  { field: 'paymentDay', headerName: '납부일', flex: 0.7 },
  {
    field: 'cycle',
    headerName: '주기',
    flex: 0.8,
    valueFormatter: (value) => cycleLabelMap[String(value)] ?? String(value)
  },
  {
    field: 'renewalDate',
    headerName: '갱신일',
    flex: 1,
    valueFormatter: (value) => formatDate(String(value))
  }
];

export function InsurancePoliciesPage() {
  const { data = [], error } = useQuery({
    queryKey: ['insurance-policies'],
    queryFn: getInsurancePolicies
  });
  const totalPremium = data.reduce((acc, item) => acc + item.monthlyPremiumWon, 0);
  const upcomingRenewalCount = data.filter((item) => {
    if (!item.renewalDate) {
      return false;
    }

    const diffDays =
      (new Date(item.renewalDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);

    return diffDays >= 0 && diffDays <= 60;
  }).length;

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="보조 운영 영역"
        title="보험 계약"
        description="보험 계약은 코어 회계 엔티티 자체가 아니라 반복 규칙과 수집 거래를 설명하는 운영 보조 데이터로 관리합니다."
      />
      {error ? <QueryErrorAlert title="보험 정보 조회에 실패했습니다." error={error} /> : null}

      <DomainContextCard
        description="보험 화면은 공식 장부가 아니라 추후 계획 지출과 실제 지급 흐름을 잇는 보조 화면입니다."
        primaryEntity="보험 계약 보조 데이터"
        relatedEntities={[
          '반복 규칙 (RecurringRule)',
          '계획 항목 (PlanItem)',
          '수집 거래 (CollectedTransaction)',
          '전표 (JournalEntry)'
        ]}
        truthSource="보험 계약 자체는 회계 저장이 아니며 실제 회계 확정은 수집 거래와 전표에서 이뤄집니다."
        readModelNote="월 보험료와 갱신일은 운영 판단을 위한 보조 지표입니다."
      />

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, md: 4 }}>
          <SummaryCard
            title="월 보험 계획액"
            value={formatWon(totalPremium)}
            subtitle="반복 규칙으로 연결될 수 있는 월 기준 보험료 합계"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <SummaryCard title="계약 수" value={String(data.length)} subtitle="관리 중인 보험 계약" />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <SummaryCard
            title="가까운 갱신"
            value={String(upcomingRenewalCount)}
            subtitle="60일 이내 갱신 예정 계약"
          />
        </Grid>
      </Grid>
      <DataTableCard
        title="보험 계약 목록"
        description="계약 자체를 회계 저장으로 취급하지 않고, 계획과 검토에 필요한 필드 중심으로 보여줍니다."
        rows={data}
        columns={columns}
      />
    </Stack>
  );
}