'use client';

import * as React from 'react';
import type { GridRowSelectionModel } from '@mui/x-data-grid';
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import type {
  CategoryItem,
  ImportBatchBalanceDiscrepancy,
  ImportBatchCollectionJobItem,
  ImportBatchItem
} from '@personal-erp/contracts';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { ResponsiveFilterPanel } from '@/shared/ui/responsive-filter-panel';
import { buildImportedRowsColumns } from './imports.columns';
import {
  readImportedRowParseStatusLabel,
  type ImportedRowTableItem
} from './imports.shared';
import { formatWon } from '@/shared/lib/format';
import {
  bulkCollectTransactionTypes,
  type BulkCollectFormState
} from './use-imports-page';

type BulkCollectTransactionType = keyof BulkCollectFormState['typeOptions'];

type ImportedRowsFilters = {
  keyword: string;
  parseStatus: string;
  collectionStatus: string;
  periodScope: string;
};

const bulkCollectTransactionTypeLabels: Record<
  BulkCollectTransactionType,
  string
> = {
  INCOME: '수입',
  EXPENSE: '지출',
  TRANSFER: '이체',
  REVERSAL: '승인취소'
};

export function ImportedRowsGrid({
  selectedBatch,
  rows,
  selectedRowIds,
  bulkCollectForm,
  categories,
  bulkCollectJob,
  bulkCollectPending,
  cancelBulkCollectPending,
  onBulkCollectFormChange,
  onSelectedRowIdsChange,
  onPrepareCollect,
  onBulkCollect,
  onCancelBulkCollect
}: {
  selectedBatch: ImportBatchItem | null;
  rows: ImportedRowTableItem[];
  selectedRowIds: string[];
  selectedRowsCount: number;
  collectableRowCount: number;
  selectedCollectableRowCount: number;
  bulkCollectForm: BulkCollectFormState;
  categories: CategoryItem[];
  bulkCollectJob: ImportBatchCollectionJobItem | null;
  bulkCollectPending: boolean;
  cancelBulkCollectPending: boolean;
  onBulkCollectFormChange: (patch: Partial<BulkCollectFormState>) => void;
  onSelectedRowIdsChange: (rowIds: string[]) => void;
  onPrepareCollect: (row: ImportedRowTableItem) => void;
  onBulkCollect: (rowIds?: string[]) => void;
  onCancelBulkCollect: () => void;
}) {
  const [filters, setFilters] = React.useState<ImportedRowsFilters>({
    keyword: '',
    parseStatus: '',
    collectionStatus: '',
    periodScope: ''
  });
  const filteredRows = React.useMemo(
    () => filterImportedRows(rows, filters),
    [filters, rows]
  );
  React.useEffect(() => {
    const visibleRowIds = new Set(filteredRows.map((row) => row.id));
    const nextSelectedRowIds = selectedRowIds.filter((rowId) =>
      visibleRowIds.has(rowId)
    );

    if (nextSelectedRowIds.length !== selectedRowIds.length) {
      onSelectedRowIdsChange(nextSelectedRowIds);
    }
  }, [filteredRows, onSelectedRowIdsChange, selectedRowIds]);
  const visibleSelectedRows = React.useMemo(
    () => filteredRows.filter((row) => selectedRowIds.includes(row.id)),
    [filteredRows, selectedRowIds]
  );
  const visibleSelectedRowsCount = visibleSelectedRows.length;
  const visibleCollectableRowCount = React.useMemo(
    () => filteredRows.filter((row) => isImportedRowCollectable(row)).length,
    [filteredRows]
  );
  const visibleSelectedCollectableRowCount = React.useMemo(
    () =>
      visibleSelectedRows.filter((row) => isImportedRowCollectable(row)).length,
    [visibleSelectedRows]
  );
  const hasActiveFilter = Object.values(filters).some((value) => value !== '');
  const activeFilterLabels = [
    filters.keyword.trim() ? `검색: ${filters.keyword.trim()}` : null,
    filters.parseStatus
      ? `읽기: ${readImportedRowParseStatusLabel(
          filters.parseStatus as ImportedRowTableItem['parseStatus']
        )}`
      : null,
    filters.collectionStatus
      ? `등록: ${readCollectionStatusFilterLabel(filters.collectionStatus)}`
      : null,
    filters.periodScope
      ? `운영월: ${filters.periodScope === 'CURRENT' ? '현재 운영월' : '운영월 밖'}`
      : null
  ].filter((label): label is string => Boolean(label));
  const clearFilters = () =>
    setFilters({
      keyword: '',
      parseStatus: '',
      collectionStatus: '',
      periodScope: ''
    });
  const parseSummary = React.useMemo(() => {
    const counts: Record<ImportedRowTableItem['parseStatus'], number> = {
      PARSED: 0,
      FAILED: 0,
      SKIPPED: 0,
      PENDING: 0
    };

    filteredRows.forEach((row) => {
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
  }, [filteredRows]);
  const collectedCount = filteredRows.filter(
    (row) => row.collectionSummary
  ).length;
  const collectableCount = filteredRows.filter((row) =>
    isImportedRowCollectable(row)
  ).length;
  const outsideCurrentPeriodCount = filteredRows.filter(
    (row) =>
      row.parseStatus === 'PARSED' &&
      !row.createdCollectedTransactionId &&
      !row.isCurrentPeriodRow
  ).length;
  const rowSelectionModel = React.useMemo<GridRowSelectionModel>(
    () => ({
      type: 'include',
      ids: new Set(selectedRowIds)
    }),
    [selectedRowIds]
  );
  const bulkCollectLabel =
    visibleSelectedRowsCount > 0
      ? `선택 행 일괄 등록 (${visibleSelectedCollectableRowCount}건)`
      : `등록 가능 행 일괄 등록 (${visibleCollectableRowCount}건)`;
  const bulkCollectDisabled =
    bulkCollectPending ||
    (visibleSelectedRowsCount > 0
      ? visibleSelectedCollectableRowCount === 0
      : visibleCollectableRowCount === 0);
  const collectableRowIdSet = React.useMemo(
    () =>
      new Set(
        filteredRows
          .filter((row) => isImportedRowCollectable(row))
          .map((row) => row.id)
      ),
    [filteredRows]
  );
  const targetRows = React.useMemo(
    () =>
      selectedRowIds.length > 0
        ? filteredRows.filter(
            (row) =>
              selectedRowIds.includes(row.id) && isImportedRowCollectable(row)
          )
        : filteredRows.filter((row) => isImportedRowCollectable(row)),
    [filteredRows, selectedRowIds]
  );
  const activeTypeBreakdown = React.useMemo(() => {
    const counts: Record<BulkCollectTransactionType, number> = {
      INCOME: 0,
      EXPENSE: 0,
      TRANSFER: 0,
      REVERSAL: 0
    };

    targetRows.forEach((row) => {
      const type = resolveImportedRowBulkCollectType(row);

      if (type) {
        counts[type] += 1;
      }
    });

    return bulkCollectTransactionTypes
      .map((type) => ({
        type,
        label: bulkCollectTransactionTypeLabels[type],
        count: counts[type]
      }))
      .filter((item) => item.count > 0);
  }, [targetRows]);
  const unresolvedTargetCount = React.useMemo(
    () =>
      targetRows.filter((row) => !resolveImportedRowBulkCollectType(row))
        .length,
    [targetRows]
  );
  const categoryNameById = React.useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );
  const bulkCollectProgress =
    bulkCollectJob && bulkCollectJob.requestedRowCount > 0
      ? Math.round(
          (bulkCollectJob.processedRowCount /
            bulkCollectJob.requestedRowCount) *
            100
        )
      : 0;
  const canCancelBulkCollectJob =
    bulkCollectJob?.status === 'PENDING' ||
    bulkCollectJob?.status === 'RUNNING';

  function handleRowSelectionModelChange(model: GridRowSelectionModel) {
    if (model.type === 'exclude') {
      return;
    }

    onSelectedRowIdsChange([...model.ids].map((rowId) => String(rowId)));
  }

  function updateBulkCollectTypeOption(
    type: BulkCollectTransactionType,
    patch: Partial<
      BulkCollectFormState['typeOptions'][BulkCollectTransactionType]
    >
  ) {
    onBulkCollectFormChange({
      typeOptions: {
        ...bulkCollectForm.typeOptions,
        [type]: {
          ...bulkCollectForm.typeOptions[type],
          ...patch
        }
      }
    });
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
            {selectedBatch.balanceDiscrepancy ? (
              <BalanceDiscrepancyAlert
                discrepancy={selectedBatch.balanceDiscrepancy}
                fundingAccountName={selectedBatch.fundingAccountName}
              />
            ) : null}
            <ResponsiveFilterPanel
              title="업로드 행 조회조건"
              activeFilterCount={activeFilterLabels.length}
              activeFilterLabels={activeFilterLabels}
              onClear={clearFilters}
            >
              <Stack
                direction={{ xs: 'column', lg: 'row' }}
                spacing={1}
                alignItems={{ xs: 'stretch', lg: 'center' }}
              >
                <TextField
                  label="검색어"
                  size="small"
                  value={filters.keyword}
                  onChange={(event) =>
                    setFilters({ ...filters, keyword: event.target.value })
                  }
                  placeholder="날짜, 설명, 금액"
                  sx={{ minWidth: { lg: 240 }, flex: 1 }}
                />
                <TextField
                  select
                  label="읽기"
                  size="small"
                  value={filters.parseStatus}
                  onChange={(event) =>
                    setFilters({ ...filters, parseStatus: event.target.value })
                  }
                  sx={{ minWidth: { lg: 140 } }}
                >
                  <MenuItem value="">전체</MenuItem>
                  <MenuItem value="PARSED">읽기 완료</MenuItem>
                  <MenuItem value="FAILED">실패</MenuItem>
                  <MenuItem value="SKIPPED">건너뜀</MenuItem>
                  <MenuItem value="PENDING">대기</MenuItem>
                </TextField>
                <TextField
                  select
                  label="등록 상태"
                  size="small"
                  value={filters.collectionStatus}
                  onChange={(event) =>
                    setFilters({
                      ...filters,
                      collectionStatus: event.target.value
                    })
                  }
                  sx={{ minWidth: { lg: 150 } }}
                >
                  <MenuItem value="">전체</MenuItem>
                  <MenuItem value="COLLECTABLE">등록 가능</MenuItem>
                  <MenuItem value="COLLECTED">연결 완료</MenuItem>
                  <MenuItem value="BLOCKED">등록 불가</MenuItem>
                </TextField>
                <TextField
                  select
                  label="운영월"
                  size="small"
                  value={filters.periodScope}
                  onChange={(event) =>
                    setFilters({ ...filters, periodScope: event.target.value })
                  }
                  sx={{ minWidth: { lg: 140 } }}
                >
                  <MenuItem value="">전체</MenuItem>
                  <MenuItem value="CURRENT">현재 운영월</MenuItem>
                  <MenuItem value="OUTSIDE">운영월 밖</MenuItem>
                </TextField>
                <Button
                  variant="outlined"
                  disabled={!hasActiveFilter}
                  sx={{ flexShrink: 0, minWidth: 88, whiteSpace: 'nowrap' }}
                  onClick={clearFilters}
                >
                  초기화
                </Button>
              </Stack>
            </ResponsiveFilterPanel>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1.5}
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
                {outsideCurrentPeriodCount > 0 ? (
                  <Chip
                    label={`운영월 밖 ${outsideCurrentPeriodCount}건`}
                    size="small"
                    color="warning"
                    variant="outlined"
                  />
                ) : null}
                <Chip
                  label={`연결 완료 ${collectedCount}건`}
                  size="small"
                  color="info"
                  variant="outlined"
                />
                <Chip
                  label={
                    visibleSelectedRowsCount > 0
                      ? `선택 적용 ${visibleSelectedCollectableRowCount}건`
                      : `표시 범위 적용 ${collectableCount}건`
                  }
                  size="small"
                  color={visibleSelectedRowsCount > 0 ? 'warning' : 'default'}
                  variant="outlined"
                />
                {activeTypeBreakdown.map((item) => (
                  <Chip
                    key={item.type}
                    label={`${item.label} ${item.count}건`}
                    size="small"
                    variant="outlined"
                  />
                ))}
                {unresolvedTargetCount > 0 ? (
                  <Chip
                    label={`판정 확인 ${unresolvedTargetCount}건`}
                    size="small"
                    color="warning"
                    variant="outlined"
                  />
                ) : null}
              </Stack>
            </Stack>
            <Box
              sx={{
                p: 1.5,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2
              }}
            >
              <Stack spacing={1.5}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', md: 'center' }}
                >
                  <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2">
                      거래유형별 세부 적용
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {readBulkCollectScopeSummary({
                        selectedRowsCount: visibleSelectedRowsCount,
                        selectedCollectableRowCount:
                          visibleSelectedCollectableRowCount,
                        collectableRowCount: visibleCollectableRowCount,
                        activeTypeBreakdown,
                        unresolvedTargetCount
                      })}
                    </Typography>
                  </Stack>
                </Stack>
                <Stack spacing={0.75}>
                  {activeTypeBreakdown.length > 0 ? (
                    <Stack
                      direction="row"
                      spacing={1}
                      useFlexGap
                      flexWrap="wrap"
                    >
                      {activeTypeBreakdown.map((item) => (
                        <Chip
                          key={item.type}
                          label={readTypeOverrideSummary({
                            label: item.label,
                            count: item.count,
                            categoryName:
                              categoryNameById.get(
                                bulkCollectForm.typeOptions[item.type]
                                  .categoryId
                              ) ?? null,
                            memo: bulkCollectForm.typeOptions[item.type].memo
                          })}
                          size="small"
                          color={
                            bulkCollectForm.typeOptions[item.type].categoryId ||
                            bulkCollectForm.typeOptions[item.type].memo.trim()
                              ? 'primary'
                              : 'default'
                          }
                          variant="outlined"
                        />
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      현재 선택 범위에서 세부 적용할 거래유형이 아직 잡히지
                      않았습니다.
                    </Typography>
                  )}
                  <Typography variant="body2" color="text.secondary">
                    읽기 완료, 미연결, 현재 운영월 범위에 있는 행만 선택할 수
                    있습니다. 거래유형별 적용값은 해당 유형 행에만 반영되고,
                    비워두면 자동 판정값을 사용합니다.
                  </Typography>
                </Stack>
                <Stack spacing={1} sx={{ pt: 0.5 }}>
                  {activeTypeBreakdown.length > 0 ? (
                    activeTypeBreakdown.map((item) => {
                      const type = item.type;
                      const label = item.label;
                      const typeCategories =
                        type === 'REVERSAL'
                          ? categories
                          : categories.filter(
                              (category) => category.kind === type
                            );

                      return (
                        <Box
                          key={type}
                          sx={{
                            p: 1.25,
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1.5
                          }}
                        >
                          <Stack spacing={1}>
                            <Stack
                              direction={{ xs: 'column', sm: 'row' }}
                              spacing={1}
                              justifyContent="space-between"
                              alignItems={{ xs: 'flex-start', sm: 'center' }}
                            >
                              <Stack
                                direction="row"
                                spacing={1}
                                alignItems="center"
                                useFlexGap
                                flexWrap="wrap"
                              >
                                <Chip
                                  label={`${label} ${item.count}건`}
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                />
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  {readTypePanelDescription({
                                    categoryName:
                                      categoryNameById.get(
                                        bulkCollectForm.typeOptions[type]
                                          .categoryId
                                      ) ?? null,
                                    memo: bulkCollectForm.typeOptions[type].memo
                                  })}
                                </Typography>
                              </Stack>
                            </Stack>
                            <Stack
                              direction={{ xs: 'column', lg: 'row' }}
                              spacing={1}
                            >
                              <TextField
                                select
                                label={`${label} 카테고리`}
                                size="small"
                                value={
                                  bulkCollectForm.typeOptions[type].categoryId
                                }
                                onChange={(event) => {
                                  updateBulkCollectTypeOption(type, {
                                    categoryId: event.target.value
                                  });
                                }}
                                sx={{ minWidth: 0, flex: 1 }}
                              >
                                <MenuItem value="">자동/미지정</MenuItem>
                                {typeCategories.map((category) => (
                                  <MenuItem
                                    key={category.id}
                                    value={category.id}
                                  >
                                    {category.name}
                                  </MenuItem>
                                ))}
                              </TextField>
                              <TextField
                                label={`${label} 메모`}
                                size="small"
                                value={bulkCollectForm.typeOptions[type].memo}
                                onChange={(event) => {
                                  updateBulkCollectTypeOption(type, {
                                    memo: event.target.value
                                  });
                                }}
                                placeholder="필요할 때만 메모 입력"
                                sx={{ minWidth: 0, flex: 1.2 }}
                              />
                            </Stack>
                          </Stack>
                        </Box>
                      );
                    })
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      현재 선택 범위에서 자동 판정된 거래유형이 없어 세부 적용
                      항목을 표시하지 않습니다.
                    </Typography>
                  )}
                </Stack>
              </Stack>
            </Box>
            <Stack spacing={1}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1}
                justifyContent="space-between"
                alignItems={{ xs: 'stretch', md: 'center' }}
              >
                <Typography variant="body2" color="text.secondary">
                  선택한 행이 있으면 그 범위에만 적용하고, 선택이 없으면 현재
                  배치의 현재 운영월 등록 가능 행 전체를 대상으로 처리합니다.
                </Typography>
                <Button
                  variant="contained"
                  onClick={() => {
                    onBulkCollect(targetRows.map((row) => row.id));
                  }}
                  disabled={bulkCollectDisabled}
                >
                  {bulkCollectLabel}
                </Button>
              </Stack>
              {bulkCollectJob ? (
                <Box
                  sx={{
                    p: 1.25,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1.5
                  }}
                >
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
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" color="text.secondary">
                          {bulkCollectProgress}%
                        </Typography>
                        {canCancelBulkCollectJob ? (
                          <Button
                            size="small"
                            color="warning"
                            variant="outlined"
                            disabled={cancelBulkCollectPending}
                            onClick={onCancelBulkCollect}
                          >
                            작업 중단
                          </Button>
                        ) : null}
                      </Stack>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={bulkCollectProgress}
                    />
                  </Stack>
                </Box>
              ) : null}
            </Stack>
          </Stack>
        ) : null
      }
      rows={filteredRows}
      columns={buildImportedRowsColumns({
        onPrepareCollect
      })}
      height={420}
      checkboxSelection
      rowSelectionModel={rowSelectionModel}
      onRowSelectionModelChange={handleRowSelectionModelChange}
      isRowSelectable={(params) =>
        collectableRowIdSet.has(String(params.row.id))
      }
    />
  );
}

