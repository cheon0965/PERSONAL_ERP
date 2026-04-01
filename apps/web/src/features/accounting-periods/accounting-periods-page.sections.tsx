import * as React from 'react';
import {
  Button,
  Checkbox,
  FormControlLabel,
  Grid,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import type { AccountingPeriodItem } from '@personal-erp/contracts';
import type { GridColDef } from '@mui/x-data-grid';
import type { UseFormReturn } from 'react-hook-form';
import { formatDate } from '@/shared/lib/format';
import { appLayout } from '@/shared/ui/layout-metrics';
import { SectionCard } from '@/shared/ui/section-card';
import { StatusChip } from '@/shared/ui/status-chip';
import type { PeriodFormInput } from './accounting-periods-page.types';

export const periodColumns: GridColDef<AccountingPeriodItem>[] = [
  { field: 'monthLabel', headerName: '운영 월', flex: 0.8 },
  {
    field: 'status',
    headerName: '상태',
    flex: 0.7,
    renderCell: (params) => <StatusChip label={String(params.value)} />
  },
  {
    field: 'hasOpeningBalanceSnapshot',
    headerName: '오프닝',
    flex: 0.9,
    valueGetter: (_value, row) => readOpeningBalanceSource(row)
  },
  {
    field: 'openedAt',
    headerName: '시작일',
    flex: 1,
    valueFormatter: (value) => formatDate(String(value))
  },
  {
    field: 'lockedAt',
    headerName: '잠금일',
    flex: 1,
    valueFormatter: (value) => (value ? formatDate(String(value)) : '-')
  }
];

export function CurrentPeriodStatusSection({
  currentPeriod
}: {
  currentPeriod: AccountingPeriodItem | null;
}) {
  return (
    <SectionCard
      title="현재 기간 상태"
      description="가장 최근 운영 기간 또는 현재 열린 기간의 상태를 빠르게 확인합니다."
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
                label="오프닝 스냅샷"
                value={readOpeningBalanceSource(currentPeriod)}
              />
            </Grid>
          </Grid>
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
        <Typography variant="body2" color="text.secondary">
          아직 시작된 운영 기간이 없습니다. 첫 월 운영 시작을 진행해 주세요.
        </Typography>
      )}
    </SectionCard>
  );
}

export function OpenAccountingPeriodSection({
  form,
  initializeOpeningBalance,
  isFirstPeriod,
  isBusy,
  canOpenPeriod,
  isSubmitting,
  onSubmit
}: {
  form: UseFormReturn<PeriodFormInput>;
  initializeOpeningBalance: boolean;
  isFirstPeriod: boolean;
  isBusy: boolean;
  canOpenPeriod: boolean;
  isSubmitting: boolean;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
}) {
  return (
    <div id="open-accounting-period-form">
      <SectionCard
        title="월 운영 시작"
        description="첫 월은 오프닝 잔액 스냅샷을 함께 생성하고, 이후 월은 이전 기간 잠금 이후에만 열 수 있습니다."
      >
        <form onSubmit={onSubmit}>
          <Stack spacing={appLayout.cardGap}>
            <TextField
              label="운영 월"
              type="month"
              error={Boolean(form.formState.errors.month)}
              helperText={
                form.formState.errors.month?.message ??
                '현재 Ledger에 대해 열 운영 월을 선택합니다.'
              }
              {...form.register('month')}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={initializeOpeningBalance}
                  onChange={(event) => {
                    form.setValue(
                      'initializeOpeningBalance',
                      event.target.checked,
                      { shouldValidate: true }
                    );
                  }}
                  disabled={!isFirstPeriod}
                />
              }
              label={
                isFirstPeriod
                  ? '첫 월 운영 시작과 함께 오프닝 잔액 스냅샷 생성'
                  : '첫 월 이후에는 오프닝 잔액 직접 생성을 허용하지 않음'
              }
            />
            <TextField
              label="메모"
              multiline
              minRows={3}
              error={Boolean(form.formState.errors.note)}
              helperText={
                form.formState.errors.note?.message ??
                '월 운영 시작 사유나 메모를 남길 수 있습니다.'
              }
              {...form.register('note')}
            />
            <Button
              type="submit"
              variant="contained"
              disabled={isBusy || !canOpenPeriod}
              sx={{ alignSelf: 'flex-start' }}
            >
              {isSubmitting ? '운영 기간 시작 중...' : '월 운영 시작'}
            </Button>
          </Stack>
        </form>
      </SectionCard>
    </div>
  );
}

