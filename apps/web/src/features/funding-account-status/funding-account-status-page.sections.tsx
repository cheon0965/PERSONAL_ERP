'use client';

import * as React from 'react';
import Link from 'next/link';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import SavingsRoundedIcon from '@mui/icons-material/SavingsRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { GridColDef } from '@mui/x-data-grid';
import { BarChart } from '@mui/x-charts/BarChart';
import type {
  AccountingPeriodItem,
  FundingAccountOverviewAccountItem,
  FundingAccountOverviewBasis,
  FundingAccountOverviewCategoryItem,
  FundingAccountOverviewResponse,
  FundingAccountOverviewTransactionItem,
  LedgerTransactionFlowKind
} from '@personal-erp/contracts';
import { formatDate, formatWon } from '@/shared/lib/format';
import { brandTokens } from '@/shared/theme/tokens';
import { ChartCard } from '@/shared/ui/chart-card';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { appLayout } from '@/shared/ui/layout-metrics';
import { SectionCard } from '@/shared/ui/section-card';
import { StatusChip } from '@/shared/ui/status-chip';
import { SummaryCard } from '@/shared/ui/summary-card';
import {
  readFundingAccountBootstrapStatusColor,
  readFundingAccountBootstrapStatusLabel,
  readFundingAccountStatusColor,
  readFundingAccountStatusLabel,
  readFundingAccountTypeLabel
} from '@/features/reference-data/reference-data.shared';

type FundingAccountStatusControlsProps = {
  periods: AccountingPeriodItem[];
  accounts: FundingAccountOverviewAccountItem[];
  basis: FundingAccountOverviewBasis;
  selectedPeriodId: string;
  selectedFundingAccountId: string;
  loading?: boolean;
  onBasisChange: (basis: FundingAccountOverviewBasis) => void;
  onSelectedPeriodChange: (periodId: string) => void;
  onSelectedFundingAccountChange: (fundingAccountId: string) => void;
  onClearFilters: () => void;
};

