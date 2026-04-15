'use client';

import * as React from 'react';
import { Chip, Stack, Typography } from '@mui/material';
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
  onPrepareCollect
}: {
  selectedBatch: ImportBatchItem | null;
  rows: ImportedRowTableItem[];
  selectedRowId: string | null;
  onPrepareCollect: (row: ImportedRowTableItem) => void;
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

  return (
    <DataTableCard
      title={selectedBatch ? `${selectedBatch.fileName} 업로드 행` : '업로드 행'}
      description={
        selectedBatch
          ? `${selectedBatch.fileName}의 행을 검토하고, 필요한 행만 수집 거래로 승격합니다.`
          : '먼저 업로드 배치를 선택해 주세요.'
      }
      toolbar={
        selectedBatch ? (
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
                label={`승격 가능 ${collectableCount}건`}
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
            </Stack>
            <Typography variant="body2" color="text.secondary">
              파싱 완료 행만 승격 준비를 열 수 있고, 이미 연결된 행은 결과 보기로 추적합니다.
            </Typography>
          </Stack>
        ) : null
      }
      rows={rows}
      columns={buildImportedRowsColumns({ selectedRowId, onPrepareCollect })}
      height={420}
    />
  );
}
