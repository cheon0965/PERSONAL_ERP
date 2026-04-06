'use client';

import { Button } from '@mui/material';
import type { ImportBatchItem } from '@personal-erp/contracts';
import type { GridColDef } from '@mui/x-data-grid';
import { formatWon } from '@/shared/lib/format';
import { StatusChip } from '@/shared/ui/status-chip';
import { ImportedRowStatusCell } from './imports-status-cell';
import { sourceKindOptions, type ImportedRowTableItem } from './imports.shared';

export function buildImportBatchColumns(input: {
  selectedBatchId: string | null;
  onSelectBatch: (batch: ImportBatchItem) => void;
}): GridColDef<ImportBatchItem>[] {
  return [
    {
      field: 'uploadedAt',
      headerName: '업로드 시각',
      flex: 1.1,
      valueFormatter: (value) => String(value).slice(0, 16).replace('T', ' ')
    },
    { field: 'fileName', headerName: '파일명', flex: 1.3 },
    {
      field: 'sourceKind',
      headerName: '원천',
      flex: 0.8,
      valueFormatter: (value) =>
        sourceKindOptions.find((option) => option.value === value)?.label ??
        String(value)
    },
    {
      field: 'parseStatus',
      headerName: '파싱 상태',
      flex: 0.8,
      renderCell: (params) => <StatusChip label={String(params.value)} />
    },
    {
      field: 'rowCount',
      headerName: '행 수',
      flex: 0.6
    },
    {
      field: 'actions',
      headerName: '동작',
      flex: 0.9,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Button
          size="small"
          variant={input.selectedBatchId === params.row.id ? 'contained' : 'text'}
          onClick={() => input.onSelectBatch(params.row)}
        >
          행 보기
        </Button>
      )
    }
  ];
}

export function buildImportedRowsColumns(input: {
  selectedRowId: string | null;
  onPrepareCollect: (row: ImportedRowTableItem) => void;
}): GridColDef<ImportedRowTableItem>[] {
  return [
    { field: 'rowNumber', headerName: '행', flex: 0.5 },
    { field: 'occurredOn', headerName: '거래일', flex: 0.8 },
    { field: 'title', headerName: '설명', flex: 1.3 },
    {
      field: 'amount',
      headerName: '금액',
      flex: 0.9,
      valueFormatter: (value) => (value == null ? '-' : formatWon(Number(value)))
    },
    {
      field: 'parseStatus',
      headerName: '파싱',
      flex: 0.8,
      renderCell: (params) => <StatusChip label={String(params.value)} />
    },
    {
      field: 'createdCollectedTransactionId',
      headerName: '승격 상태',
      flex: 1.4,
      sortable: false,
      renderCell: (params) => (
        <ImportedRowStatusCell
          row={params.row}
          selectedRowId={input.selectedRowId}
          onPrepare={input.onPrepareCollect}
        />
      )
    }
  ];
}