export function FundingAccountStatusControls({
  periods,
  accounts,
  basis,
  selectedPeriodId,
  selectedFundingAccountId,
  loading,
  onBasisChange,
  onSelectedPeriodChange,
  onSelectedFundingAccountChange,
  onClearFilters
}: FundingAccountStatusControlsProps) {
  const activeFilterCount = [selectedPeriodId, selectedFundingAccountId].filter(
    Boolean
  ).length;

  return (
    <SectionCard
      title="조회 기준"
      description="운영 판단용 수집 거래 기준과 공식 확인용 확정 전표 기준을 전환해서 볼 수 있습니다."
    >
      <Stack spacing={appLayout.cardGap}>
        {loading ? <LinearProgress sx={{ borderRadius: 999 }} /> : null}
        <Grid container spacing={appLayout.fieldGap} alignItems="flex-start">
          <Grid size={{ xs: 12, lg: 5 }}>
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              color="primary"
              value={basis}
              onChange={(_, nextBasis: FundingAccountOverviewBasis | null) => {
                if (nextBasis) {
                  onBasisChange(nextBasis);
                }
              }}
              aria-label="자금수단 현황 기준 선택"
              sx={{
                '& .MuiToggleButton-root': {
                  flex: '1 1 0',
                  minWidth: 0,
                  minHeight: 40,
                  px: { xs: 0.75, sm: 1.5 },
                  textTransform: 'none',
                  fontWeight: 800,
                  lineHeight: 1.25,
                  whiteSpace: 'normal',
                  wordBreak: 'keep-all'
                }
              }}
            >
              <ToggleButton value="COLLECTED_TRANSACTIONS">
                수집 거래 기준
              </ToggleButton>
              <ToggleButton value="POSTED_JOURNALS">
                확정 전표 기준
              </ToggleButton>
            </ToggleButtonGroup>
          </Grid>
          <Grid size={{ xs: 12, md: 6, lg: 3 }}>
            <TextField
              select
              fullWidth
              size="small"
              label="운영 기간"
              value={selectedPeriodId}
              onChange={(event) => {
                onSelectedPeriodChange(event.target.value);
              }}
              helperText="비워두면 현재 운영 기간을 자동 선택합니다."
            >
              <MenuItem value="">자동 선택</MenuItem>
              {periods.map((period) => (
                <MenuItem key={period.id} value={period.id}>
                  {period.monthLabel} · {readPeriodStatusLabel(period.status)}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 6, lg: 3 }}>
            <TextField
              select
              fullWidth
              size="small"
              label="자금수단"
              value={selectedFundingAccountId}
              onChange={(event) => {
                onSelectedFundingAccountChange(event.target.value);
              }}
              helperText="전체 또는 특정 자금수단만 볼 수 있습니다."
            >
              <MenuItem value="">전체 자금수단</MenuItem>
              {accounts.map((account) => (
                <MenuItem key={account.id} value={account.id}>
                  {account.name} · {readFundingAccountTypeLabel(account.type)}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, lg: 1 }}>
            <Button
              fullWidth
              size="small"
              variant={activeFilterCount > 0 ? 'outlined' : 'text'}
              disabled={activeFilterCount === 0}
              onClick={onClearFilters}
              sx={{ minHeight: 40, whiteSpace: 'nowrap' }}
            >
              초기화
            </Button>
          </Grid>
        </Grid>
      </Stack>
    </SectionCard>
  );
}

export function FundingAccountStatusEmptyState() {
  return (
    <SectionCard
      title="표시할 자금수단 현황이 없습니다"
      description="운영 기간과 자금수단 기준 데이터가 준비되면 이 화면에서 월별 잔액 흐름을 볼 수 있습니다."
    >
      <Stack spacing={1.5}>
        <Typography variant="body2" color="text.secondary">
          먼저 운영 월을 열고 자금수단을 등록한 뒤 거래를 수집하거나 전표를
          확정해 주세요.
        </Typography>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Button component={Link} href="/periods" variant="contained">
            운영 월 보기
          </Button>
          <Button
            component={Link}
            href="/reference-data/funding-accounts"
            variant="outlined"
          >
            자금수단 관리
          </Button>
        </Stack>
      </Stack>
    </SectionCard>
  );
}

export function FundingAccountStatusContent({
  summary,
  selectedFundingAccountId,
  onSelectFundingAccount
}: {
  summary: FundingAccountOverviewResponse;
  selectedFundingAccountId: string;
  onSelectFundingAccount: (fundingAccountId: string) => void;
}) {
  const scopedAccounts = selectedFundingAccountId
    ? summary.accounts.filter((account) => account.id === selectedFundingAccountId)
    : summary.accounts;

  return (
    <Stack spacing={appLayout.sectionGap}>
      {summary.warnings.map((warning) => (
        <Alert key={warning} severity="warning" variant="outlined">
          {warning}
        </Alert>
      ))}

      <FundingAccountSummaryCards summary={summary} />

      <FundingAccountCardsSection
        accounts={summary.accounts}
        selectedFundingAccountId={selectedFundingAccountId}
        onSelectFundingAccount={onSelectFundingAccount}
      />

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, xl: 7 }}>
          <FundingAccountFlowChart accounts={scopedAccounts} />
        </Grid>
        <Grid size={{ xs: 12, xl: 5 }}>
          <FundingAccountTrendChart summary={summary} />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <FundingAccountCategoryChart
            categories={summary.categoryBreakdown}
          />
        </Grid>
      </Grid>

      <FundingAccountTransactionsTable summary={summary} />
    </Stack>
  );
}

function FundingAccountSummaryCards({
  summary
}: {
  summary: FundingAccountOverviewResponse;
}) {
  const { totals } = summary;

  return (
    <Grid container spacing={appLayout.sectionGap}>
      <Grid size={{ xs: 12, md: 6, xl: 3 }}>
        <SummaryCard
          title="현재 자금 잔액"
          value={formatWon(totals.liveBalanceWon)}
          subtitle={`${totals.activeFundingAccountCount}개 활성 자금수단의 현재 잔액입니다.`}
          tone="primary"
          icon={AccountBalanceWalletRoundedIcon}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6, xl: 3 }}>
        <SummaryCard
          title="월 수입"
          value={formatWon(totals.incomeWon)}
          subtitle={`${summary.period.monthLabel} 기준 반영 수입 합계입니다.`}
          tone="success"
          icon={TrendingUpRoundedIcon}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6, xl: 3 }}>
        <SummaryCard
          title="월 지출"
          value={formatWon(totals.expenseWon)}
          subtitle={`남은 예정 지출 ${formatWon(totals.remainingPlannedExpenseWon)} 별도 표시.`}
          tone="warning"
          icon={TrendingDownRoundedIcon}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6, xl: 3 }}>
        <SummaryCard
          title="예상 기간말 잔액"
          value={formatWon(totals.expectedClosingBalanceWon)}
          subtitle={`기준 잔액 ${formatWon(totals.basisClosingBalanceWon)}에서 남은 계획을 반영합니다.`}
          tone="neutral"
          icon={SavingsRoundedIcon}
        />
      </Grid>
    </Grid>
  );
}

