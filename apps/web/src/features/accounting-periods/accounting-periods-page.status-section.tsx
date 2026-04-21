import * as React from 'react';
import { Chip, Grid, Stack, Typography } from '@mui/material';
import type { AccountingPeriodItem } from '@personal-erp/contracts';
import { formatDate } from '@/shared/lib/format';
import { appLayout } from '@/shared/ui/layout-metrics';
import { SectionCard } from '@/shared/ui/section-card';
import { StatusChip } from '@/shared/ui/status-chip';

export function CurrentPeriodStatusSection({
  currentPeriod,
  openPeriod,
  reopenPeriod,
  canClosePeriod,
  canReopenPeriod,
  isReadyForMonthlyOperation
}: {
  currentPeriod: AccountingPeriodItem | null;
  openPeriod: AccountingPeriodItem | null;
  reopenPeriod: AccountingPeriodItem | null;
  canClosePeriod: boolean;
  canReopenPeriod: boolean;
  isReadyForMonthlyOperation: boolean;
}) {
  return (
    <SectionCard
      title="현재 운영 월"
      description="지금 기준이 되는 운영 월 상태와 다음 작업 방향을 먼저 확인합니다."
    >
      {currentPeriod ? (
        <Stack spacing={1.5}>
          <Grid container spacing={appLayout.fieldGap}>
            <Grid size={{ xs: 12, md: 4 }}>
              <InfoRow label="운영 월" value={currentPeriod.monthLabel} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <InfoRow
                label="상태"
                value={<StatusChip label={currentPeriod.status} />}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <InfoRow
                label="다음 작업"
                value={readNextPeriodAction({
                  openPeriod,
                  reopenPeriod,
                  canClosePeriod,
                  canReopenPeriod
                })}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <InfoRow
                label="시작일"
                value={formatDate(currentPeriod.openedAt)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <InfoRow
                label="잠금일"
                value={
                  currentPeriod.lockedAt
                    ? formatDate(currentPeriod.lockedAt)
                    : '아직 열림'
                }
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <InfoRow
                label="기초 잔액"
                value={readOpeningBalanceSource(currentPeriod)}
              />
            </Grid>
          </Grid>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip
              label={
                isReadyForMonthlyOperation
                  ? '기준 데이터 준비됨'
                  : '기준 데이터 점검 필요'
              }
              size="small"
              color={isReadyForMonthlyOperation ? 'success' : 'warning'}
              variant={isReadyForMonthlyOperation ? 'filled' : 'outlined'}
            />
            <Chip
              label={
                openPeriod
                  ? '현재 열린 운영 월 있음'
                  : reopenPeriod
                    ? '잠금 월 재오픈 검토'
                    : '첫 월 시작 필요'
              }
              size="small"
              variant="outlined"
            />
          </Stack>
          <Stack spacing={1}>
            <Typography variant="subtitle2">최근 상태 이력</Typography>
            {currentPeriod.statusHistory.length > 0 ? (
              currentPeriod.statusHistory.slice(0, 3).map((history) => (
                <Typography
                  key={history.id}
                  variant="body2"
                  color="text.secondary"
                >
                  {formatDate(history.changedAt)} ·{' '}
                  {getAccountingPeriodEventLabel(history.eventType)} ·{' '}
                  {history.fromStatus ? `${history.fromStatus} -> ` : ''}
                  {history.toStatus}
                  {history.reason ? ` · ${history.reason}` : ''}
                </Typography>
              ))
            ) : (
              <Typography variant="body2" color="text.secondary">
                아직 기록된 상태 이력이 없습니다.
              </Typography>
            )}
          </Stack>
        </Stack>
      ) : (
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            아직 시작된 운영 기간이 없습니다. 첫 월 운영 시작에서 대상 월과 기초
            잔액 기준을 먼저 준비해 주세요.
          </Typography>
          <Chip
            label={
              isReadyForMonthlyOperation
                ? '기준 데이터 준비됨'
                : '기준 데이터 점검 필요'
            }
            size="small"
            color={isReadyForMonthlyOperation ? 'success' : 'warning'}
            variant={isReadyForMonthlyOperation ? 'filled' : 'outlined'}
            sx={{ alignSelf: 'flex-start' }}
          />
        </Stack>
      )}
    </SectionCard>
  );
}

function readOpeningBalanceSource(period: AccountingPeriodItem) {
  if (period.hasOpeningBalanceSnapshot) {
    return '기초 잔액 있음';
  }

  return '기초 잔액 없음';
}

function getAccountingPeriodEventLabel(
  eventType: AccountingPeriodItem['statusHistory'][number]['eventType']
) {
  switch (eventType) {
    case 'OPEN':
      return '운영 시작';
    case 'MOVE_TO_REVIEW':
      return '검토 이동';
    case 'START_CLOSING':
      return '마감 시작';
    case 'LOCK':
      return '잠금';
    case 'REOPEN':
      return '재오픈';
    case 'FORCE_LOCK':
      return '강제 잠금';
    default:
      return eventType;
  }
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      {typeof value === 'string' ? (
        <Typography variant="body1">{value}</Typography>
      ) : (
        value
      )}
    </Stack>
  );
}

function readNextPeriodAction(input: {
  openPeriod: AccountingPeriodItem | null;
  reopenPeriod: AccountingPeriodItem | null;
  canClosePeriod: boolean;
  canReopenPeriod: boolean;
}) {
  if (input.openPeriod) {
    return input.canClosePeriod ? '월 마감 준비' : '운영 진행 확인';
  }

  if (input.reopenPeriod) {
    return input.canReopenPeriod ? '잠금 월 재오픈 검토' : '잠금 상태 확인';
  }

  return '첫 월 시작';
}
