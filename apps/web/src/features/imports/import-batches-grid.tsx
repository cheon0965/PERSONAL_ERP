'use client';

import * as React from 'react';
import {
  Button,
  Chip,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import type {
  AccountingPeriodItem,
  ImportBatchItem
} from '@personal-erp/contracts';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { buildImportBatchColumns } from './imports.columns';
import {
  readImportBatchParseStatusLabel,
  sourceKindOptions
} from './imports.shared';

type ImportBatchGridFilters = {
  keyword: string;
  parseStatus: string;
  sourceKind: string;
};

export function ImportBatchesGrid({
  batches,
  currentPeriod,
  selectedBatchId,
  onSelectBatch,
  helperText = '선택한 배치 기준으로 업로드 행 작업대로 바로 이동합니다.',
  actionLabel = '작업대 열기'
}: {
  batches: ImportBatchItem[];
  currentPeriod: AccountingPeriodItem | null;
  selectedBatchId: string | null;
  onSelectBatch: (batch: ImportBatchItem) => void;
  helperText?: string;
  actionLabel?: string;
}) {
  const [filters, setFilters] = React.useState<ImportBatchGridFilters>({
    keyword: '',
    parseStatus: '',
    sourceKind: ''
  });
  const filteredBatches = React.useMemo(
    () => filterImportBatches(batches, filters),
    [batches, filters]
  );
  const statusSummary = React.useMemo(() => {
    const counts: Record<ImportBatchItem['parseStatus'], number> = {
      COMPLETED: 0,
      PARTIAL: 0,
      FAILED: 0,
      PENDING: 0
    };

    filteredBatches.forEach((batch) => {
      counts[batch.parseStatus] += 1;
    });

    const order: ImportBatchItem['parseStatus'][] = [
      'COMPLETED',
      'PARTIAL',
      'FAILED',
      'PENDING'
    ];

    return order
      .map((status) => ({ status, count: counts[status] }))
      .filter((item) => item.count > 0);
  }, [filteredBatches]);
  const hasActiveFilter = Object.values(filters).some((value) => value !== '');

  return (
    <DataTableCard
      title="업로드 배치"
      description="최근 배치를 확인하고, 선택한 배치의 업로드 행을 바로 검토합니다."
      toolbar={
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
        >
          <Stack spacing={1.25} sx={{ width: '100%' }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1}
              alignItems={{ xs: 'stretch', md: 'center' }}
            >
              <TextField
                label="검색어"
                size="small"
                value={filters.keyword}
                onChange={(event) =>
                  setFilters({ ...filters, keyword: event.target.value })
                }
                placeholder="파일명, 원본, 계좌/카드"
                sx={{ minWidth: { md: 260 }, flex: 1 }}
              />
              <TextField
                select
                label="읽기 상태"
                size="small"
                value={filters.parseStatus}
                onChange={(event) =>
                  setFilters({ ...filters, parseStatus: event.target.value })
                }
                sx={{ minWidth: { md: 150 } }}
              >
                <MenuItem value="">전체</MenuItem>
                <MenuItem value="COMPLETED">완료</MenuItem>
                <MenuItem value="PARTIAL">부분 성공</MenuItem>
                <MenuItem value="FAILED">실패</MenuItem>
                <MenuItem value="PENDING">대기</MenuItem>
              </TextField>
              <TextField
                select
                label="원본 종류"
                size="small"
                value={filters.sourceKind}
                onChange={(event) =>
                  setFilters({ ...filters, sourceKind: event.target.value })
                }
                sx={{ minWidth: { md: 170 } }}
              >
                <MenuItem value="">전체</MenuItem>
                {sourceKindOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                variant="outlined"
                disabled={!hasActiveFilter}
                sx={{ flexShrink: 0, minWidth: 88, whiteSpace: 'nowrap' }}
                onClick={() =>
                  setFilters({
                    keyword: '',
                    parseStatus: '',
                    sourceKind: ''
                  })
                }
              >
                초기화
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Chip
                label={`전체 ${batches.length}건`}
                size="small"
                variant="outlined"
              />
              {statusSummary.map((item) => (
                <Chip
                  key={item.status}
                  label={`${readImportBatchParseStatusLabel(item.status)} ${item.count}건`}
                  size="small"
                  color={
                    item.status === 'COMPLETED'
                      ? 'success'
                      : item.status === 'PARTIAL'
                        ? 'warning'
                        : item.status === 'FAILED'
                          ? 'error'
                          : 'default'
                  }
                  variant={item.status === 'COMPLETED' ? 'filled' : 'outlined'}
                />
              ))}
            </Stack>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {helperText}
          </Typography>
        </Stack>
      }
      rows={filteredBatches}
      columns={buildImportBatchColumns({
        currentPeriod,
        selectedBatchId,
        onSelectBatch,
        actionLabel
      })}
      height={360}
    />
  );
}

function filterImportBatches(
  batches: ImportBatchItem[],
  filters: ImportBatchGridFilters
) {
  const keyword = normalizeFilterText(filters.keyword);

  return batches.filter((batch) => {
    if (filters.parseStatus && batch.parseStatus !== filters.parseStatus) {
      return false;
    }

    if (filters.sourceKind && batch.sourceKind !== filters.sourceKind) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    const haystack = normalizeFilterText(
      [
        batch.fileName,
        batch.sourceKind,
        batch.parseStatus,
        batch.fundingAccountName,
        batch.uploadedAt
      ]
        .filter(Boolean)
        .join(' ')
    );

    return haystack.includes(keyword);
  });
}

function normalizeFilterText(value: string) {
  return value.trim().toLocaleLowerCase('ko-KR');
}
