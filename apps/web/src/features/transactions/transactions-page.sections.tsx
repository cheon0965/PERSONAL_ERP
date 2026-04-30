import Link from 'next/link';
import * as React from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import type {
  AccountingPeriodItem,
  CollectedTransactionItem,
  JournalEntryItem
} from '@personal-erp/contracts';
import type { GridColDef, GridRowSelectionModel } from '@mui/x-data-grid';
import { formatWon } from '@/shared/lib/format';
import {
  DataTableCard,
  type DataTableMobileCardContext
} from '@/shared/ui/data-table-card';
import { GridActionCell, GridStackCell } from '@/shared/ui/data-grid-cell';
import { appLayout } from '@/shared/ui/layout-metrics';
import { ResponsiveFilterPanel } from '@/shared/ui/responsive-filter-panel';
import { resolveStatusLabel, StatusChip } from '@/shared/ui/status-chip';
import {
  resolveLatestLinkedJournalEntry,
  sourceKindLabelMap
} from './transactions-page.shared';
import {
  canConfirmCollectedTransaction,
  canDeleteCollectedTransaction,
  canEditCollectedTransaction,
  collectedTransactionStatusFilterOptions,
  resolveCollectedTransactionActionHint
} from './transaction-workflow';

function areStringArraysEqual(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function TransactionsTableSection({
  currentPeriod,
  collectingPeriods,
  rows,
  journalEntriesById,
  keyword,
  fundingAccountName,
  categoryName,
  postingStatus,
  selectedTransactionIds,
  selectedTransactionsCount,
  selectedConfirmableTransactionCount,
  visibleConfirmableTransactionCount,
  fundingAccountOptions,
  categoryOptions,
  confirmPending,
  bulkConfirmPending,
  confirmingTransactionId,
  onKeywordChange,
  onFundingAccountChange,
  onCategoryChange,
  onPostingStatusChange,
  onSelectedTransactionIdsChange,
  onClearFilters,
  onBulkConfirm,
  onConfirm,
  onEdit,
  onDelete
}: {
  currentPeriod: AccountingPeriodItem | null;
  collectingPeriods: AccountingPeriodItem[];
  rows: CollectedTransactionItem[];
  journalEntriesById: Map<string, JournalEntryItem>;
  keyword: string;
  fundingAccountName: string;
  categoryName: string;
  postingStatus: string;
  selectedTransactionIds: string[];
  selectedTransactionsCount: number;
  selectedConfirmableTransactionCount: number;
  visibleConfirmableTransactionCount: number;
  fundingAccountOptions: string[];
  categoryOptions: string[];
  confirmPending: boolean;
  bulkConfirmPending: boolean;
  confirmingTransactionId: string | undefined;
  onKeywordChange: (value: string) => void;
  onFundingAccountChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onPostingStatusChange: (value: string) => void;
  onSelectedTransactionIdsChange: (value: string[]) => void;
  onClearFilters: () => void;
  onBulkConfirm: () => void;
  onConfirm: (transaction: CollectedTransactionItem) => void;
  onEdit: (transaction: CollectedTransactionItem) => void;
  onDelete: (transaction: CollectedTransactionItem) => void;
}) {
  const activeFilterCount = [
    keyword,
    fundingAccountName,
    categoryName,
    postingStatus
  ].filter((value) => value.trim().length > 0).length;
  const hasCollectingPeriod = collectingPeriods.length > 0;
  const rowSelectionModel = React.useMemo<GridRowSelectionModel>(
    () => ({
      type: 'include',
      ids: new Set(selectedTransactionIds)
    }),
    [selectedTransactionIds]
  );
  const bulkConfirmCount =
    selectedTransactionsCount > 0
      ? selectedConfirmableTransactionCount
      : visibleConfirmableTransactionCount;
  const bulkConfirmLabel =
    selectedTransactionsCount > 0
      ? `선택 전표 확정 (${bulkConfirmCount}건)`
      : `전표 준비 일괄 확정 (${bulkConfirmCount}건)`;
  const writablePeriod = collectingPeriods[0] ?? null;
  const periodScopeLabel =
    writablePeriod?.monthLabel ?? currentPeriod?.monthLabel;
  const periodRangeDescription = writablePeriod
    ? `${writablePeriod.startDate.slice(0, 10)} ~ ${writablePeriod.endDate.slice(0, 10)}`
    : null;
  const activeFilterLabels = [
    keyword.trim() ? `검색: ${keyword.trim()}` : null,
    fundingAccountName ? `자금수단: ${fundingAccountName}` : null,
    categoryName ? `카테고리: ${categoryName}` : null,
    postingStatus ? `상태: ${resolveStatusLabel(postingStatus)}` : null
  ].filter((label): label is string => Boolean(label));
  const renderTransactionActions = React.useCallback(
    (row: CollectedTransactionItem) => {
      const linkedJournalEntry = resolveLatestLinkedJournalEntry(
        journalEntriesById,
        row.postedJournalEntryId
      );
      const isConfirming =
        confirmPending && confirmingTransactionId === row.id;
      const canEdit = canEditCollectedTransaction(row);
      const canDelete = canDeleteCollectedTransaction(row);
      const canConfirm = canConfirmCollectedTransaction(row);
      const actionHint = resolveCollectedTransactionActionHint(
        row.postingStatus
      );

      if (canEdit || canDelete || canConfirm) {
        return (
          <GridStackCell>
            <GridActionCell>
              {canEdit ? (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    onEdit(row);
                  }}
                >
                  수정
                </Button>
              ) : null}
              {canDelete ? (
                <Button
                  size="small"
                  color="error"
                  onClick={() => {
                    onDelete(row);
                  }}
                >
                  삭제
                </Button>
              ) : null}
              {canConfirm ? (
                <Button
                  size="small"
                  variant="contained"
                  disabled={isConfirming}
                  onClick={() => {
                    onConfirm(row);
                  }}
                >
                  {isConfirming ? '확정 중...' : '전표 확정'}
                </Button>
              ) : null}
            </GridActionCell>
            {actionHint ? (
              <Typography variant="caption" color="text.secondary">
                {actionHint}
              </Typography>
            ) : null}
          </GridStackCell>
        );
      }

      if (linkedJournalEntry) {
        return (
          <Button
            size="small"
            component={Link}
            href={`/journal-entries/${linkedJournalEntry.id}`}
          >
            {linkedJournalEntry.entryNumber}
          </Button>
        );
      }

      if (row.postedJournalEntryId) {
        return (
          <Button
            size="small"
            component={Link}
            href={`/journal-entries/${row.postedJournalEntryId}`}
          >
            {row.postedJournalEntryNumber ?? '전표 보기'}
          </Button>
        );
      }

      return (
        <Typography variant="body2" color="text.secondary">
          -
        </Typography>
      );
    },
    [confirmPending, confirmingTransactionId, journalEntriesById, onConfirm, onDelete, onEdit]
  );
  const columns = React.useMemo<GridColDef<CollectedTransactionItem>[]>(
    () => [
      { field: 'businessDate', headerName: '거래일', flex: 0.8 },
      { field: 'title', headerName: '수집 거래', flex: 1.4 },
      { field: 'fundingAccountName', headerName: '자금수단', flex: 1 },
      { field: 'categoryName', headerName: '카테고리', flex: 1 },
      {
        field: 'matchedPlanItemId',
        headerName: '원계획',
        flex: 1.1,
        sortable: false,
        filterable: false,
        renderCell: (params) =>
          params.row.matchedPlanItemId ? (
            <Button
              size="small"
              component={Link}
              href={`/plan-items?planItemId=${params.row.matchedPlanItemId}`}
            >
              {params.row.matchedPlanItemTitle ?? '계획 항목'}
            </Button>
          ) : (
            <Typography variant="body2" color="text.secondary">
              -
            </Typography>
          )
      },
      {
        field: 'sourceKind',
        headerName: '등록 출처',
        flex: 0.8,
        renderCell: (params) => {
          const vehicleLog = params.row.sourceVehicleLog;

          if (vehicleLog) {
            return (
              <Button
                size="small"
                component={Link}
                href={
                  vehicleLog.kind === 'FUEL'
                    ? '/vehicles/fuel'
                    : '/vehicles/maintenance'
                }
              >
                {vehicleLog.kind === 'FUEL'
                  ? `${vehicleLog.vehicleName} 연료`
                  : `${vehicleLog.vehicleName} 정비`}
              </Button>
            );
          }

          return (
            <Typography variant="body2">
              {sourceKindLabelMap[String(params.value)] ?? String(params.value)}
            </Typography>
          );
        }
      },
      {
        field: 'postingStatus',
        headerName: '전표 반영 상태',
        flex: 0.9,
        renderCell: (params) => <StatusChip label={String(params.value)} />
      },
      {
        field: 'amountWon',
        headerName: '금액',
        flex: 1,
        valueFormatter: (value) => formatWon(Number(value))
      },
      {
        field: 'actions',
        headerName: '동작',
        flex: 2.4,
        minWidth: 360,
        sortable: false,
        filterable: false,
        renderCell: (params) => renderTransactionActions(params.row)
      }
    ],
    [renderTransactionActions]
  );

  function handleRowSelectionModelChange(model: GridRowSelectionModel) {
    if (model.type === 'exclude') {
      return;
    }

    const nextSelectedTransactionIds = [...model.ids].map((transactionId) =>
      String(transactionId)
    );
    if (
      areStringArraysEqual(nextSelectedTransactionIds, selectedTransactionIds)
    ) {
      return;
    }

    onSelectedTransactionIdsChange(nextSelectedTransactionIds);
  }

  return (
    <DataTableCard
      title="수집 거래 목록"
      description={
        hasCollectingPeriod
          ? `${periodScopeLabel} 최신 진행월의 수집 거래를 한 곳에서 검토하고 전표 준비 흐름으로 넘깁니다.`
          : '현재 열린 운영 월이 없으므로 목록이 비어 있습니다.'
      }
      toolbar={
        <Stack
          spacing={2}
          sx={{
            p: appLayout.cardPadding,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.default'
          }}
        >
          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            spacing={1.5}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', lg: 'center' }}
          >
            <Stack spacing={0.75}>
              <Stack
                direction="row"
                spacing={1}
                useFlexGap
                flexWrap="wrap"
                alignItems="center"
              >
                {currentPeriod ? (
                  <StatusChip label={currentPeriod.status} />
                ) : (
                  <Chip
                    label="운영 월 없음"
                    size="small"
                    color="warning"
                    variant="outlined"
                  />
                )}
                <Typography variant="body2" fontWeight={600}>
                  {hasCollectingPeriod
                    ? `${periodScopeLabel} 최신 진행월 기준`
                    : '입력 가능한 운영 월이 아직 열리지 않았습니다.'}
                </Typography>
                {activeFilterCount > 0 ? (
                  <Chip
                    label={`필터 ${activeFilterCount}개`}
                    size="small"
                    variant="outlined"
                  />
                ) : null}
                <Chip
                  label={`전표 준비 ${visibleConfirmableTransactionCount}건`}
                  size="small"
                  color="success"
                  variant="outlined"
                />
                <Chip
                  label={`선택 ${selectedTransactionsCount}건`}
                  size="small"
                  color={selectedTransactionsCount > 0 ? 'warning' : 'default'}
                  variant="outlined"
                />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {hasCollectingPeriod
                  ? `${periodRangeDescription} 최신 진행월 범위의 거래를 확인합니다. 이 표에서 수정, 삭제, 전표 확정을 바로 처리할 수 있습니다.`
                  : '먼저 월 운영 화면에서 운영 월을 시작하면 수집 거래 입력과 전표 확정 흐름이 열립니다.'}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Button
                component={Link}
                href="/periods"
                size="small"
                variant="outlined"
              >
                운영 월 보기
              </Button>
              {activeFilterCount > 0 ? (
                <Button
                  size="small"
                  sx={{ flexShrink: 0, minWidth: 104, whiteSpace: 'nowrap' }}
                  onClick={onClearFilters}
                >
                  필터 초기화
                </Button>
              ) : null}
              <Button
                size="small"
                variant="contained"
                disabled={
                  bulkConfirmPending || confirmPending || bulkConfirmCount === 0
                }
                onClick={onBulkConfirm}
              >
                {bulkConfirmLabel}
              </Button>
            </Stack>
          </Stack>

          <ResponsiveFilterPanel
            title="거래 조회조건"
            description="검색어, 자금수단, 카테고리, 전표 반영 상태로 거래 목록을 좁힙니다."
            activeFilterCount={activeFilterCount}
            activeFilterLabels={activeFilterLabels}
            onClear={onClearFilters}
          >
            <Grid container spacing={appLayout.fieldGap}>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  fullWidth
                  label="검색어"
                  size="small"
                  value={keyword}
                  onChange={(event) => {
                    onKeywordChange(event.target.value);
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  select
                  fullWidth
                  label="자금수단"
                  size="small"
                  value={fundingAccountName}
                  onChange={(event) => {
                    onFundingAccountChange(event.target.value);
                  }}
                >
                  <MenuItem value="">전체</MenuItem>
                  {fundingAccountOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  select
                  fullWidth
                  label="카테고리"
                  size="small"
                  value={categoryName}
                  onChange={(event) => {
                    onCategoryChange(event.target.value);
                  }}
                >
                  <MenuItem value="">전체</MenuItem>
                  {categoryOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  select
                  fullWidth
                  label="상태"
                  size="small"
                  value={postingStatus}
                  onChange={(event) => {
                    onPostingStatusChange(event.target.value);
                  }}
                >
                  <MenuItem value="">전체</MenuItem>
                  {collectedTransactionStatusFilterOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      {resolveStatusLabel(option)}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>
          </ResponsiveFilterPanel>
        </Stack>
      }
      rows={hasCollectingPeriod ? rows : []}
      columns={columns}
      mobileCard={(row, context) => (
        <TransactionMobileCard
          row={row}
          context={context}
          actions={renderTransactionActions(row)}
        />
      )}
      mobileEmptyLabel="표시할 수집 거래가 없습니다."
      checkboxSelection
      rowSelectionModel={rowSelectionModel}
      onRowSelectionModelChange={handleRowSelectionModelChange}
      isRowSelectable={(params) => canConfirmCollectedTransaction(params.row)}
    />
  );
}

function TransactionMobileCard({
  row,
  context,
  actions
}: {
  row: CollectedTransactionItem;
  context: DataTableMobileCardContext;
  actions: React.ReactNode;
}) {
  return (
    <Box
      component="article"
      sx={{
        p: 1.5,
        borderRadius: 2,
        border: '1px solid',
        borderColor: context.selected ? 'primary.main' : 'divider',
        bgcolor: context.selected ? 'action.selected' : 'background.paper',
        minWidth: 0
      }}
    >
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          {context.selectable ? (
            <Checkbox
              checked={context.selected}
              onChange={context.toggleSelected}
              size="small"
              sx={{ mt: -0.75, ml: -1, flexShrink: 0 }}
              inputProps={{ 'aria-label': `${row.title} 선택` }}
            />
          ) : null}
          <Stack spacing={0.6} sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle2" fontWeight={800}>
              {row.title}
            </Typography>
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
              <StatusChip label={row.postingStatus} />
              <Chip
                label={sourceKindLabelMap[row.sourceKind] ?? row.sourceKind}
                size="small"
                variant="outlined"
              />
            </Stack>
          </Stack>
          <Typography
            variant="subtitle2"
            fontWeight={900}
            sx={{ flexShrink: 0, textAlign: 'right' }}
          >
            {formatWon(row.amountWon)}
          </Typography>
        </Stack>

        <Divider flexItem />

        <Grid container spacing={1}>
          <Grid size={{ xs: 6 }}>
            <MobileField label="거래일" value={row.businessDate} />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <MobileField label="자금수단" value={row.fundingAccountName} />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <MobileField label="카테고리" value={row.categoryName ?? '미분류'} />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <MobileField
              label="원계획"
              value={row.matchedPlanItemTitle ?? '-'}
            />
          </Grid>
        </Grid>

        <Box sx={{ minWidth: 0 }}>{actions}</Box>
      </Stack>
    </Box>
  );
}

function MobileField({ label, value }: { label: string; value: string }) {
  return (
    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Stack>
  );
}