function filterImportedRows(
  rows: ImportedRowTableItem[],
  filters: ImportedRowsFilters
) {
  const keyword = normalizeFilterText(filters.keyword);

  return rows.filter((row) => {
    if (filters.parseStatus && row.parseStatus !== filters.parseStatus) {
      return false;
    }

    if (
      filters.collectionStatus === 'COLLECTABLE' &&
      !isImportedRowCollectable(row)
    ) {
      return false;
    }

    if (
      filters.collectionStatus === 'COLLECTED' &&
      !row.createdCollectedTransactionId
    ) {
      return false;
    }

    if (
      filters.collectionStatus === 'BLOCKED' &&
      (isImportedRowCollectable(row) || row.createdCollectedTransactionId)
    ) {
      return false;
    }

    if (filters.periodScope === 'CURRENT' && !row.isCurrentPeriodRow) {
      return false;
    }

    if (filters.periodScope === 'OUTSIDE' && row.isCurrentPeriodRow) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    const haystack = normalizeFilterText(
      [
        String(row.rowNumber),
        row.occurredOn,
        row.title,
        row.direction,
        row.collectTypeHint,
        row.parseStatus,
        row.collectionSummary?.createdCollectedTransactionTitle,
        row.collectionSummary?.createdCollectedTransactionStatus,
        row.amount == null ? null : String(row.amount),
        row.balanceAfter == null ? null : String(row.balanceAfter)
      ]
        .filter(Boolean)
        .join(' ')
    );

    return haystack.includes(keyword);
  });
}