function FundingAccountCardsSection({
  accounts,
  selectedFundingAccountId,
  onSelectFundingAccount
}: {
  accounts: FundingAccountOverviewAccountItem[];
  selectedFundingAccountId: string;
  onSelectFundingAccount: (fundingAccountId: string) => void;
}) {
  return (
    <SectionCard
      title="자금수단별 현황"
      description="각 자금수단의 월초 잔액, 수입, 지출, 이체, 예상 기간말 잔액을 한 줄로 비교합니다."
    >
      <Grid container spacing={appLayout.fieldGap}>
        {accounts.map((account) => {
          const selected = selectedFundingAccountId === account.id;
          const netFlowColor =
            account.netFlowWon > 0
              ? 'success.main'
              : account.netFlowWon < 0
                ? 'warning.main'
                : 'text.secondary';

          return (
            <Grid key={account.id} size={{ xs: 12, lg: 6, xl: 4 }}>
              <Box
                component="button"
                type="button"
                onClick={() => {
                  onSelectFundingAccount(selected ? '' : account.id);
                }}
                sx={{
                  width: '100%',
                  height: '100%',
                  minWidth: 0,
                  p: appLayout.cardPadding,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: selected
                    ? brandTokens.palette.primaryBright
                    : 'divider',
                  backgroundColor: selected
                    ? alpha(brandTokens.palette.primaryBright, 0.08)
                    : 'background.default',
                  color: 'text.primary',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'border-color 160ms ease, background-color 160ms ease',
                  '&:hover': {
                    borderColor: brandTokens.palette.primaryBright,
                    backgroundColor: alpha(
                      brandTokens.palette.primaryBright,
                      0.06
                    )
                  }
                }}
              >
                <Stack spacing={1.5}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'stretch', sm: 'flex-start' }}
                    spacing={1}
                    sx={{ minWidth: 0 }}
                  >
                    <Stack spacing={0.65} sx={{ minWidth: 0 }}>
                      <Typography
                        variant="subtitle1"
                        fontWeight={800}
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        {account.name}
                      </Typography>
                      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                        <Chip
                          label={readFundingAccountTypeLabel(account.type)}
                          size="small"
                          variant="outlined"
                        />
                        <Chip
                          label={readFundingAccountStatusLabel(account.status)}
                          color={readFundingAccountStatusColor(account.status)}
                          size="small"
                          variant="outlined"
                        />
                        <Chip
                          label={readFundingAccountBootstrapStatusLabel(
                            account.bootstrapStatus
                          )}
                          color={readFundingAccountBootstrapStatusColor(
                            account.bootstrapStatus
                          )}
                          size="small"
                          variant="outlined"
                        />
                      </Stack>
                    </Stack>
                    {selected ? (
                      <Chip
                        label="선택됨"
                        color="primary"
                        size="small"
                        sx={{ alignSelf: { xs: 'flex-start', sm: 'auto' } }}
                      />
                    ) : null}
                  </Stack>

                  <Grid container spacing={1.1}>
                    <Grid size={{ xs: 6 }}>
                      <MetricMini label="월초" value={formatWon(account.openingBalanceWon)} />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <MetricMini label="현재" value={formatWon(account.liveBalanceWon)} />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <MetricMini label="수입" value={formatWon(account.incomeWon)} />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <MetricMini label="지출" value={formatWon(account.expenseWon)} />
                    </Grid>
                  </Grid>

                  <Stack spacing={0.8}>
                    <FundingAccountDriverRow
                      label="이체 입금"
                      value={formatWon(account.transferInWon)}
                    />
                    <FundingAccountDriverRow
                      label="이체 출금"
                      value={formatWon(account.transferOutWon)}
                    />
                    <FundingAccountDriverRow
                      label="순흐름"
                      value={formatWon(account.netFlowWon)}
                      valueColor={netFlowColor}
                    />
                    <FundingAccountDriverRow
                      label="예상 기간말"
                      value={formatWon(account.expectedClosingBalanceWon)}
                      emphasize
                    />
                  </Stack>

                  <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                    <Chip
                      label={`거래 ${account.transactionCount}건`}
                      size="small"
                      variant="outlined"
                    />
                    <Chip
                      label={`미확정 ${account.pendingTransactionCount}건`}
                      color={
                        account.pendingTransactionCount > 0 ? 'warning' : 'default'
                      }
                      size="small"
                      variant="outlined"
                    />
                    <Chip
                      label={`최근 ${account.lastActivityOn ?? '-'}`}
                      size="small"
                      variant="outlined"
                    />
                  </Stack>
                </Stack>
              </Box>
            </Grid>
          );
        })}
      </Grid>
    </SectionCard>
  );
}

