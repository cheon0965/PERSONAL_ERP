'use client';

import Link from 'next/link';
import {
  Alert,
  Button,
  Chip,
  Grid,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import type {
  AccountingPeriodItem,
  ForecastCategoryDriver,
  ForecastFixedCostItem,
  ForecastNextMonthProjection,
  ForecastPeriodComparison,
  ForecastResponse
} from '@personal-erp/contracts';
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
                ? `${selectedPeriod.monthLabel} 기간은 현재 ${readPeriodStatusLabel(selectedPeriod.status)} 상태입니다. 전망은 확정 전표와 남은 계획을 함께 읽는 운영 판단용 수치입니다.`
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
              <Button
                component={Link}
                href="/financial-statements"
                variant="text"
              >
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

export type ForecastTab = 'summary' | 'detail' | 'next';

export const FORECAST_TABS: readonly {
  value: ForecastTab;
  label: string;
  shortLabel: string;
}[] = [
  { value: 'summary', label: '요약', shortLabel: '요약' },
  { value: 'detail', label: '상세 분석', shortLabel: '상세' },
  { value: 'next', label: '다음 달 전망', shortLabel: '다음 달' }
];

export function ForecastContent({
  forecast,
  activeTab
}: {
  forecast: ForecastResponse;
  activeTab: ForecastTab;
}) {
  const trend = [...forecast.trend].reverse();

  return (
    <Stack spacing={appLayout.sectionGap}>
      {forecast.warnings.map((warning) => (
        <Alert key={warning} severity="warning" variant="outlined">
          {warning}
        </Alert>
      ))}

      {activeTab === 'summary' ? (
        <ForecastSummaryTab forecast={forecast} />
      ) : activeTab === 'detail' ? (
        <ForecastDetailTab forecast={forecast} />
      ) : (
        <ForecastNextTab forecast={forecast} trend={trend} />
      )}
    </Stack>
  );
}

/* ── 요약 탭 ── */

function ForecastSummaryTab({ forecast }: { forecast: ForecastResponse }) {
  return (
    <Stack spacing={appLayout.sectionGap}>
      <SectionCard
        title="전망 핵심 수치"
        description="지금 판단에 필요한 핵심 수치를 먼저 확인합니다."
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

      {forecast.periodComparison ? (
        <ForecastPeriodComparisonSection
          comparison={forecast.periodComparison}
        />
      ) : null}
    </Stack>
  );
}

/* ── 상세 분석 탭 ── */

function ForecastDetailTab({ forecast }: { forecast: ForecastResponse }) {
  return (
    <Stack spacing={appLayout.sectionGap}>
      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <SectionCard
            title="전망 드라이버"
            description="전망 계산식에 실제로 들어간 확정 값과 남은 계획 값을 확인합니다."
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
            title="공식 비교와 기준 구분"
            description="운영 전망과 마감된 공식 숫자를 혼동하지 않도록 비교 기준과 다음 이동을 함께 둡니다."
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
                    value={formatWon(
                      forecast.officialComparison.officialCashWon
                    )}
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

      {forecast.categoryDrivers.length > 0 ? (
        <ForecastCategoryDriversSection drivers={forecast.categoryDrivers} />
      ) : null}
    </Stack>
  );
}

/* ── 다음 달 전망 탭 ── */

function ForecastNextTab({
  forecast,
  trend
}: {
  forecast: ForecastResponse;
  trend: ForecastResponse['trend'];
}) {
  return (
    <Stack spacing={appLayout.sectionGap}>
      {forecast.nextMonthProjection ? (
        <ForecastNextMonthSection projection={forecast.nextMonthProjection} />
      ) : (
        <SectionCard
          title="다음 달 전망 없음"
          description="다음 달 전망 데이터가 아직 없습니다."
        >
          <Typography variant="body2" color="text.secondary">
            현재 월 마감 후 다음 기간이 준비되면 전망이 생성됩니다.
          </Typography>
        </SectionCard>
      )}

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
    </Stack>
  );
}

/* ── 전월 대비 변동 ── */

function ForecastPeriodComparisonSection({
  comparison
}: {
  comparison: ForecastPeriodComparison;
}) {
  return (
    <SectionCard
      title="전월 대비 변동"
      description={`${comparison.previousMonthLabel} 확정 실적 대비 현재 월의 변동을 보여줍니다.`}
    >
      <Grid container spacing={appLayout.fieldGap}>
        <Grid size={{ xs: 12, md: 4 }}>
          <ForecastChangeCard
            label="수입 변동"
            changeWon={comparison.incomeChangeWon}
            changePercent={comparison.incomeChangePercent}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <ForecastChangeCard
            label="지출 변동"
            changeWon={comparison.expenseChangeWon}
            changePercent={comparison.expenseChangePercent}
            invertColor
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <ForecastChangeCard
            label="잔액 변동"
            changeWon={comparison.balanceChangeWon}
            changePercent={null}
          />
        </Grid>
      </Grid>
    </SectionCard>
  );
}

function ForecastChangeCard({
  label,
  changeWon,
  changePercent,
  invertColor = false
}: {
  label: string;
  changeWon: number;
  changePercent: number | null;
  invertColor?: boolean;
}) {
  const isPositive = changeWon > 0;
  const isNegative = changeWon < 0;
  const displayColor = invertColor
    ? isPositive
      ? 'warning.main'
      : isNegative
        ? 'success.main'
        : 'text.secondary'
    : isPositive
      ? 'success.main'
      : isNegative
        ? 'error.main'
        : 'text.secondary';
  const arrow = isPositive ? '▲' : isNegative ? '▼' : '—';

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
      <Typography variant="h6" sx={{ color: displayColor }}>
        {arrow} {formatWon(Math.abs(changeWon))}
      </Typography>
      {changePercent != null ? (
        <Typography variant="body2" color="text.secondary">
          {changePercent > 0 ? '+' : ''}
          {changePercent}%
        </Typography>
      ) : null}
    </Stack>
  );
}

