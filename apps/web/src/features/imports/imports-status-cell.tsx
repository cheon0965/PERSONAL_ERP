'use client';

import Link from 'next/link';
import { Button, Typography } from '@mui/material';
import { GridActionCell } from '@/shared/ui/data-grid-cell';
import { StatusChip } from '@/shared/ui/status-chip';
import type { ImportedRowTableItem } from './imports.shared';

export function ImportedRowStatusCell({
  row,
  onPrepare
}: {
  row: ImportedRowTableItem;
  onPrepare: (row: ImportedRowTableItem) => void;
}) {
  if (row.collectionSummary) {
    return (
      <GridActionCell>
        <StatusChip
          label={row.collectionSummary.createdCollectedTransactionStatus}
        />
        <Button
          size="small"
          component={Link}
          href={`/transactions?transactionId=${row.collectionSummary.createdCollectedTransactionId}`}
        >
          보기
        </Button>
      </GridActionCell>
    );
  }

  if (row.parseStatus !== 'PARSED') {
    return (
      <Typography variant="body2" color="error.main">
        오류 보류
      </Typography>
    );
  }

  if (!row.isCurrentPeriodRow) {
    return (
      <Typography variant="body2" color="text.secondary">
        운영월 밖
      </Typography>
    );
  }

  return (
    <Button
      size="small"
      variant="contained"
      onClick={() => onPrepare(row)}
    >
      거래 등록
    </Button>
  );
}