function FundingAccountFlowChart({
  accounts
}: {
  accounts: FundingAccountOverviewAccountItem[];
}) {
  const chartAccounts = accounts.length > 0 ? accounts : [];

  return (
    <ChartCard
      title="자금수단별 수입 / 지출 / 순흐름"
      description="선택 범위의 자금수단별 월중 돈의 방향을 비교합니다."
      chartMinWidth={
        chartAccounts.length > 2
          ? Math.max(560, chartAccounts.length * 132)
          : 0
      }
      chart={
        chartAccounts.length > 0 ? (
          <BarChart
            height={330}
            margin={{ left: 86, right: 24, bottom: 74 }}
            xAxis={[
              {
                scaleType: 'band',
                data: chartAccounts.map((account) =>
                  readCompactChartLabel(account.name)
                )
              }
            ]}
            series={[
              {
                label: '수입',
                data: chartAccounts.map((account) => account.incomeWon)
              },
              {
                label: '지출',
                data: chartAccounts.map((account) => account.expenseWon)
              },
              {
                label: '순흐름',
                data: chartAccounts.map((account) => account.netFlowWon)
              }
            ]}
          />
        ) : (
          <EmptyChartMessage label="표시할 자금수단이 없습니다." />
        )
      }
    />
  );
}

function FundingAccountTrendChart({
  summary
}: {
  summary: FundingAccountOverviewResponse;
}) {
  return (
    <ChartCard
      title="최근 월 추이"
      description="최근 기간의 수입, 지출, 순흐름과 공식 잠금 여부를 함께 읽습니다."
      chartMinWidth={summary.trend.length > 3 ? 560 : 0}
      chart={
        summary.trend.length > 0 ? (
          <Stack spacing={1.5}>
            <BarChart
              height={300}
              margin={{ left: 86, right: 24, bottom: 58 }}
              xAxis={[
                {
                  scaleType: 'band',
                  data: summary.trend.map((item) => item.monthLabel)
                }
              ]}
              series={[
                {
                  label: '수입',
                  data: summary.trend.map((item) => item.incomeWon)
                },
                {
                  label: '지출',
                  data: summary.trend.map((item) => item.expenseWon)
                },
                {
                  label: '순흐름',
                  data: summary.trend.map((item) => item.netFlowWon)
                }
              ]}
            />
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
              {summary.trend.map((item) => (
                <Chip
                  key={item.periodId}
                  label={`${item.monthLabel} ${item.isOfficial ? '공식' : '운영중'}`}
                  color={item.isOfficial ? 'default' : 'warning'}
                  size="small"
                  variant="outlined"
                />
              ))}
            </Stack>
          </Stack>
        ) : (
          <EmptyChartMessage label="최근 월 추이를 계산할 데이터가 없습니다." />
        )
      }
    />
  );
}