/* ── 카테고리별 드라이버 ── */

function ForecastCategoryDriversSection({
  drivers
}: {
  drivers: ForecastCategoryDriver[];
}) {
  const incomeDrivers = drivers.filter((d) => d.flowKind === 'INCOME');
  const expenseDrivers = drivers.filter((d) => d.flowKind === 'EXPENSE');

  return (
    <SectionCard
      title="카테고리별 드라이버"
      description="수입과 지출을 카테고리별로 나누어 확정 금액과 남은 계획을 확인합니다."
    >
      <Grid container spacing={appLayout.fieldGap}>
        {incomeDrivers.length > 0 ? (
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              수입
            </Typography>
            <Stack spacing={0.8}>
              {incomeDrivers.map((driver) => (
                <ForecastDriverRow
                  key={driver.categoryName}
                  label={driver.categoryName}
                  value={`확정 ${formatWon(driver.confirmedWon)}${driver.remainingPlannedWon > 0 ? ` + 계획 ${formatWon(driver.remainingPlannedWon)}` : ''}`} /* money-ops-allow */
                />
              ))}
            </Stack>
          </Grid>
        ) : null}
        {expenseDrivers.length > 0 ? (
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              지출
            </Typography>
            <Stack spacing={0.8}>
              {expenseDrivers.map((driver) => (
                <ForecastDriverRow
                  key={driver.categoryName}
                  label={driver.categoryName}
                  value={`확정 ${formatWon(driver.confirmedWon)}${driver.remainingPlannedWon > 0 ? ` + 계획 ${formatWon(driver.remainingPlannedWon)}` : ''}`} /* money-ops-allow */
                />
              ))}
            </Stack>
          </Grid>
        ) : null}
      </Grid>
    </SectionCard>
  );
}

/* ── 다음 달 전망 ── */

function ForecastNextMonthSection({
  projection
}: {
  projection: ForecastNextMonthProjection;
}) {
  return (
    <SectionCard
      title={`다음 달 전망 — ${projection.monthLabel}`}
      description={projection.basisDescription}
    >
      <Stack spacing={appLayout.cardGap}>
        <Grid container spacing={appLayout.fieldGap}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                label={projection.isOpen ? '열림' : '미열림'}
                color={projection.isOpen ? 'success' : 'default'}
                size="small"
                variant="outlined"
              />
              {projection.hasPlanItems ? (
                <Chip
                  label="계획 있음"
                  color="info"
                  size="small"
                  variant="outlined"
                />
              ) : null}
            </Stack>
          </Grid>
        </Grid>

        <Grid container spacing={appLayout.fieldGap}>
          <Grid size={{ xs: 12, md: 4 }}>
            <ForecastMetricCard
              label="예상 수입"
              value={formatWon(projection.estimatedIncomeWon)}
              description="반복 규칙 또는 계획 기반 예상입니다."
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <ForecastMetricCard
              label="예상 지출"
              value={formatWon(projection.estimatedExpenseWon)}
              description="고정 비용과 계획 기반 예상입니다."
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <ForecastMetricCard
              label="예상 잔액"
              value={formatWon(projection.projectedBalanceWon)}
              description="현재 월 예상 월말 잔액에서 계산합니다."
            />
          </Grid>
        </Grid>

        {projection.estimatedFixedCosts.length > 0 ? (
          <ForecastFixedCostTable costs={projection.estimatedFixedCosts} />
        ) : null}

        {!projection.isOpen ? (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            useFlexGap
            flexWrap="wrap"
          >
            <Button component={Link} href="/periods" variant="outlined">
              운영 월 열기
            </Button>
            {!projection.hasPlanItems ? (
              <Button component={Link} href="/plan-items" variant="text">
                계획 항목 생성
              </Button>
            ) : null}
          </Stack>
        ) : null}
      </Stack>
    </SectionCard>
  );
}

function ForecastFixedCostTable({ costs }: { costs: ForecastFixedCostItem[] }) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>항목</TableCell>
          <TableCell align="right">금액</TableCell>
          <TableCell>출처</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {costs.map((cost) => (
          <TableRow key={`${cost.source}-${cost.label}`}>
            <TableCell>{cost.label}</TableCell>
            <TableCell align="right">{formatWon(cost.amountWon)}</TableCell>
            <TableCell>
              <Chip
                label={readFixedCostSourceLabel(cost.source)}
                size="small"
                variant="outlined"
                color={readFixedCostSourceColor(cost.source)}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function readFixedCostSourceLabel(
  source: 'RECURRING_RULE' | 'INSURANCE' | 'LIABILITY'
) {
  switch (source) {
    case 'RECURRING_RULE':
      return '반복 규칙';
    case 'INSURANCE':
      return '보험';
    case 'LIABILITY':
      return '부채 상환';
  }
}

function readFixedCostSourceColor(
  source: 'RECURRING_RULE' | 'INSURANCE' | 'LIABILITY'
) {
  switch (source) {
    case 'RECURRING_RULE':
      return 'primary' as const;
    case 'INSURANCE':
      return 'info' as const;
    case 'LIABILITY':
      return 'warning' as const;
  }
}

/* ── 공통 유틸 컴포넌트 ── */

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
