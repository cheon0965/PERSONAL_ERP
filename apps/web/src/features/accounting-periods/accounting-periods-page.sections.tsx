import * as React from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography
} from '@mui/material';
import type {
  AccountSubjectItem,
  AccountingPeriodItem,
  FundingAccountItem
} from '@personal-erp/contracts';
import type { GridColDef } from '@mui/x-data-grid';
import { Controller, type UseFormReturn } from 'react-hook-form';
import { formatDate, formatWon } from '@/shared/lib/format';
import { appLayout } from '@/shared/ui/layout-metrics';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
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
    headerName: '기초 잔액',
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
                label="기초 잔액 기준"
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
  canSubmitOpeningBalance,
  isSubmitting,
  openingBalanceFields,
  openingBalanceLineCount,
  openingBalanceAccountSubjects,
  openingBalanceFundingAccounts,
  openingBalanceTotals,
  openingBalanceReferenceError,
  onAppendOpeningBalanceLine,
  onRemoveOpeningBalanceLine,
  onSubmit
}: {
  form: UseFormReturn<PeriodFormInput>;
  initializeOpeningBalance: boolean;
  isFirstPeriod: boolean;
  isBusy: boolean;
  canOpenPeriod: boolean;
  canSubmitOpeningBalance: boolean;
  isSubmitting: boolean;
  openingBalanceFields: Array<{ id: string }>;
  openingBalanceLineCount: number;
  openingBalanceAccountSubjects: AccountSubjectItem[];
  openingBalanceFundingAccounts: FundingAccountItem[];
  openingBalanceTotals: {
    assetAmount: number;
    liabilityAmount: number;
    equityAmount: number;
    balanceGapAmount: number;
    hasLines: boolean;
    isBalanced: boolean;
  };
  openingBalanceReferenceError: unknown;
  onAppendOpeningBalanceLine: () => void;
  onRemoveOpeningBalanceLine: (index: number) => void;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
}) {
  return (
    <div id="open-accounting-period-form">
      <SectionCard
        title="월 운영 시작"
        description="첫 월은 오프닝 잔액 라인을 함께 저장하고, 이후 월은 이전 기간 잠금 이후에만 열 수 있습니다."
      >
        <form onSubmit={onSubmit}>
          <Stack spacing={appLayout.cardGap}>
            <TextField
              label="운영 월"
              type="month"
              error={Boolean(form.formState.errors.month)}
              helperText={
                form.formState.errors.month?.message ??
                '현재 사업 장부에 대해 열 운영 월을 선택합니다.'
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
                  ? '첫 월 운영 시작과 함께 기초 잔액 기준 생성'
                  : '첫 월 이후에는 기초 잔액 직접 생성을 허용하지 않음'
              }
            />
            {isFirstPeriod && initializeOpeningBalance ? (
              <Stack spacing={appLayout.cardGap}>
                <Typography variant="subtitle2">오프닝 잔액 라인</Typography>
                <Typography variant="body2" color="text.secondary">
                  자산, 부채, 자본 기준으로 첫 월 시작 잔액을 입력합니다. 서비스
                  첫 시작이라면 자산만 먼저 입력해도 운영을 시작할 수 있습니다.
                </Typography>
                {openingBalanceReferenceError ? (
                  <QueryErrorAlert
                    title="오프닝 잔액 참조데이터를 불러오지 못했습니다."
                    error={openingBalanceReferenceError}
                  />
                ) : null}
                {openingBalanceAccountSubjects.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    사용할 수 있는 재무상태표 계정과목이 없습니다.
                  </Typography>
                ) : null}
                {openingBalanceLineCount === 0 ? (
                  <Box
                    sx={{
                      border: 1,
                      borderStyle: 'dashed',
                      borderColor: 'divider',
                      borderRadius: 3,
                      p: appLayout.cardPadding
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      아직 기초 잔액 라인이 없습니다. 라인 추가를 눌러 첫
                      항목부터 입력해 주세요.
                    </Typography>
                  </Box>
                ) : null}
                <Stack spacing={1}>
                  {openingBalanceFields.map((field, index) => (
                    <Box
                      key={field.id}
                      sx={{
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 3,
                        p: appLayout.cardPadding
                      }}
                    >
                      <Stack spacing={appLayout.fieldGap}>
                        <Stack
                          direction="row"
                          alignItems="center"
                          justifyContent="space-between"
                        >
                          <Typography variant="subtitle2">
                            라인 {index + 1}
                          </Typography>
                          <IconButton
                            aria-label={`오프닝 라인 ${index + 1} 삭제`}
                            size="small"
                            disabled={isSubmitting}
                            onClick={() => onRemoveOpeningBalanceLine(index)}
                          >
                            <DeleteOutlineRoundedIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                        <Grid container spacing={appLayout.fieldGap}>
                          <Grid size={{ xs: 12, md: 5 }}>
                            <Controller
                              control={form.control}
                              name={
                                `openingBalanceLines.${index}.accountSubjectId` as const
                              }
                              render={({ field }) => (
                                <TextField
                                  select
                                  label="계정과목"
                                  disabled={isSubmitting}
                                  error={Boolean(
                                    form.formState.errors.openingBalanceLines?.[
                                      index
                                    ]?.accountSubjectId
                                  )}
                                  helperText={
                                    form.formState.errors.openingBalanceLines?.[
                                      index
                                    ]?.accountSubjectId?.message ??
                                    '재무상태표 계정과목만 표시됩니다.'
                                  }
                                  {...field}
                                  value={field.value ?? ''}
                                >
                                  {openingBalanceAccountSubjects.map(
                                    (accountSubject) => (
                                      <MenuItem
                                        key={accountSubject.id}
                                        value={accountSubject.id}
                                      >
                                        {accountSubject.code}{' '}
                                        {accountSubject.name}
                                      </MenuItem>
                                    )
                                  )}
                                </TextField>
                              )}
                            />
                          </Grid>
                          <Grid size={{ xs: 12, md: 4 }}>
                            <Controller
                              control={form.control}
                              name={
                                `openingBalanceLines.${index}.fundingAccountId` as const
                              }
                              render={({ field }) => (
                                <TextField
                                  select
                                  label="자금수단"
                                  disabled={isSubmitting}
                                  helperText="선택 사항"
                                  {...field}
                                  value={field.value ?? ''}
                                >
                                  <MenuItem value="">자금수단 없음</MenuItem>
                                  {openingBalanceFundingAccounts.map(
                                    (fundingAccount) => (
                                      <MenuItem
                                        key={fundingAccount.id}
                                        value={fundingAccount.id}
                                      >
                                        {fundingAccount.name}
                                      </MenuItem>
                                    )
                                  )}
                                </TextField>
                              )}
                            />
                          </Grid>
                          <Grid size={{ xs: 12, md: 3 }}>
                            <Controller
                              control={form.control}
                              name={
                                `openingBalanceLines.${index}.balanceAmount` as const
                              }
                              render={({ field }) => (
                                <TextField
                                  label="잔액(원)"
                                  type="number"
                                  disabled={isSubmitting}
                                  error={Boolean(
                                    form.formState.errors.openingBalanceLines?.[
                                      index
                                    ]?.balanceAmount
                                  )}
                                  helperText={
                                    form.formState.errors.openingBalanceLines?.[
                                      index
                                    ]?.balanceAmount?.message ??
                                    '자연잔액 기준 양수 금액'
                                  }
                                  {...field}
                                  value={field.value ?? ''}
                                />
                              )}
                            />
                          </Grid>
                        </Grid>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
                <Button
                  variant="outlined"
                  startIcon={<AddRoundedIcon />}
                  onClick={onAppendOpeningBalanceLine}
                  disabled={
                    isSubmitting || Boolean(openingBalanceReferenceError)
                  }
                  sx={{ alignSelf: 'flex-start' }}
                >
                  라인 추가
                </Button>
                <Stack spacing={0.5}>
                  <Typography variant="body2" color="text.secondary">
                    자산 합계 {formatWon(openingBalanceTotals.assetAmount)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    부채 합계 {formatWon(openingBalanceTotals.liabilityAmount)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    자본 합계 {formatWon(openingBalanceTotals.equityAmount)}
                  </Typography>
                  <Typography
                    variant="body2"
                    color={
                      openingBalanceLineCount === 0 ||
                      !openingBalanceTotals.hasLines
                        ? 'warning.main'
                        : openingBalanceTotals.isBalanced
                          ? 'success.main'
                          : 'info.main'
                    }
                  >
                    {openingBalanceLineCount === 0
                      ? '기초 잔액 라인을 추가하면 월 운영 시작 버튼과 합계가 바로 반영됩니다.'
                      : !openingBalanceTotals.hasLines
                        ? '계정과목과 잔액을 입력하면 월 운영 시작 버튼과 합계가 바로 반영됩니다.'
                        : openingBalanceTotals.isBalanced
                          ? '자산과 부채+자본 합계가 일치합니다.'
                          : `자산과 부채+자본 차이 ${formatWon(Math.abs(openingBalanceTotals.balanceGapAmount))}이 있습니다. 첫 월 초기 설정에서는 차이가 있어도 운영 시작이 가능합니다.`}
                  </Typography>
                </Stack>
              </Stack>
            ) : null}
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
              disabled={
                isBusy ||
                !canOpenPeriod ||
                !canSubmitOpeningBalance ||
                Boolean(openingBalanceReferenceError)
              }
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

type PeriodLifecycleActionProps = {
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
};
export function PeriodOperationsSection(
  props: Parameters<typeof OpenAccountingPeriodSection>[0] &
    PeriodLifecycleActionProps
) {
  const { openPeriod, reopenPeriod } = props;
  const [activeTab, setActiveTab] = React.useState<PeriodOperationTab>(() =>
    pickDefaultPeriodOperationTab({ openPeriod, reopenPeriod })
  );

  React.useEffect(() => {
    setActiveTab((currentTab) => {
      if (currentTab === 'close' && !openPeriod) {
        return pickDefaultPeriodOperationTab({ openPeriod, reopenPeriod });
      }

      if (currentTab === 'reopen' && !reopenPeriod) {
        return pickDefaultPeriodOperationTab({ openPeriod, reopenPeriod });
      }

      return currentTab;
    });
  }, [openPeriod, reopenPeriod]);

  return (
    <Stack spacing={appLayout.cardGap} id="accounting-period-operations">
      <Tabs
        value={activeTab}
        onChange={(_event, nextValue: PeriodOperationTab) => {
          setActiveTab(nextValue);
        }}
        variant="scrollable"
        allowScrollButtonsMobile
      >
        <Tab value="open" label="월 운영 시작" />
        <Tab value="close" label="월 마감" />
        <Tab value="reopen" label="월 재오픈" />
      </Tabs>

      {activeTab === 'open' ? <OpenAccountingPeriodSection {...props} /> : null}

      {activeTab === 'close' ? (
        <CloseAccountingPeriodSection
          openPeriod={props.openPeriod}
          membershipRole={props.membershipRole}
          canClosePeriod={props.canClosePeriod}
          hasWorkspace={props.hasWorkspace}
          closeNote={props.closeNote}
          closePending={props.closePending}
          onCloseNoteChange={props.onCloseNoteChange}
          onClosePeriod={props.onClosePeriod}
        />
      ) : null}

      {activeTab === 'reopen' ? (
        <ReopenAccountingPeriodSection
          reopenPeriod={props.reopenPeriod}
          membershipRole={props.membershipRole}
          canReopenPeriod={props.canReopenPeriod}
          hasWorkspace={props.hasWorkspace}
          reopenReason={props.reopenReason}
          reopenPending={props.reopenPending}
          onReopenReasonChange={props.onReopenReasonChange}
          onReopenPeriod={props.onReopenPeriod}
        />
      ) : null}
    </Stack>
  );
}

function CloseAccountingPeriodSection({
  openPeriod,
  membershipRole,
  canClosePeriod,
  hasWorkspace,
  closeNote,
  closePending,
  onCloseNoteChange,
  onClosePeriod
}: {
  openPeriod: AccountingPeriodItem | null;
  membershipRole: string | null;
  canClosePeriod: boolean;
  hasWorkspace: boolean;
  closeNote: string;
  closePending: boolean;
  onCloseNoteChange: (value: string) => void;
  onClosePeriod: () => Promise<void> | void;
}) {
  return (
    <SectionCard
      title="월 마감"
      description="현재 열린 운영 기간을 잠그고 오프닝 기준과 확정 전표를 반영한 월 마감 스냅샷을 생성합니다. 미확정 수집 거래가 남아 있으면 마감할 수 없습니다."
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
          value={
            canClosePeriod ? '소유자' : readMembershipRoleLabel(membershipRole)
          }
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
  );
}

function ReopenAccountingPeriodSection({
  reopenPeriod,
  membershipRole,
  canReopenPeriod,
  hasWorkspace,
  reopenReason,
  reopenPending,
  onReopenReasonChange,
  onReopenPeriod
}: {
  reopenPeriod: AccountingPeriodItem | null;
  membershipRole: string | null;
  canReopenPeriod: boolean;
  hasWorkspace: boolean;
  reopenReason: string;
  reopenPending: boolean;
  onReopenReasonChange: (value: string) => void;
  onReopenPeriod: () => Promise<void> | void;
}) {
  return (
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
          value={
            canReopenPeriod ? '소유자' : readMembershipRoleLabel(membershipRole)
          }
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
  );
}

type PeriodOperationTab = 'open' | 'close' | 'reopen';

function pickDefaultPeriodOperationTab(input: {
  openPeriod: AccountingPeriodItem | null;
  reopenPeriod: AccountingPeriodItem | null;
}): PeriodOperationTab {
  if (input.openPeriod) {
    return 'close';
  }

  if (input.reopenPeriod) {
    return 'reopen';
  }

  return 'open';
}

function readOpeningBalanceSource(period: AccountingPeriodItem) {
  if (!period.hasOpeningBalanceSnapshot) {
    return '미생성';
  }

  return period.openingBalanceSourceKind === 'INITIAL_SETUP'
    ? '초기 설정'
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

function readMembershipRoleLabel(role: string | null) {
  switch (role) {
    case 'OWNER':
      return '소유자';
    case 'MANAGER':
      return '관리자';
    case 'EDITOR':
      return '편집자';
    case 'VIEWER':
      return '조회자';
    default:
      return role ?? '-';
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
