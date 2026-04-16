'use client';

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
import { BarChart } from '@mui/x-charts/BarChart';
import type { AccountingPeriodItem, ForecastResponse } from '@personal-erp/contracts';
import { formatWon } from '@/shared/lib/format';
import { ChartCard } from '@/shared/ui/chart-card';
import { SectionCard } from '@/shared/ui/section-card';
import { appLayout } from '@/shared/ui/layout-metrics';

export function ForecastPeriodSelectionSection({
  periods,
  selectedPeriodId,
  selectedPeriod,
  onSelectedPeriodChange
}: {
  periods: AccountingPeriodItem[];
  selectedPeriodId: string;
  selectedPeriod: AccountingPeriodItem | null;
  onSelectedPeriodChange: (periodId: string) => void;
}) {
  return (
    <SectionCard
      title="전망 기준"
      description="전망 대상과 현재 기준 상태를 먼저 정한 뒤, 아래 요약과 드라이버로 내려갑니다."
    >
      <Grid container spacing={appLayout.fieldGap} alignItems="flex-start">
        <Grid size={{ xs: 12, md: 5 }}>
          <TextField
            select
            fullWidth
            label="운영 기간"
            value={selectedPeriodId}
            onChange={(event) => onSelectedPeriodChange(event.target.value)}
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
              <Button component={Link} href="/financial-statements" variant="text">
                재무제표 보기
              </Button>
            </Stack>
          </Stack>
        </Grid>
      </Grid>
    </SectionCard>
  );
}

export function ForecastMissingPeriodState() {
  return (
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
  );
}

export function ForecastUnavailableState() {
  return (
    <SectionCard
      title="전망 데이터가 없습니다"
      description="선택한 운영 월의 전망 데이터를 아직 만들 수 없습니다."
    >
      <Stack spacing={1.5}>
        <Typography variant="body2" color="text.secondary">
          이 기간에 전표나 계획 항목이 아직 없거나, 기간 자체가 아직 준비되지
          않았을 수 있습니다.
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
  );
}

