'use client';

import * as React from 'react';
import type { GridRowSelectionModel } from '@mui/x-data-grid';
import { Button, Chip, Stack, Typography } from '@mui/material';
import type { ImportBatchItem } from '@personal-erp/contracts';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { buildImportedRowsColumns } from './imports.columns';
import {
  readImportedRowParseStatusLabel,
  type ImportedRowTableItem
} from './imports.shared';

export function ImportedRowsGrid({
  selectedBatch,
  rows,
  selectedRowId,
  selectedRowIds,
  selectedRowsCount,
  currentPeriodCollectableRowCount,
  selectedCurrentPeriodCollectableRowCount,
  bulkCollectPending,
  onSelectedRowIdsChange,
  onPrepareCollect,
  onBulkCollect
}: {
  selectedBatch: ImportBatchItem | null;
  rows: ImportedRowTableItem[];
  selectedRowId: string | null;
  selectedRowIds: string[];
  selectedRowsCount: number;
  currentPeriodCollectableRowCount: number;
  selectedCurrentPeriodCollectableRowCount: number;
  bulkCollectPending: boolean;
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
      ? `선택 행 일괄 등록 (${selectedCurrentPeriodCollectableRowCount}건)`
      : `현재 기간 등록 가능 행 일괄 등록 (${currentPeriodCollectableRowCount}건)`;
  const bulkCollectDisabled =
    bulkCollectPending ||
    (selectedRowsCount > 0
      ? selectedCurrentPeriodCollectableRowCount === 0
      : currentPeriodCollectableRowCount === 0);

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
            </Stack>
            <Typography variant="body2" color="text.secondary">
              연결되지 않은 행만 선택할 수 있습니다. 선택 체크는 배치 상세
              일괄 등록 범위를 고르는 용도로만 사용합니다.
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
      isRowSelectable={(params) => !params.row.createdCollectedTransactionId}
    />
  );
}
