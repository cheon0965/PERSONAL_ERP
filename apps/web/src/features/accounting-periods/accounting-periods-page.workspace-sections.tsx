'use client';

import * as React from 'react';
import { Chip, Grid, Stack, Typography } from '@mui/material';
import type { AccountingPeriodItem } from '@personal-erp/contracts';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { appLayout } from '@/shared/ui/layout-metrics';
import { SectionCard } from '@/shared/ui/section-card';
import type { AccountingPeriodReopenEligibility } from './accounting-period-reopen-eligibility';
import { CurrentPeriodStatusSection } from './accounting-periods-page.status-section';
import { buildPeriodColumns } from './accounting-periods-page.sections';
import { PeriodOperationsSection } from './accounting-periods-page.lifecycle-section';

type CurrentPeriodStatusSectionProps = React.ComponentProps<
  typeof CurrentPeriodStatusSection
>;
type PeriodOperationsSectionProps = React.ComponentProps<
  typeof PeriodOperationsSection
>;

type PeriodStatusSummary = {
  OPEN: number;
  IN_REVIEW: number;
  CLOSING: number;
  LOCKED: number;
};

export function AccountingPeriodsOverviewWorkspace({
  statusSectionProps,
  periodStatusSummary,
  lockedPeriodCount,
  periods
}: {
  statusSectionProps: CurrentPeriodStatusSectionProps;
  periodStatusSummary: PeriodStatusSummary;
  lockedPeriodCount: number;
  periods: AccountingPeriodItem[];
}) {
  const periodColumns = React.useMemo(() => buildPeriodColumns(), []);

  return (
    <Stack spacing={appLayout.sectionGap}>
      <CurrentPeriodStatusSection {...statusSectionProps} />

      <div id="period-history">
        <DataTableCard
          title="최근 운영 기간"
          description="최신 월 몇 건만 빠르게 보고, 전체 이력은 전용 화면에서 이어서 확인합니다."
          toolbar={
            <PeriodHistoryToolbar
              periodStatusSummary={periodStatusSummary}
              lockedPeriodCount={lockedPeriodCount}
              compact
            />
          }
          rows={periods.slice(0, 5)}
          columns={periodColumns}
          height={320}
        />
      </div>
    </Stack>
  );
}

export function AccountingPeriodsLifecycleWorkspace({
  statusSectionProps,
  operationsSectionProps
}: {
  statusSectionProps: CurrentPeriodStatusSectionProps;
  operationsSectionProps: PeriodOperationsSectionProps;
}) {
  return (
    <Grid container spacing={appLayout.sectionGap}>
      <Grid size={{ xs: 12, xl: 4.5 }}>
        <CurrentPeriodStatusSection {...statusSectionProps} />
      </Grid>

      <Grid size={{ xs: 12, xl: 7.5 }}>
        <PeriodOperationsSection {...operationsSectionProps} />
      </Grid>
    </Grid>
  );
}

export function AccountingPeriodsHistoryWorkspace({
  statusSectionProps,
  periodStatusSummary,
  lockedPeriodCount,
  periods,
  reopenEligibilityByPeriodId
}: {
  statusSectionProps: CurrentPeriodStatusSectionProps;
  periodStatusSummary: PeriodStatusSummary;
  lockedPeriodCount: number;
  periods: AccountingPeriodItem[];
  reopenEligibilityByPeriodId: Record<
    string,
    AccountingPeriodReopenEligibility
  >;
}) {
  const periodColumns = React.useMemo(
    () =>
      buildPeriodColumns({
        includeReopenAction: true,
        reopenEligibilityByPeriodId
      }),
    [reopenEligibilityByPeriodId]
  );

  return (
    <Stack spacing={appLayout.sectionGap}>
      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, xl: 4.5 }}>
          <CurrentPeriodStatusSection {...statusSectionProps} />
        </Grid>

        <Grid size={{ xs: 12, xl: 7.5 }}>
          <SectionCard
            title="이력 읽는 순서"
            description="운영 월 상태, 잠금 시점, 기초 잔액 출처를 차례대로 읽으면 마감과 차기 이월 연결을 가장 빠르게 확인할 수 있습니다."
          >
            <Stack spacing={1.25}>
              <Typography variant="body2" color="text.secondary">
                최신 월부터 상태와 잠금 여부를 보고, 필요한 경우 잠금 월별로
                재오픈 가능/차단 사유를 먼저 확인한 뒤 검토 대상을 고릅니다.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                첫 월은 `초기 설정`, 이후 월은 `이월` 기초 잔액 출처가
                자연스럽게 이어지는지 함께 확인합니다. 실제 재오픈은 각 행의
                `재오픈 검토` 버튼으로 이어서 처리할 수 있습니다.
              </Typography>
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>

      <div id="period-history">
        <DataTableCard
          title="기간 이력"
          description="최신 월 순서로 운영 기간 상태와 기초 잔액 기준 여부를 확인합니다."
          toolbar={
            <PeriodHistoryToolbar
              periodStatusSummary={periodStatusSummary}
              lockedPeriodCount={lockedPeriodCount}
            />
          }
          rows={periods}
          columns={periodColumns}
          height={420}
        />
      </div>
    </Stack>
  );
}

function PeriodHistoryToolbar({
  periodStatusSummary,
  lockedPeriodCount,
  compact = false
}: {
  periodStatusSummary: PeriodStatusSummary;
  lockedPeriodCount: number;
  compact?: boolean;
}) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={1.5}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', md: 'center' }}
    >
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        {periodStatusSummary.OPEN > 0 ? (
          <Chip
            label={`열림 ${periodStatusSummary.OPEN}건`}
            size="small"
            color="primary"
            variant="filled"
          />
        ) : null}
        {periodStatusSummary.IN_REVIEW > 0 ? (
          <Chip
            label={`검토 ${periodStatusSummary.IN_REVIEW}건`}
            size="small"
            color="warning"
            variant="outlined"
          />
        ) : null}
        {periodStatusSummary.CLOSING > 0 ? (
          <Chip
            label={`마감 중 ${periodStatusSummary.CLOSING}건`}
            size="small"
            color="warning"
            variant="outlined"
          />
        ) : null}
        <Chip
          label={`잠금 ${lockedPeriodCount}건`}
          size="small"
          variant="outlined"
        />
      </Stack>
      <Typography variant="body2" color="text.secondary">
        {compact
          ? '최근 운영 월만 먼저 확인하고, 전체 이력은 전용 화면에서 이어서 봅니다.'
          : '상태 이력은 읽기 전용으로 확인하고, 실제 시작/마감 작업은 각 전용 화면에서 처리합니다.'}
      </Typography>
    </Stack>
  );
}