export function PeriodLifecycleActionsSection({
  openPeriod,
  reopenPeriod,
  membershipRole,
  canClosePeriod,
  canReopenPeriod,
  hasWorkspace,
  closeNote,
  reopenReason,
  closePending,
  reopenPending,
  onCloseNoteChange,
  onReopenReasonChange,
  onClosePeriod,
  onReopenPeriod
}: {
  openPeriod: AccountingPeriodItem | null;
  reopenPeriod: AccountingPeriodItem | null;
  membershipRole: string | null;
  canClosePeriod: boolean;
  canReopenPeriod: boolean;
  hasWorkspace: boolean;
  closeNote: string;
  reopenReason: string;
  closePending: boolean;
  reopenPending: boolean;
  onCloseNoteChange: (value: string) => void;
  onReopenReasonChange: (value: string) => void;
  onClosePeriod: () => Promise<void> | void;
  onReopenPeriod: () => Promise<void> | void;
}) {
  return (
    <Stack spacing={appLayout.sectionGap}>
      <SectionCard
        title="월 마감"
        description="현재 열린 운영 기간을 잠그고 ClosingSnapshot과 BalanceSnapshotLine을 생성합니다. 얇은 1차 구현에서는 전표가 한 건 이상 존재하는 기간만 마감할 수 있습니다."
      >
        <Stack spacing={appLayout.cardGap}>
          <InfoRow
            label="마감 대상"
            value={
              openPeriod ? openPeriod.monthLabel : '현재 열린 운영 기간 없음'
            }
          />
          <InfoRow
            label="권한"
            value={canClosePeriod ? 'Owner' : (membershipRole ?? '-')}
          />
          <TextField
            label="마감 메모"
            multiline
            minRows={3}
            value={closeNote}
            onChange={(event) => {
              onCloseNoteChange(event.target.value);
            }}
            helperText="월 마감 사유 또는 운영 메모를 남길 수 있습니다."
            disabled={!openPeriod || !canClosePeriod || !hasWorkspace}
          />
          <Button
            variant="contained"
            color="inherit"
            disabled={
              !openPeriod || !canClosePeriod || !hasWorkspace || closePending
            }
            onClick={() => {
              void onClosePeriod();
            }}
            sx={{ alignSelf: 'flex-start' }}
          >
            {closePending ? '월 마감 진행 중...' : '월 마감'}
          </Button>
        </Stack>
      </SectionCard>

      <SectionCard
        title="월 재오픈"
        description="가장 최근에 잠긴 운영 기간만 재오픈할 수 있으며, 재오픈 시 해당 기간의 마감 산출물은 함께 정리됩니다."
      >
        <Stack spacing={appLayout.cardGap}>
          <InfoRow
            label="재오픈 대상"
            value={
              reopenPeriod
                ? reopenPeriod.monthLabel
                : '가장 최근 잠금 운영 기간 없음'
            }
          />
          <InfoRow
            label="권한"
            value={canReopenPeriod ? 'Owner' : (membershipRole ?? '-')}
          />
          <TextField
            label="재오픈 사유"
            multiline
            minRows={3}
            value={reopenReason}
            onChange={(event) => {
              onReopenReasonChange(event.target.value);
            }}
            helperText="재무제표 재산출, 전표 정정 등 재오픈 사유를 남겨 주세요."
            disabled={!reopenPeriod || !canReopenPeriod || !hasWorkspace}
          />
          <Button
            variant="outlined"
            disabled={
              !reopenPeriod ||
              !canReopenPeriod ||
              !hasWorkspace ||
              reopenPending ||
              reopenReason.trim().length === 0
            }
            onClick={() => {
              void onReopenPeriod();
            }}
            sx={{ alignSelf: 'flex-start' }}
          >
            {reopenPending ? '월 재오픈 진행 중...' : '월 재오픈'}
          </Button>
        </Stack>
      </SectionCard>
    </Stack>
  );
}

function readOpeningBalanceSource(period: AccountingPeriodItem) {
  if (!period.hasOpeningBalanceSnapshot) {
    return '미생성';
  }

  return period.openingBalanceSourceKind === 'INITIAL_SETUP'
    ? '초기 셋업'
    : '이월';
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
