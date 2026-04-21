'use client';

import * as React from 'react';
import type { GridRowSelectionModel } from '@mui/x-data-grid';
import {
  Button,
  Chip,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import type {
  BulkCollectImportedRowsRequest,
  CategoryItem,
  ImportBatchCollectionJobItem,
  ImportBatchItem
} from '@personal-erp/contracts';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { buildImportedRowsColumns } from './imports.columns';
import {
  readImportedRowParseStatusLabel,
  type ImportedRowTableItem
} from './imports.shared';

type BulkCollectForm = {
  type: '' | NonNullable<BulkCollectImportedRowsRequest['type']>;
  categoryId: string;
  memo: string;
};

export function ImportedRowsGrid({
  selectedBatch,
  rows,
  selectedRowId,
  selectedRowIds,
  selectedRowsCount,
  collectableRowCount,
  selectedCollectableRowCount,
  bulkCollectForm,
  categories,
  bulkCollectJob,
  bulkCollectPending,
  onBulkCollectFormChange,
  onSelectedRowIdsChange,
  onPrepareCollect,
  onBulkCollect
}: {
  selectedBatch: ImportBatchItem | null;
  rows: ImportedRowTableItem[];
  selectedRowId: string | null;
  selectedRowIds: string[];
  selectedRowsCount: number;
  collectableRowCount: number;
  selectedCollectableRowCount: number;
  bulkCollectForm: BulkCollectForm;
  categories: CategoryItem[];
  bulkCollectJob: ImportBatchCollectionJobItem | null;
  bulkCollectPending: boolean;
  onBulkCollectFormChange: (patch: Partial<BulkCollectForm>) => void;
  onSelectedRowIdsChange: (rowIds: string[]) => void;
  onPrepareCollect: (row: ImportedRowTableItem) => void;
  onBulkCollect: () => void;
}) {
  const parseSummary = React.useMemo(() => {
    const counts: Record<ImportedRowTableItem['parseStatus'], number> = {
      PARSED: 0,
      FAILED: 0,
      SKIPPED: 0,
      PENDING: 0
    };

    rows.forEach((row) => {
      counts[row.parseStatus] += 1;
    });

    const order: ImportedRowTableItem['parseStatus'][] = [
      'PARSED',
      'FAILED',
      'SKIPPED',
      'PENDING'
    ];

    return order
      .map((status) => ({ status, count: counts[status] }))
      .filter((item) => item.count > 0);
  }, [rows]);
  const collectedCount = rows.filter((row) => row.collectionSummary).length;
  const collectableCount = rows.filter(
    (row) => row.parseStatus === 'PARSED' && !row.createdCollectedTransactionId
  ).length;
  const rowSelectionModel = React.useMemo<GridRowSelectionModel>(
    () => ({
      type: 'include',
      ids: new Set(selectedRowIds)
    }),
    [selectedRowIds]
  );
  const bulkCollectLabel =
    selectedRowsCount > 0
      ? `선택 행 일괄 등록 (${selectedCollectableRowCount}건)`
      : `등록 가능 행 일괄 등록 (${collectableRowCount}건)`;
  const bulkCollectDisabled =
    bulkCollectPending ||
    (selectedRowsCount > 0
      ? selectedCollectableRowCount === 0
      : collectableRowCount === 0);
  const bulkCollectProgress =
    bulkCollectJob && bulkCollectJob.requestedRowCount > 0
      ? Math.round(
          (bulkCollectJob.processedRowCount /
            bulkCollectJob.requestedRowCount) *
            100
        )
      : 0;

  function handleRowSelectionModelChange(model: GridRowSelectionModel) {
    if (model.type === 'exclude') {
      return;
    }

    onSelectedRowIdsChange([...model.ids].map((rowId) => String(rowId)));
  }

  return (
    <DataTableCard
      title={
        selectedBatch ? `${selectedBatch.fileName} 업로드 행` : '업로드 행'
      }
      description={
        selectedBatch
          ? `${selectedBatch.fileName}의 행을 검토하고, 필요한 행만 수집 거래로 등록합니다.`
          : '먼저 업로드 배치를 선택해 주세요.'
      }
      toolbar={
        selectedBatch ? (
          <Stack spacing={1.5}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1.5}
              alignItems={{ xs: 'stretch', md: 'center' }}
            >
              <TextField
                select
                label="일괄 거래유형"
                size="small"
                value={bulkCollectForm.type}
                onChange={(event) => {
                  onBulkCollectFormChange({
                    type: event.target.value as typeof bulkCollectForm.type
                  });
                }}
                sx={{ minWidth: { md: 180 } }}
              >
                <MenuItem value="">행 방향 자동</MenuItem>
                <MenuItem value="EXPENSE">지출</MenuItem>
                <MenuItem value="INCOME">수입</MenuItem>
                <MenuItem value="TRANSFER">이체</MenuItem>
                <MenuItem value="REVERSAL">승인취소</MenuItem>
              </TextField>
              <TextField
                select
                label="일괄 카테고리"
                size="small"
                value={bulkCollectForm.categoryId}
                onChange={(event) => {
                  onBulkCollectFormChange({
                    categoryId: event.target.value
                  });
                }}
                sx={{ minWidth: { md: 240 } }}
              >
                <MenuItem value="">자동/미지정</MenuItem>
                {categories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="일괄 메모"
                size="small"
                value={bulkCollectForm.memo}
                onChange={(event) => {
                  onBulkCollectFormChange({
                    memo: event.target.value
                  });
                }}
                sx={{ minWidth: { md: 220 }, flex: 1 }}
              />
            </Stack>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1.5}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', md: 'center' }}
            >
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {parseSummary.map((item) => (
                  <Chip
                    key={item.status}
                    label={`${readImportedRowParseStatusLabel(item.status)} ${item.count}건`}
                    size="small"
                    color={
                      item.status === 'PARSED'
                        ? 'success'
                        : item.status === 'FAILED'
                          ? 'error'
                          : 'default'
                    }
                    variant={item.status === 'PARSED' ? 'filled' : 'outlined'}
                  />
                ))}
                <Chip
                  label={`등록 가능 ${collectableCount}건`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
                <Chip
                  label={`연결 완료 ${collectedCount}건`}
                  size="small"
                  color="info"
                  variant="outlined"
                />
                <Chip
                  label={`선택 ${selectedRowsCount}건`}
                  size="small"
                  color={selectedRowsCount > 0 ? 'warning' : 'default'}
                  variant="outlined"
                />
              </Stack>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ xs: 'stretch', sm: 'center' }}
              >
                <Button
                  variant="contained"
                  onClick={onBulkCollect}
                  disabled={bulkCollectDisabled}
                >
                  {bulkCollectLabel}
                </Button>
              </Stack>
              {bulkCollectJob ? (
                <Stack spacing={0.75}>
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    <Typography variant="body2" color="text.secondary">
                      일괄 등록 {bulkCollectJob.status} ·{' '}
                      {bulkCollectJob.processedRowCount}/
                      {bulkCollectJob.requestedRowCount}건 처리 · 성공{' '}
                      {bulkCollectJob.succeededCount}건 · 실패{' '}
                      {bulkCollectJob.failedCount}건
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {bulkCollectProgress}%
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={bulkCollectProgress}
                  />
                </Stack>
              ) : null}
            </Stack>
            <Typography variant="body2" color="text.secondary">
              읽기 완료이면서 아직 연결되지 않은 행만 선택할 수 있습니다.
              거래유형을 자동으로 두면 행별 입출금 방향을 따르고, 카테고리를
              고르면 선택 범위 전체에 같은 분류를 적용합니다.
            </Typography>
          </Stack>
        ) : null
      }
      rows={rows}
      columns={buildImportedRowsColumns({
        selectedRowId,
        onPrepareCollect
      })}
      height={420}
      checkboxSelection
      rowSelectionModel={rowSelectionModel}
      onRowSelectionModelChange={handleRowSelectionModelChange}
      isRowSelectable={(params) =>
        params.row.parseStatus === 'PARSED' &&
        !params.row.createdCollectedTransactionId
      }
    />
  );
}