function isImportedRowCollectable(row: ImportedRowTableItem) {
  return (
    row.parseStatus === 'PARSED' &&
    !row.createdCollectedTransactionId &&
    row.isCurrentPeriodRow
  );
}

function readCollectionStatusFilterLabel(value: string) {
  switch (value) {
    case 'COLLECTABLE':
      return '등록 가능';
    case 'COLLECTED':
      return '연결 완료';
    case 'BLOCKED':
      return '등록 불가';
    default:
      return value;
  }
}

function resolveImportedRowBulkCollectType(
  row: ImportedRowTableItem
): BulkCollectTransactionType | null {
  if (row.collectTypeHint) {
    return row.collectTypeHint;
  }

  if (row.direction === 'DEPOSIT') {
    return 'INCOME';
  }

  if (row.direction === 'WITHDRAWAL') {
    return 'EXPENSE';
  }

  if (row.direction === 'REVERSAL') {
    return 'REVERSAL';
  }

  return null;
}

function normalizeFilterText(value: string) {
  return value.trim().toLocaleLowerCase('ko-KR');
}

function readBulkCollectScopeSummary(input: {
  selectedRowsCount: number;
  selectedCollectableRowCount: number;
  collectableRowCount: number;
  activeTypeBreakdown: Array<{
    type: BulkCollectTransactionType;
    label: string;
    count: number;
  }>;
  unresolvedTargetCount: number;
}) {
  const scopeLabel =
    input.selectedRowsCount > 0
      ? `선택한 등록 가능 행 ${input.selectedCollectableRowCount}건`
      : `현재 배치의 등록 가능 행 ${input.collectableRowCount}건`;

  const typeSummary = input.activeTypeBreakdown
    .map((item) => `${item.label} ${item.count}건`)
    .join(', ');

  if (typeSummary && input.unresolvedTargetCount > 0) {
    return `${scopeLabel} 기준 자동 판정은 ${typeSummary}이며, ${input.unresolvedTargetCount}건은 한 번 더 확인이 필요합니다.`;
  }

  if (typeSummary) {
    return `${scopeLabel} 기준 자동 판정은 ${typeSummary}입니다. 필요한 유형만 카테고리와 메모를 지정할 수 있습니다.`;
  }

  return `${scopeLabel} 기준으로 아직 자동 판정 가능한 거래유형이 없습니다. 단건 검토를 먼저 진행해 주세요.`;
}