function FundingAccountCategoryChart({
  categories
}: {
  categories: FundingAccountOverviewCategoryItem[];
}) {
  return (
    <ChartCard
      title="카테고리별 수입 / 지출 비중"
      description="선택 범위에서 금액 영향이 큰 카테고리를 빠르게 확인합니다."
      chartMinWidth={categories.length > 2 ? 680 : 0}
      chart={
        categories.length > 0 ? (
          <Grid container spacing={appLayout.fieldGap} alignItems="center">
            <Grid size={{ xs: 12, lg: 7 }}>
              <BarChart
                height={320}
                margin={{ left: 86, right: 24, bottom: 86 }}
                xAxis={[
                  {
                    scaleType: 'band',
                    data: categories.map(
                      (item) =>
                        readCompactChartLabel(
                          `${readFlowKindLabel(item.flowKind)} · ${item.categoryName}`,
                          14
                        )
                    )
                  }
                ]}
                series={[
                  {
                    label: '금액',
                    data: categories.map((item) => item.amountWon)
                  }
                ]}
              />
            </Grid>
            <Grid size={{ xs: 12, lg: 5 }}>
              <Stack spacing={1}>
                {categories.map((category) => (
                  <FundingAccountDriverRow
                    key={`${category.flowKind}-${category.categoryName}`}
                    label={`${readFlowKindLabel(category.flowKind)} · ${category.categoryName} (${category.transactionCount}건)`}
                    value={formatWon(category.amountWon)}
                  />
                ))}
              </Stack>
            </Grid>
          </Grid>
        ) : (
          <EmptyChartMessage label="카테고리로 묶을 수 있는 거래가 없습니다." />
        )
      }
    />
  );
}

function FundingAccountTransactionsTable({
  summary
}: {
  summary: FundingAccountOverviewResponse;
}) {
  const columns = React.useMemo<
    GridColDef<FundingAccountOverviewTransactionItem>[]
  >(
    () => [
      {
        field: 'businessDate',
        headerName: '거래일',
        flex: 0.8,
        minWidth: 120,
        valueFormatter: (value) => formatDate(String(value))
      },
      {
        field: 'title',
        headerName: '거래',
        flex: 1.5,
        minWidth: 190,
        renderCell: (params) => (
          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={700} noWrap>
              {params.row.title}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {readSourceKindLabel(params.row.sourceKind)}
            </Typography>
          </Stack>
        )
      },
      {
        field: 'fundingAccountName',
        headerName: '자금수단',
        flex: 1,
        minWidth: 140
      },
      {
        field: 'flowKind',
        headerName: '유형',
        flex: 0.7,
        minWidth: 110,
        renderCell: (params) => (
          <Chip
            label={readFlowKindLabel(params.row.flowKind)}
            color={readFlowKindColor(params.row.flowKind)}
            size="small"
            variant="outlined"
          />
        )
      },
      {
        field: 'categoryName',
        headerName: '카테고리',
        flex: 0.9,
        minWidth: 120,
        valueGetter: (value) => value ?? '미분류'
      },
      {
        field: 'status',
        headerName: '상태',
        flex: 0.8,
        minWidth: 120,
        renderCell: (params) => <StatusChip label={String(params.value)} />
      },
      {
        field: 'amountWon',
        headerName: '금액',
        flex: 0.9,
        minWidth: 130,
        align: 'right',
        headerAlign: 'right',
        valueFormatter: (value) => formatWon(Number(value))
      },
      {
        field: 'journalEntryNumber',
        headerName: '전표',
        flex: 1,
        minWidth: 140,
        sortable: false,
        filterable: false,
        renderCell: (params) =>
          params.row.journalEntryId ? (
            <Button
              component={Link}
              href={`/journal-entries/${params.row.journalEntryId}`}
              size="small"
              variant="text"
            >
              {params.row.journalEntryNumber ?? '전표 보기'}
            </Button>
          ) : (
            <Typography variant="body2" color="text.secondary">
              -
            </Typography>
          )
      }
    ],
    []
  );

  return (
    <DataTableCard
      title="자금수단별 거래 내역"
      description={`${summary.period.monthLabel} ${readFundingAccountOverviewBasisLabel(summary.basis)}으로 조회한 거래입니다.`}
      actions={
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Button component={Link} href="/transactions" size="small">
            수집 거래 보기
          </Button>
          <Button component={Link} href="/journal-entries" size="small">
            전표 조회
          </Button>
        </Stack>
      }
      toolbar={
        <Stack
          direction="row"
          spacing={0.75}
          useFlexGap
          flexWrap="wrap"
          alignItems="center"
        >
          <Chip
            icon={<ReceiptLongRoundedIcon />}
            label={`거래 ${summary.totals.transactionCount}건`}
            size="small"
            variant="outlined"
          />
          <Chip
            label={`확정 ${summary.totals.postedTransactionCount}건`}
            color="success"
            size="small"
            variant="outlined"
          />
          <Chip
            label={`미확정 ${summary.totals.pendingTransactionCount}건`}
            color={summary.totals.pendingTransactionCount > 0 ? 'warning' : 'default'}
            size="small"
            variant="outlined"
          />
          <Chip
            icon={<PaymentsRoundedIcon />}
            label={`순흐름 ${formatWon(summary.totals.netFlowWon)}`}
            color={summary.totals.netFlowWon >= 0 ? 'success' : 'warning'}
            size="small"
            variant="outlined"
          />
        </Stack>
      }
      rows={summary.transactions}
      columns={columns}
      height={520}
      rowHeight={72}
    />
  );
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return (
    <Stack
      spacing={0.35}
      sx={{
        p: 1.1,
        borderRadius: 1.5,
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        minWidth: 0
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        fontWeight={800}
        sx={{ overflowWrap: 'anywhere' }}
      >
        {value}
      </Typography>
    </Stack>
  );
}

function FundingAccountDriverRow({
  label,
  value,
  valueColor,
  emphasize = false
}: {
  label: string;
  value: string;
  valueColor?: string;
  emphasize?: boolean;
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'stretch', sm: 'center' }}
      spacing={2}
      sx={{
        py: 0.75,
        borderBottom: '1px solid',
        borderColor: 'divider',
        minWidth: 0
      }}
    >
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ fontWeight: emphasize ? 800 : 500, overflowWrap: 'anywhere' }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: emphasize ? 900 : 800,
          color: valueColor ?? 'text.primary',
          textAlign: { xs: 'left', sm: 'right' },
          overflowWrap: 'anywhere'
        }}
      >
        {value}
      </Typography>
    </Stack>
  );
}

