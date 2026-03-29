'use client';

import { Grid, MenuItem, Stack, TextField } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import { BarChart } from '@mui/x-charts/BarChart';
import { formatWon } from '@/shared/lib/format';
import { ChartCard } from '@/shared/ui/chart-card';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { SectionCard } from '@/shared/ui/section-card';
import { StatusChip } from '@/shared/ui/status-chip';
import { SummaryCard } from '@/shared/ui/summary-card';
import { TransactionForm } from '@/features/transactions/transaction-form';
import { mockCollectedTransactions } from '@/features/transactions/transactions.api';

const columns: GridColDef<(typeof mockCollectedTransactions)[number]>[] = [
  { field: 'businessDate', headerName: '거래일', flex: 0.8 },
  { field: 'title', headerName: '적요', flex: 1.2 },
  { field: 'categoryName', headerName: '카테고리', flex: 1 },
  {
    field: 'status',
    headerName: '상태',
    flex: 0.8,
    renderCell: (params) => <StatusChip label={String(params.value)} />
  },
  {
    field: 'amountWon',
    headerName: '금액',
    flex: 1,
    valueFormatter: (value) => formatWon(Number(value))
  }
];

export function DesignSystemPage() {
  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="UI 기준"
        title="디자인 시스템 샘플"
        description="도메인 화면 전반에서 재사용하는 카드, 표, 차트, 폼 패턴을 확인하는 내부 기준 페이지입니다."
      />
      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard title="지표 01" value={formatWon(3200000)} subtitle="공통 요약 카드" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard title="지표 02" value={formatWon(1465000)} subtitle="공통 요약 카드" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard title="지표 03" value={formatWon(540000)} subtitle="공통 요약 카드" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard title="지표 04" value={formatWon(1835000)} subtitle="공통 요약 카드" />
        </Grid>
      </Grid>
      <SectionCard
        title="필터 도구 모음"
        description="목록 중심 화면에서 재사용하는 필터 간격과 입력 리듬의 기준입니다."
      >
        <Grid container spacing={appLayout.fieldGap}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField label="키워드" size="small" />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField select label="유형" size="small" defaultValue="ALL">
              <MenuItem value="ALL">전체</MenuItem>
              <MenuItem value="INCOME">수입</MenuItem>
              <MenuItem value="EXPENSE">지출</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField label="월" size="small" defaultValue="2026-03" />
          </Grid>
        </Grid>
      </SectionCard>
      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, xl: 7 }}>
          <DataTableCard
            title="기본 테이블"
            description="기능 단위 표 화면에서 사용하는 기본 그리드 표현입니다."
            rows={mockCollectedTransactions}
            columns={columns}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 5 }}>
          <ChartCard
            title="기본 차트"
            description="차트는 도메인 화면과 동일한 카드 셸 안에서 유지됩니다."
            chart={
              <BarChart
                height={320}
                xAxis={[{ scaleType: 'band', data: ['수입', '지출', '반복', '예비자금'] }]}
                series={[{ data: [3200000, 1465000, 540000, 400000] }]}
              />
            }
          />
        </Grid>
      </Grid>
      <SectionCard
        title="기본 입력 폼"
        description="수집 거래 화면에서 재사용하는 입력 블록 예시입니다."
      >
        <TransactionForm currentPeriod={null} />
      </SectionCard>
    </Stack>
  );
}
