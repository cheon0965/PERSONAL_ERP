'use client';

import { useQuery } from '@tanstack/react-query';
import { Grid, List, ListItem, ListItemText, Stack } from '@mui/material';
import { formatWon } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import { appLayout } from '@/shared/ui/layout-metrics';
import { SummaryCard } from '@/shared/ui/summary-card';
import { getForecast } from './forecast.api';

export function ForecastPage() {
  const { data, error } = useQuery({
    queryKey: ['forecast', '2026-03'],
    queryFn: () => getForecast('2026-03')
  });

  useDomainHelp({
    title: '기간 운영 전망 개요',
    description:
      '전망 화면은 기간 운영 판단을 돕는 해석 화면입니다. 공식 숫자는 잠금 이후 스냅샷과 재무제표에서 확정합니다.',
    primaryEntity: '운영 기간 (AccountingPeriod)',
    relatedEntities: [
      '계획 항목 (PlanItem)',
      '반복 규칙 (RecurringRule)',
      '전표 (JournalEntry)',
      '자금수단 (FundingAccount)'
    ],
    truthSource: '공식 수치와 보고 기준은 ClosingSnapshot 및 FinancialStatementSnapshot에 둡니다.',
    readModelNote: '현재 전망 값은 운영 의사결정용이며, 마감 후 확정 재무제표와는 구분됩니다.'
  });

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="기간 운영"
        title="기간 운영 전망"
        description="이 화면은 AccountingPeriod 안에서 확정 전표와 계획 데이터를 함께 보는 읽기 모델입니다. 공식 재무제표 확정 전 단계의 운영 전망을 제공합니다."
      />
      {error ? <QueryErrorAlert title="전망 조회에 실패했습니다." error={error} /> : null}
      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, md: 3 }}>
          <SummaryCard title="현재 자금 잔액" value={formatWon(data?.actualBalanceWon ?? 0)} />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <SummaryCard title="남은 계획 지출" value={formatWon(data?.remainingRecurringWon ?? 0)} />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <SummaryCard
            title="예상 기간말 잔액"
            value={formatWon(data?.expectedMonthEndBalanceWon ?? 0)}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <SummaryCard title="안전 잉여" value={formatWon(data?.safetySurplusWon ?? 0)} />
        </Grid>
      </Grid>
      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <SectionCard
            title="전망 계산 기준"
            description="MVP 단계에서는 확정 전표와 계획 데이터를 분리한 채, 검토 가능한 계산식으로 유지합니다."
          >
            <List disablePadding>
              <ListItem disableGutters>
                <ListItemText
                  primary="현재 자금 잔액"
                  secondary={formatWon(data?.actualBalanceWon ?? 0)}
                />
              </ListItem>
              <ListItem disableGutters>
                <ListItemText
                  primary="확정 전표 지출"
                  secondary={formatWon(data?.confirmedExpenseWon ?? 0)}
                />
              </ListItem>
              <ListItem disableGutters>
                <ListItemText
                  primary="남은 계획 지출"
                  secondary={formatWon(data?.remainingRecurringWon ?? 0)}
                />
              </ListItem>
              <ListItem disableGutters>
                <ListItemText primary="적립금" secondary={formatWon(data?.sinkingFundWon ?? 0)} />
              </ListItem>
              <ListItem disableGutters>
                <ListItemText
                  primary="최소 예비자금"
                  secondary={formatWon(data?.minimumReserveWon ?? 0)}
                />
              </ListItem>
            </List>
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <SectionCard
            title="참고사항"
            description="잠금 전 전망과 공식 재무제표를 혼동하지 않도록 범위와 가정을 명시적으로 드러냅니다."
          >
            <List disablePadding>
              {(data?.notes ?? []).map((note) => (
                <ListItem key={note} disableGutters>
                  <ListItemText primary={note} />
                </ListItem>
              ))}
            </List>
          </SectionCard>
        </Grid>
      </Grid>
    </Stack>
  );
}
