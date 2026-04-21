import Link from 'next/link';
import * as React from 'react';
import {
  Button,
  Chip,
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
import { DataTableCard } from '@/shared/ui/data-table-card';
import { appLayout } from '@/shared/ui/layout-metrics';
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
  const periodScopeLabel =
    collectingPeriods.length > 1
      ? '열린 운영 월'
      : (currentPeriod?.monthLabel ?? collectingPeriods[0]?.monthLabel);
  const periodRangeDescription =
    collectingPeriods.length > 1
      ? '열린 운영 기간'
      : collectingPeriods[0]
        ? `${collectingPeriods[0].startDate.slice(0, 10)} ~ ${collectingPeriods[0].endDate.slice(0, 10)}`
        : null;
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
        valueFormatter: (value) =>
          sourceKindLabelMap[String(value)] ?? String(value)
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
        sortable: false,
        filterable: false,
        renderCell: (params) => {
          const row = params.row;
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
              <Stack spacing={0.5} sx={{ py: 0.5 }}>
                <Stack direction="row" spacing={1}>
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
                </Stack>
                {actionHint ? (
                  <Typography variant="caption" color="text.secondary">
                    {actionHint}
                  </Typography>
                ) : null}
              </Stack>
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
        }
      }
    ],
    [
      confirmPending,
      confirmingTransactionId,
      journalEntriesById,
      onConfirm,
      onDelete,
      onEdit
    ]
  );

  function handleRowSelectionModelChange(model: GridRowSelectionModel) {
    if (model.type === 'exclude') {
      return;
    }

    onSelectedTransactionIdsChange(
      [...model.ids].map((transactionId) => String(transactionId))
    );
  }

  return (
    <DataTableCard
      title="수집 거래 목록"
      description={
        hasCollectingPeriod
          ? `${periodScopeLabel}의 수집 거래를 한 곳에서 검토하고 전표 준비 흐름으로 넘깁니다.`
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
                    ? `${periodScopeLabel} 기준`
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
                  ? `${periodRangeDescription} 범위의 거래를 확인합니다. 이 표에서 수정, 삭제, 전표 확정을 바로 처리할 수 있습니다.`
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
                <Button size="small" onClick={onClearFilters}>
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
        </Stack>
      }
      rows={hasCollectingPeriod ? rows : []}
      columns={columns}
      checkboxSelection
      rowSelectionModel={rowSelectionModel}
      onRowSelectionModelChange={handleRowSelectionModelChange}
      isRowSelectable={(params) => canConfirmCollectedTransaction(params.row)}
    />
  );
}