function EmptyChartMessage({ label }: { label: string }) {
  return (
    <Box
      sx={{
        minHeight: 260,
        display: 'grid',
        placeItems: 'center',
        borderRadius: 2,
        border: '1px dashed',
        borderColor: 'divider',
        backgroundColor: 'background.default'
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}

function readCompactChartLabel(label: string, maxLength = 12) {
  if (label.length <= maxLength) {
    return label;
  }

  return `${label.slice(0, maxLength)}...`;
}

export function readFundingAccountOverviewBasisLabel(
  basis: FundingAccountOverviewBasis
) {
  return basis === 'POSTED_JOURNALS'
    ? '확정 전표 기준'
    : '수집 거래 기준';
}

export function readPeriodStatusLabel(status: string) {
  switch (status) {
    case 'OPEN':
      return '운영 중';
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

function readFlowKindLabel(flowKind: LedgerTransactionFlowKind) {
  switch (flowKind) {
    case 'INCOME':
      return '수입';
    case 'EXPENSE':
      return '지출';
    case 'TRANSFER':
      return '이체';
    case 'ADJUSTMENT':
      return '조정';
    case 'OPENING_BALANCE':
      return '기초';
    case 'CARRY_FORWARD':
      return '이월';
    default:
      return flowKind;
  }
}

function readFlowKindColor(flowKind: LedgerTransactionFlowKind) {
  switch (flowKind) {
    case 'INCOME':
      return 'success' as const;
    case 'EXPENSE':
      return 'warning' as const;
    case 'TRANSFER':
      return 'info' as const;
    default:
      return 'default' as const;
  }
}

function readSourceKindLabel(sourceKind: string) {
  switch (sourceKind) {
    case 'COLLECTED_TRANSACTION':
      return '수집 거래';
    case 'PLAN_SETTLEMENT':
      return '계획 확정';
    case 'OPENING_BALANCE':
      return '기초 전표';
    case 'CARRY_FORWARD':
      return '이월';
    case 'MANUAL_ADJUSTMENT':
      return '수동 조정';
    default:
      return sourceKind;
  }
}