export function ForecastContent({ forecast }: { forecast: ForecastResponse }) {
  const trend = [...forecast.trend].reverse();

  return (
    <Stack spacing={appLayout.sectionGap}>
      {forecast.warnings.map((warning) => (
        <Alert key={warning} severity="warning" variant="outlined">
          {warning}
        </Alert>
      ))}

      <SectionCard
        title="전망 핵심 수치"
        description="먼저 지금 판단에 필요한 핵심 수치만 보고, 아래에서 계산 드라이버와 공식 비교를 이어서 확인합니다."
      >
        <Stack spacing={appLayout.cardGap}>
          <Grid container spacing={appLayout.fieldGap}>
            <Grid size={{ xs: 12, md: 6, xl: 3 }}>
              <ForecastMetricCard
                label="현재 자금 잔액"
                value={formatWon(forecast.actualBalanceWon)}
                description="현재 운영 월 기준 잔액입니다."
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6, xl: 3 }}>
              <ForecastMetricCard
                label="예상 수입"
                value={formatWon(forecast.expectedIncomeWon)}
                description="아직 확정되지 않은 수입 계획 금액입니다."
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6, xl: 3 }}>
              <ForecastMetricCard
                label="남은 계획 지출"
                value={formatWon(forecast.remainingPlannedExpenseWon)}
                description="확정되지 않은 지출 계획 금액입니다."
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6, xl: 3 }}>
              <ForecastMetricCard
                label="안전 잉여"
                value={formatWon(forecast.safetySurplusWon)}
                description="예비자금을 반영하고 남는 여력입니다."
              />
            </Grid>
          </Grid>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {forecast.highlights.map((highlight) => (
              <Chip
                key={highlight.label}
                label={`${highlight.label} ${formatWon(highlight.amountWon)}`}
                color={readHighlightToneColor(highlight.tone)}
                variant="outlined"
                size="small"
              />
            ))}
          </Stack>
        </Stack>
      </SectionCard>

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <SectionCard
            title="전망 드라이버"
            description="전망 계산식에 실제로 들어간 확정 값과 남은 계획 값을 먼저 확인합니다."
          >
            <Stack spacing={1.2}>
              <ForecastDriverRow
                label="확정 전표 수입"
                value={formatWon(forecast.confirmedIncomeWon)}
              />
              <ForecastDriverRow
                label="확정 전표 지출"
                value={formatWon(forecast.confirmedExpenseWon)}
              />
              <ForecastDriverRow
                label="예상 수입"
                value={formatWon(forecast.expectedIncomeWon)}
              />
              <ForecastDriverRow
                label="남은 계획 지출"
                value={formatWon(forecast.remainingPlannedExpenseWon)}
              />
              <ForecastDriverRow
                label="적립금"
                value={formatWon(forecast.sinkingFundWon)}
              />
              <ForecastDriverRow
                label="최소 예비자금"
                value={formatWon(forecast.minimumReserveWon)}
              />
              <ForecastDriverRow
                label="예상 기간말 잔액"
                value={formatWon(forecast.expectedMonthEndBalanceWon)}
                emphasize
              />
            </Stack>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <SectionCard
            title="공식 비교와 해석 경계"
            description="운영 전망과 공식 잠금 숫자를 혼동하지 않도록 비교 기준과 다음 이동을 함께 둡니다."
          >
            <Stack spacing={1.5}>
              <Stack spacing={0.5}>
                <Typography variant="subtitle2">
                  현재 기준: {readBasisStatusLabel(forecast.basisStatus)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  잠금 전 기간은 계속 움직일 수 있으므로 공식 보고와 분리해서
                  읽어야 합니다.
                </Typography>
              </Stack>

              {forecast.officialComparison ? (
                <Stack spacing={1}>
                  <Typography variant="subtitle2">
                    공식 비교 대상: {forecast.officialComparison.monthLabel}
                  </Typography>
                  <ForecastDriverRow
                    label="공식 현금"
                    value={formatWon(forecast.officialComparison.officialCashWon)}
                  />
                  <ForecastDriverRow
                    label="공식 순자산"
                    value={formatWon(
                      forecast.officialComparison.officialNetWorthWon
                    )}
                  />
                  <ForecastDriverRow
                    label="공식 손익"
                    value={formatWon(
                      forecast.officialComparison.officialPeriodPnLWon
                    )}
                  />
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  아직 비교 가능한 공식 잠금 기간이 없습니다.
                </Typography>
              )}

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                useFlexGap
                flexWrap="wrap"
              >
                <Button
                  component={Link}
                  href="/financial-statements"
                  variant="outlined"
                >
                  재무제표 보기
                </Button>
                <Button component={Link} href="/dashboard" variant="text">
                  대시보드 보기
                </Button>
              </Stack>
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>

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

      <SectionCard
        title="참고사항"
        description="세부 해석과 업무 메모는 여기서 확인하고, 실제 확정 작업은 관련 화면으로 이어집니다."
      >
        <List disablePadding>
          {forecast.notes.map((note) => (
            <ListItem key={note} disableGutters>
              <ListItemText primary={note} />
            </ListItem>
          ))}
        </List>
      </SectionCard>
    </Stack>
  );
}

export function readBasisStatusLabel(
  basisStatus: 'LIVE_OPERATIONS' | 'OFFICIAL_LOCKED'
) {
  return basisStatus === 'OFFICIAL_LOCKED'
    ? '공식 잠금 기준'
    : '운영 전망 기준';
}

export function readPeriodStatusLabel(status: string) {
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

function ForecastMetricCard({
  label,
  value,
  description
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <Stack
      spacing={0.5}
      sx={{
        p: appLayout.cardPadding,
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.default',
        height: '100%'
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h6">{value}</Typography>
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
    </Stack>
  );
}

function ForecastDriverRow({
  label,
  value,
  emphasize = false
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      spacing={2}
      sx={{
        py: 0.85,
        borderBottom: '1px solid',
        borderColor: 'divider'
      }}
    >
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ fontWeight: emphasize ? 700 : 400 }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: emphasize ? 700 : 600 }}>
        {value}
      </Typography>
    </Stack>
  );
}

function readHighlightToneColor(tone: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL') {
  switch (tone) {
    case 'POSITIVE':
      return 'success';
    case 'NEGATIVE':
      return 'warning';
    default:
      return 'default';
  }
}
