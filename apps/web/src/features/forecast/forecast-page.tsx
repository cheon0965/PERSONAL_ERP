'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Alert,
  Button,
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
    title: '기간 운영 전망 사용 가이드',
    description:
      '이 화면은 선택한 운영 월의 확정 전표와 남은 계획을 함께 읽어 월말 예상 잔액과 안전 여력을 판단하는 곳입니다. 다음 달 운영 준비 상태를 볼 때도 사용합니다.',
    primaryEntity: '운영 월',
    relatedEntities: [
      '계획 항목',
      '전표',
      '월 마감 스냅샷',
      '공식 재무제표'
    ],
    truthSource:
      '잠금된 기간의 공식 기준은 월 마감 결과와 공식 재무제표이며, 전망은 그 이전 운영 해석 계층입니다.',
    supplementarySections: [
      {
        title: '바로 쓰는 순서',
        items: [
          '전망 대상 선택에서 열린 운영 월 또는 다시 볼 잠금 월을 고릅니다.',
          '상단 상태 칩으로 운영 전망 기준인지 공식 잠금 기준인지 먼저 구분합니다.',
          '현재 자금 잔액, 예상 수입, 남은 계획 지출, 안전 잉여를 확인합니다.',
          '전망 계산 기준에서 어떤 확정 전표와 남은 계획이 계산에 들어갔는지 확인합니다.',
          '비교 기준과 참고사항에서 공식 잠금 숫자와 경고를 함께 읽습니다.'
        ]
      },
      {
        title: '막히면 확인',
        items: [
          '운영 기간이 없으면 월 운영 화면에서 먼저 월을 엽니다.',
          '계획이 비어 있으면 계획 항목 화면에서 선택 월의 계획 항목을 생성합니다.',
          '확정 지출이 기대와 다르면 전표 조회 또는 수집 거래 화면에서 전표 반영 상태를 확인합니다.'
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
                  label:
                    forecast.basisStatus === 'OFFICIAL_LOCKED'
                      ? '공식 잠금 기준'
                      : '운영 전망 기준',
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
            value: selectedPeriod ? readPeriodStatusLabel(selectedPeriod.status) : '-'
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
        title="전망 기준"
        description="전망 대상과 현재 선택 상태를 먼저 정한 뒤, 아래 요약과 추이로 내려갑니다."
      >
        <Grid container spacing={appLayout.fieldGap} alignItems="flex-start">
          <Grid size={{ xs: 12, md: 5 }}>
            <TextField
              select
              fullWidth
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
          </Grid>
          <Grid size={{ xs: 12, md: 7 }}>
            <Stack spacing={1.25}>
              <Typography variant="body2" color="text.secondary">
                {selectedPeriod
                  ? `${selectedPeriod.monthLabel} 기간은 현재 ${readPeriodStatusLabel(selectedPeriod.status)} 상태입니다. 전망은 확정 전표와 남은 계획을 함께 읽는 운영 해석 계층입니다.`
                  : '선택한 운영 기간이 없으면 전망 계산을 시작할 수 없습니다.'}
              </Typography>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                useFlexGap
                flexWrap="wrap"
              >
                <Button component={Link} href="/dashboard" variant="outlined">
                  대시보드 보기
                </Button>
                <Button component={Link} href="/periods" variant="text">
                  운영 월 보기
                </Button>
              </Stack>
            </Stack>
          </Grid>
        </Grid>
      </SectionCard>

      {!selectedPeriod ? (
        <SectionCard
          title="표시할 운영 기간이 없습니다"
          description="전망 화면은 운영 월이 하나 이상 있어야 동작합니다."
        >
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              먼저 운영 기간을 열어 두면 현재 운영 월 기준 전망을 계산할 수
              있습니다.
            </Typography>
            <div>
              <Button component={Link} href="/periods" variant="contained">
                운영 월 열기
              </Button>
            </div>
          </Stack>
        </SectionCard>
      ) : forecast == null ? (
        <SectionCard
          title="전망 데이터가 없습니다"
          description="선택한 운영 월의 전망 데이터를 아직 만들 수 없습니다."
        >
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              이 기간에 전표나 계획 항목이 아직 없거나, 기간 자체가 아직
              준비되지 않았을 수 있습니다.
            </Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              useFlexGap
              flexWrap="wrap"
            >
              <Button component={Link} href="/plan-items" variant="contained">
                계획 항목 보기
              </Button>
              <Button component={Link} href="/journal-entries" variant="outlined">
                전표 보기
              </Button>
              <Button component={Link} href="/periods" variant="text">
                운영 월 보기
              </Button>
            </Stack>
          </Stack>
        </SectionCard>
      ) : (
        <Stack spacing={appLayout.sectionGap}>
          {forecast.warnings.map((warning) => (
            <Alert key={warning} severity="warning" variant="outlined">
              {warning}
            </Alert>
          ))}

          <SectionCard
            title="전망 핵심 수치"
            description="차트로 내려가기 전에 현재 기간 전망을 해석하는 핵심 기준만 먼저 읽습니다."
          >
            <Stack spacing={appLayout.cardGap}>
              <Grid container spacing={appLayout.fieldGap}>
                <Grid size={{ xs: 12, md: 3 }}>
                  <ForecastInfoItem
                    label="현재 자금 잔액"
                    value={formatWon(forecast.actualBalanceWon)}
                    description="현재 운영 월 기준 잔액입니다."
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <ForecastInfoItem
                    label="예상 수입"
                    value={formatWon(forecast.expectedIncomeWon)}
                    description="아직 확정되지 않은 수입 계획 금액입니다."
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <ForecastInfoItem
                    label="남은 계획 지출"
                    value={formatWon(forecast.remainingPlannedExpenseWon)}
                    description="확정되지 않은 지출 계획 금액입니다."
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <ForecastInfoItem
                    label="안전 잉여"
                    value={formatWon(forecast.safetySurplusWon)}
                    description="예비자금을 반영하고 남는 여력입니다."
                  />
                </Grid>
              </Grid>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <Chip
                  label={`최소 예비자금 ${formatWon(forecast.minimumReserveWon)}`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={`적립금 ${formatWon(forecast.sinkingFundWon)}`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={
                    forecast.officialComparison
                      ? `공식 비교 ${forecast.officialComparison.monthLabel}`
                      : '공식 비교 없음'
                  }
                  size="small"
                  color={forecast.officialComparison ? 'info' : 'default'}
                  variant="outlined"
                />
              </Stack>
            </Stack>
          </SectionCard>

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

function ForecastInfoItem({
  label,
  value,
  description
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <Stack spacing={0.35}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body1" fontWeight={700}>
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
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
