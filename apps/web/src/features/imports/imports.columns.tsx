'use client';

import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { Button } from '@mui/material';
import type {
  AccountingPeriodItem,
  ImportBatchItem
} from '@personal-erp/contracts';
import type { GridColDef } from '@mui/x-data-grid';
import { formatWon } from '@/shared/lib/format';
import { StatusChip } from '@/shared/ui/status-chip';
import { ImportedRowStatusCell } from './imports-status-cell';
import {
  isImportedRowOccurredOnInPeriod,
  readParsedRowPreview,
  sourceKindOptions,
  type ImportedRowTableItem
} from './imports.shared';

export function buildImportBatchColumns(input: {
  currentPeriod: AccountingPeriodItem | null;
  selectedBatchId: string | null;
  onSelectBatch: (batch: ImportBatchItem) => void;
  actionLabel?: string;
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
      headerName: '원본 종류',
      flex: 0.8,
      valueFormatter: (value) =>
        sourceKindOptions.find((option) => option.value === value)?.label ??
        String(value)
    },
    {
      field: 'fundingAccountName',
      headerName: '연결 계좌/카드',
      flex: 1,
      valueFormatter: (value) => (value ? String(value) : '-')
    },
    {
      field: 'parseStatus',
      headerName: '읽기 상태',
      flex: 0.8,
      renderCell: (params) => <StatusChip label={String(params.value)} />
    },
    {
      field: 'rowCount',
      headerName: '행 수',
      flex: 0.6
    },
    {
      field: 'collectableRowCount',
      headerName: '등록 가능 행',
      flex: 0.8,
      sortable: false,
      filterable: false,
      renderCell: (params) =>
        `${countCollectableBatchRows(params.row, input.currentPeriod)}건`
    },
    {
      field: 'collectedRowCount',
      headerName: '연결 완료 행',
      flex: 0.8,
      sortable: false,
      filterable: false,
      renderCell: (params) => `${countCollectedBatchRows(params.row)}건`
    },
    {
      field: 'actions',
      headerName: '동작',
      flex: 0.9,
      minWidth: 150,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const selected = input.selectedBatchId === params.row.id;

        return (
          <Button
            size="small"
            variant={selected ? 'contained' : 'outlined'}
            href={selected ? `/imports/${params.row.id}` : undefined}
            endIcon={selected ? <ArrowForwardRoundedIcon /> : undefined}
            onClick={
              selected
                ? undefined
                : () => {
                    input.onSelectBatch(params.row);
                  }
            }
            sx={{ whiteSpace: 'nowrap' }}
          >
            {selected ? '작업대 열기' : (input.actionLabel ?? '선택')}
          </Button>
        );
      }
    }
  ];
}

function countCollectableBatchRows(
  batch: ImportBatchItem,
  currentPeriod: AccountingPeriodItem | null
) {
  return batch.rows.filter((row) => {
    if (row.parseStatus !== 'PARSED' || row.createdCollectedTransactionId) {
      return false;
    }

    const parsed = readParsedRowPreview(row);

    return parsed
      ? isImportedRowOccurredOnInPeriod(parsed.occurredOn, currentPeriod)
      : false;
  }).length;
}

function countCollectedBatchRows(batch: ImportBatchItem) {
  return batch.rows.filter((row) => Boolean(row.createdCollectedTransactionId))
    .length;
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
      field: 'direction',
      headerName: '입출금',
      flex: 0.7,
      valueFormatter: (value) =>
        value === 'DEPOSIT'
          ? '입금'
          : value === 'WITHDRAWAL'
            ? '출금'
            : value === 'REVERSAL'
              ? '승인취소'
              : '-'
    },
    {
      field: 'amount',
      headerName: '금액',
      flex: 0.9,
      valueFormatter: (value) =>
        value == null ? '-' : formatWon(Number(value))
    },
    {
      field: 'balanceAfter',
      headerName: '거래후잔액',
      flex: 0.9,
      valueFormatter: (value) =>
        value == null ? '-' : formatWon(Number(value))
    },
    {
      field: 'parseStatus',
      headerName: '읽기',
      flex: 0.8,
      renderCell: (params) => <StatusChip label={String(params.value)} />
    },
    {
      field: 'createdCollectedTransactionId',
      headerName: '거래 등록 상태',
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
