import Link from 'next/link';
import * as React from 'react';
import {
  Button,
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
import type { GridColDef } from '@mui/x-data-grid';
import { formatWon } from '@/shared/lib/format';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { appLayout } from '@/shared/ui/layout-metrics';
import { SectionCard } from '@/shared/ui/section-card';
import { StatusChip } from '@/shared/ui/status-chip';
import {
  resolveLatestLinkedJournalEntry,
  sourceKindLabelMap
} from './transactions-page.shared';

export function CurrentPeriodSection({
  currentPeriod
}: {
  currentPeriod: AccountingPeriodItem | null;
}) {
  return (
    <SectionCard
      title="현재 운영 월"
      description="수집 거래 입력과 전표 확정은 현재 열린 운영 월 안에서만 진행됩니다."
    >
      {currentPeriod ? (
        <Grid container spacing={appLayout.fieldGap} alignItems="center">
          <Grid size={{ xs: 12, md: 3 }}>
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary">
                상태
              </Typography>
              <div>
                <StatusChip label={currentPeriod.status} />
              </div>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary">
                운영 월
              </Typography>
              <Typography variant="body1">
                {currentPeriod.monthLabel}
              </Typography>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary">
                허용 거래일 범위
              </Typography>
              <Typography variant="body1">
                {currentPeriod.startDate.slice(0, 10)} ~{' '}
                {currentPeriod.endDate.slice(0, 10)}
              </Typography>
            </Stack>
          </Grid>
        </Grid>
      ) : (
        <Typography variant="body2" color="text.secondary">
          현재 열린 운영 기간이 없습니다. 먼저 `월 운영` 화면에서 대상 월을
          시작해 주세요.
        </Typography>
      )}
    </SectionCard>
  );
}

export function TransactionsFilterSection({
  currentPeriod,
  keyword,
  fundingAccountName,
  categoryName,
  fundingAccountOptions,
  categoryOptions,
  onKeywordChange,
  onFundingAccountChange,
  onCategoryChange
}: {
  currentPeriod: AccountingPeriodItem | null;
  keyword: string;
  fundingAccountName: string;
  categoryName: string;
  fundingAccountOptions: string[];
  categoryOptions: string[];
  onKeywordChange: (value: string) => void;
  onFundingAccountChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
}) {
  return (
      <SectionCard
        title="필터"
        description={
          currentPeriod
            ? `${currentPeriod.monthLabel} 운영 월의 수집 거래를 검색어, 자금수단, 카테고리 기준으로 좁혀 볼 수 있습니다.`
            : '운영 월이 열리면 해당 월의 수집 거래를 필터링할 수 있습니다.'
        }
      >
      <Grid container spacing={appLayout.fieldGap}>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField
            label="검색어"
            size="small"
            value={keyword}
            onChange={(event) => {
              onKeywordChange(event.target.value);
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField
            select
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
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField
            select
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
      </Grid>
    </SectionCard>
  );
}

export function TransactionsTableSection({
  currentPeriod,
  rows,
  journalEntriesById,
  confirmPending,
  confirmingTransactionId,
  onConfirm,
  onEdit,
  onDelete
}: {
  currentPeriod: AccountingPeriodItem | null;
  rows: CollectedTransactionItem[];
  journalEntriesById: Map<string, JournalEntryItem>;
  confirmPending: boolean;
  confirmingTransactionId: string | undefined;
  onConfirm: (transaction: CollectedTransactionItem) => void;
  onEdit: (transaction: CollectedTransactionItem) => void;
  onDelete: (transaction: CollectedTransactionItem) => void;
}) {
  const columns = React.useMemo<GridColDef<CollectedTransactionItem>[]>(
    () => [
      { field: 'businessDate', headerName: '거래일', flex: 0.8 },
      { field: 'title', headerName: '수집 거래', flex: 1.4 },
      { field: 'fundingAccountName', headerName: '자금수단', flex: 1 },
      { field: 'categoryName', headerName: '카테고리', flex: 1 },
      {
        field: 'sourceKind',
        headerName: '수집 원천',
        flex: 0.8,
        valueFormatter: (value) =>
          sourceKindLabelMap[String(value)] ?? String(value)
      },
      {
        field: 'postingStatus',
        headerName: '전표 반영 상태',
        flex: 0.8,
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
        flex: 2,
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

          if (row.postingStatus === 'PENDING') {
            return (
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    onEdit(row);
                  }}
                >
                  수정
                </Button>
                <Button
                  size="small"
                  color="error"
                  onClick={() => {
                    onDelete(row);
                  }}
                >
                  삭제
                </Button>
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
              </Stack>
            );
          }

          if (linkedJournalEntry) {
            return (
              <Button
                size="small"
                component={Link}
                href={`/journal-entries?entryId=${linkedJournalEntry.id}`}
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
                href={`/journal-entries?entryId=${row.postedJournalEntryId}`}
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

  return (
    <DataTableCard
      title="수집 거래 목록"
      description={
        currentPeriod
          ? `${currentPeriod.monthLabel} 운영 월 안의 수집 거래를 확인하고, 보류 상태 거래를 수정하거나 삭제하고 전표로 확정할 수 있습니다.`
          : '현재 열린 운영 월이 없으므로 목록이 비어 있습니다.'
      }
      rows={currentPeriod ? rows : []}
      columns={columns}
    />
  );
}
