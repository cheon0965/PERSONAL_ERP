'use client';

import * as React from 'react';
import {
  Alert,
  Chip,
  Grid,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { BarChart } from '@mui/x-charts/BarChart';
import { formatWon } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { ChartCard } from '@/shared/ui/chart-card';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import { appLayout } from '@/shared/ui/layout-metrics';
import { SummaryCard } from '@/shared/ui/summary-card';
import {
  accountingPeriodsQueryKey,
  getAccountingPeriods
} from '@/features/accounting-periods/accounting-periods.api';
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
  const trend = [...(forecast?.trend ?? [])].reverse();

  useDomainHelp({
    title: '기간 운영 전망 개요',
    description:
      '전망 화면은 AccountingPeriod 기준으로 확정 전표, 남은 계획, 적립 가정을 한 자리에서 비교하는 운영 판단용 화면입니다.',
    primaryEntity: '운영 기간 (AccountingPeriod)',
    relatedEntities: [
      '계획 항목 (PlanItem)',
      '전표 (JournalEntry)',
      '마감 스냅샷 (ClosingSnapshot)',
      '재무제표 스냅샷 (FinancialStatementSnapshot)'
    ],
    truthSource:
      '잠금된 기간의 공식 기준은 ClosingSnapshot 및 FinancialStatementSnapshot이며, 전망은 그 이전 운영 해석 계층입니다.',
    readModelNote:
      '잠금 전 기간에서는 전망 수치가 공식 확정치보다 앞서 움직일 수 있으므로 경고와 비교 카드를 함께 봐야 합니다.'
  });

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="기간 운영"
        title="기간 운영 전망"
        description="선택한 운영 기간의 확정 전표와 남은 계획을 함께 읽어 예상 기간말 잔액과 안전 여력을 계산합니다."
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

      <SectionCard
        title="전망 대상 선택"
        description="전망은 특정 AccountingPeriod를 기준으로 계산됩니다."
      >
        <TextField
          select
          label="운영 기간"
          value={selectedPeriodId}
          onChange={(event) => setSelectedPeriodId(event.target.value)}
          helperText={
            periods.length > 0
              ? '열린 기간을 우선 추천하지만, 잠금된 기간도 공식 결과와 비교할 용도로 다시 볼 수 있습니다.'
              : '아직 생성된 운영 기간이 없습니다.'
          }
          disabled={periods.length === 0}
        >
          {periods.map((period) => (
            <MenuItem key={period.id} value={period.id}>
              {period.monthLabel} · {readPeriodStatusLabel(period.status)}
            </MenuItem>
          ))}
        </TextField>
      </SectionCard>

      {!selectedPeriod ? (
        <SectionCard
          title="표시할 운영 기간이 없습니다"
          description="전망 화면은 AccountingPeriod가 하나 이상 있어야 동작합니다."
        >
          <Typography variant="body2" color="text.secondary">
            먼저 운영 기간을 열어 두면 period-aware 전망을 계산할 수 있습니다.
          </Typography>
        </SectionCard>
      ) : forecast == null ? (
        <SectionCard
          title="전망 데이터가 없습니다"
          description="선택한 운영 기간의 읽기 모델을 아직 만들 수 없습니다."
        >
          <Typography variant="body2" color="text.secondary">
            이 기간에 전표나 계획 항목이 아직 없거나, 기간 자체가 아직 준비되지
            않았을 수 있습니다.
          </Typography>
        </SectionCard>
      ) : (
        <Stack spacing={appLayout.sectionGap}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.2}
            alignItems={{ md: 'center' }}
          >
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {forecast.period.monthLabel} 전망
            </Typography>
            <Chip
              label={
                forecast.basisStatus === 'OFFICIAL_LOCKED'
                  ? '공식 잠금 기준'
                  : '운영 전망 기준'
              }
              color={
                forecast.basisStatus === 'OFFICIAL_LOCKED' ? 'info' : 'warning'
              }
              variant="outlined"
              size="small"
            />
          </Stack>

          {forecast.warnings.map((warning) => (
            <Alert key={warning} severity="warning" variant="outlined">
              {warning}
            </Alert>
          ))}

          <Grid container spacing={appLayout.sectionGap}>
            <Grid size={{ xs: 12, md: 3 }}>
              <SummaryCard
                title="현재 자금 잔액"
                value={formatWon(forecast.actualBalanceWon)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <SummaryCard
                title="예상 수입"
                value={formatWon(forecast.expectedIncomeWon)}
                subtitle="아직 확정되지 않은 계획 항목 중 수입 방향 금액입니다."
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <SummaryCard
                title="남은 계획 지출"
                value={formatWon(forecast.remainingPlannedExpenseWon)}
                subtitle="확정되지 않은 계획 항목 중 지출 방향 금액입니다."
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <SummaryCard
                title="안전 잉여"
                value={formatWon(forecast.safetySurplusWon)}
                subtitle="최소 예비자금과 적립금을 반영한 뒤 남는 여력입니다."
              />
            </Grid>
          </Grid>

          <Grid container spacing={appLayout.sectionGap}>
            <Grid size={{ xs: 12, lg: 7 }}>
              <ChartCard
                title="최근 기간 추이"
                description="선택한 기간을 포함한 최근 기간의 수입, 확정 지출, 계획 지출 흐름입니다."
                chart={
                  <BarChart
                    height={320}
                    xAxis={[
                      {
                        scaleType: 'band',
                        data: trend.map((item) => item.monthLabel)
                      }
                    ]}
                    series={[
                      {
                        label: '수입',
                        data: trend.map((item) => item.incomeWon)
                      },
                      {
                        label: '확정 지출',
                        data: trend.map((item) => item.expenseWon)
                      },
                      {
                        label: '계획 지출',
                        data: trend.map((item) => item.plannedExpenseWon)
                      }
                    ]}
                  />
                }
              />
            </Grid>

            <Grid size={{ xs: 12, lg: 5 }}>
              <SectionCard
                title="전망 계산 기준"
                description="전망식과 공식 비교 기준을 분리해서 확인합니다."
              >
                <List disablePadding>
                  <ListItem disableGutters>
                    <ListItemText
                      primary="확정 전표 수입"
                      secondary={formatWon(forecast.confirmedIncomeWon)}
                    />
                  </ListItem>
                  <ListItem disableGutters>
                    <ListItemText
                      primary="확정 전표 지출"
                      secondary={formatWon(forecast.confirmedExpenseWon)}
                    />
                  </ListItem>
                  <ListItem disableGutters>
                    <ListItemText
                      primary="예상 수입"
                      secondary={formatWon(forecast.expectedIncomeWon)}
                    />
                  </ListItem>
                  <ListItem disableGutters>
                    <ListItemText
                      primary="남은 계획 지출"
                      secondary={formatWon(forecast.remainingPlannedExpenseWon)}
                    />
                  </ListItem>
                  <ListItem disableGutters>
                    <ListItemText
                      primary="적립금"
                      secondary={formatWon(forecast.sinkingFundWon)}
                    />
                  </ListItem>
                  <ListItem disableGutters>
                    <ListItemText
                      primary="최소 예비자금"
                      secondary={formatWon(forecast.minimumReserveWon)}
                    />
                  </ListItem>
                  <ListItem disableGutters>
                    <ListItemText
                      primary="예상 기간말 잔액"
                      secondary={formatWon(forecast.expectedMonthEndBalanceWon)}
                    />
                  </ListItem>
                </List>
              </SectionCard>
            </Grid>
          </Grid>

          <Grid container spacing={appLayout.sectionGap}>
            <Grid size={{ xs: 12, lg: 5 }}>
              <SectionCard
                title="비교 기준"
                description="최근 공식 잠금 기간이 있으면 전망과 공식 수치를 같은 문맥에서 볼 수 있습니다."
              >
                {forecast.officialComparison ? (
                  <Stack spacing={1}>
                    <Typography variant="subtitle2">
                      공식 비교 대상: {forecast.officialComparison.monthLabel}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      공식 현금{' '}
                      {formatWon(forecast.officialComparison.officialCashWon)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      공식 순자산{' '}
                      {formatWon(
                        forecast.officialComparison.officialNetWorthWon
                      )}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      공식 손익{' '}
                      {formatWon(
                        forecast.officialComparison.officialPeriodPnLWon
                      )}
                    </Typography>
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    아직 비교 가능한 공식 잠금 기간이 없습니다.
                  </Typography>
                )}
              </SectionCard>
            </Grid>

            <Grid size={{ xs: 12, lg: 7 }}>
              <SectionCard
                title="참고사항"
                description="이 화면이 운영 판단용인지, 공식 보고용인지 혼동되지 않도록 가정과 범위를 드러냅니다."
              >
                <List disablePadding>
                  {forecast.notes.map((note) => (
                    <ListItem key={note} disableGutters>
                      <ListItemText primary={note} />
                    </ListItem>
                  ))}
                </List>
              </SectionCard>
            </Grid>
          </Grid>
        </Stack>
      )}
    </Stack>
  );
}

function readPeriodStatusLabel(status: string) {
  switch (status) {
    case 'OPEN':
      return '열림';
    case 'IN_REVIEW':
      return '검토 중';
    case 'CLOSING':
      return '마감 중';
    case 'LOCKED':
      return '잠금';
    default:
      return status;
  }
}