function readTypeOverrideSummary(input: {
  label: string;
  count: number;
  categoryName: string | null;
  memo: string;
}) {
  const parts = [`${input.label} ${input.count}건`];

  if (input.categoryName) {
    parts.push(input.categoryName);
  }

  if (input.memo.trim()) {
    parts.push('메모 지정');
  }

  if (parts.length === 1) {
    parts.push('자동/미지정');
  }

  return parts.join(' · ');
}

function readTypePanelDescription(input: {
  categoryName: string | null;
  memo: string;
}) {
  const parts: string[] = [];

  if (input.categoryName) {
    parts.push(`카테고리 ${input.categoryName}`);
  }

  if (input.memo.trim()) {
    parts.push('메모 개별 적용');
  }

  return parts.length > 0
    ? parts.join(' · ')
    : '현재는 자동 판정값을 사용합니다.';
}

function BalanceDiscrepancyAlert({
  discrepancy,
  fundingAccountName
}: {
  discrepancy: ImportBatchBalanceDiscrepancy;
  fundingAccountName: string | null;
}) {
  const accountLabel = fundingAccountName ?? '자금수단';
  const sign = discrepancy.differenceWon > 0 ? '+' : '';

  return (
    <Alert severity="warning" variant="outlined">
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        잔액 불일치 확인 필요
      </Typography>
      <Typography variant="body2">
        {accountLabel}의 은행 명세 마지막 잔액은{' '}
        <strong>{formatWon(discrepancy.importedBalanceWon)}</strong>이지만, 현재
        ERP 장부 잔액은{' '}
        <strong>{formatWon(discrepancy.ledgerBalanceWon)}</strong>입니다. (차액:{' '}
        {sign}
        {formatWon(discrepancy.differenceWon)})
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        누락된 거래가 있는지 확인하고, 필요한 거래를 추가로 등록해 주세요.
      </Typography>
    </Alert>
  );
}
