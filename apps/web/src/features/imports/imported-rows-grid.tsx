'use client';

import * as React from 'react';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import type { GridRowSelectionModel } from '@mui/x-data-grid';
import {
  Box,
  Button,
  Chip,
  Collapse,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import type {
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
import {
  bulkCollectTransactionTypes,
  type BulkCollectFormState
} from './use-imports-page';

type BulkCollectTransactionType = keyof BulkCollectFormState['typeOptions'];

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
  bulkCollectForm: BulkCollectFormState;
  categories: CategoryItem[];
  bulkCollectJob: ImportBatchCollectionJobItem | null;
  bulkCollectPending: boolean;
  onBulkCollectFormChange: (patch: Partial<BulkCollectFormState>) => void;
  onSelectedRowIdsChange: (rowIds: string[]) => void;
  onPrepareCollect: (row: ImportedRowTableItem) => void;
  onBulkCollect: () => void;
}) {
  const [isTypeOverridesOpen, setTypeOverridesOpen] = React.useState(false);
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
  const collectableRowIdSet = React.useMemo(
    () =>
      new Set(
        rows.filter((row) => isImportedRowCollectable(row)).map((row) => row.id)
      ),
    [rows]
  );
  const targetRows = React.useMemo(
    () =>
      selectedRowIds.length > 0
        ? rows.filter(
            (row) =>
              selectedRowIds.includes(row.id) && isImportedRowCollectable(row)
          )
        : rows.filter((row) => isImportedRowCollectable(row)),
    [rows, selectedRowIds]
  );
  const activeTypeBreakdown = React.useMemo(() => {
    const counts: Record<BulkCollectTransactionType, number> = {
      INCOME: 0,
      EXPENSE: 0,
      TRANSFER: 0,
      REVERSAL: 0
    };

    targetRows.forEach((row) => {
      const type = resolveImportedRowBulkCollectType(row, bulkCollectForm.type);

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
  }, [bulkCollectForm.type, targetRows]);
  const unresolvedTargetCount = React.useMemo(
    () =>
      targetRows.filter(
        (row) => !resolveImportedRowBulkCollectType(row, bulkCollectForm.type)
      ).length,
    [bulkCollectForm.type, targetRows]
  );
  const categoryNameById = React.useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );
  const hasTypeOverrides = React.useMemo(
    () =>
      bulkCollectTransactionTypes.some((type) => {
        const typeOption = bulkCollectForm.typeOptions[type];

        return (
          Boolean(typeOption.categoryId) || Boolean(typeOption.memo.trim())
        );
      }),
    [bulkCollectForm.typeOptions]
  );
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
                <Chip
                  label={`연결 완료 ${collectedCount}건`}
                  size="small"
                  color="info"
                  variant="outlined"
                />
                <Chip
                  label={
                    selectedRowsCount > 0
                      ? `선택 적용 ${selectedCollectableRowCount}건`
                      : `전체 적용 ${collectableCount}건`
                  }
                  size="small"
                  color={selectedRowsCount > 0 ? 'warning' : 'default'}
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
                      일괄 적용 기본값
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {readBulkCollectScopeSummary({
                        selectedRowsCount,
                        selectedCollectableRowCount,
                        collectableRowCount,
                        forcedType: bulkCollectForm.type,
                        activeTypeBreakdown,
                        unresolvedTargetCount
                      })}
                    </Typography>
                  </Stack>
                  <Button
                    variant={isTypeOverridesOpen ? 'contained' : 'outlined'}
                    color={hasTypeOverrides ? 'primary' : 'inherit'}
                    startIcon={<TuneRoundedIcon />}
                    endIcon={
                      <ExpandMoreRoundedIcon
                        sx={{
                          transition: 'transform 0.2s ease',
                          transform: isTypeOverridesOpen
                            ? 'rotate(180deg)'
                            : 'rotate(0deg)'
                        }}
                      />
                    }
                    onClick={() => setTypeOverridesOpen((current) => !current)}
                  >
                    거래유형별 세부 적용
                  </Button>
                </Stack>
                <Stack
                  direction={{ xs: 'column', lg: 'row' }}
                  spacing={1.5}
                  alignItems={{ xs: 'stretch', lg: 'center' }}
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
                    sx={{ minWidth: { lg: 180 } }}
                  >
                    <MenuItem value="">행 방향 자동</MenuItem>
                    <MenuItem value="EXPENSE">지출</MenuItem>
                    <MenuItem value="INCOME">수입</MenuItem>
                    <MenuItem value="TRANSFER">이체</MenuItem>
                    <MenuItem value="REVERSAL">승인취소</MenuItem>
                  </TextField>
                  <TextField
                    select
                    label="기본 카테고리"
                    size="small"
                    value={bulkCollectForm.categoryId}
                    onChange={(event) => {
                      onBulkCollectFormChange({
                        categoryId: event.target.value
                      });
                    }}
                    sx={{ minWidth: { lg: 240 } }}
                  >
                    <MenuItem value="">자동/미지정</MenuItem>
                    {categories.map((category) => (
                      <MenuItem key={category.id} value={category.id}>
                        {category.name}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="기본 메모"
                    size="small"
                    value={bulkCollectForm.memo}
                    onChange={(event) => {
                      onBulkCollectFormChange({
                        memo: event.target.value
                      });
                    }}
                    sx={{ minWidth: { lg: 220 }, flex: 1 }}
                  />
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
                    읽기 완료이면서 아직 연결되지 않은 행만 선택할 수 있습니다.
                    거래유형별 적용값은 해당 유형 행에 기본 카테고리와 메모보다
                    먼저 반영됩니다.
                  </Typography>
                </Stack>
                <Collapse in={isTypeOverridesOpen} unmountOnExit>
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
                                      memo: bulkCollectForm.typeOptions[type]
                                        .memo
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
                                  <MenuItem value="">기본값 사용</MenuItem>
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
                                  placeholder="비워두면 기본 메모 사용"
                                  sx={{ minWidth: 0, flex: 1.2 }}
                                />
                              </Stack>
                            </Stack>
                          </Box>
                        );
                      })
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        현재 선택 범위에서 자동 판정되거나 고정된 거래유형이
                        없어 세부 적용 항목을 표시하지 않습니다.
                      </Typography>
                    )}
                  </Stack>
                </Collapse>
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
                  배치의 등록 가능 행 전체를 대상으로 처리합니다.
                </Typography>
                <Button
                  variant="contained"
                  onClick={onBulkCollect}
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
                      <Typography variant="body2" color="text.secondary">
                        {bulkCollectProgress}%
                      </Typography>
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
        collectableRowIdSet.has(String(params.row.id))
      }
    />
  );
}

function isImportedRowCollectable(row: ImportedRowTableItem) {
  return row.parseStatus === 'PARSED' && !row.createdCollectedTransactionId;
}

function resolveImportedRowBulkCollectType(
  row: ImportedRowTableItem,
  forcedType: BulkCollectFormState['type']
): BulkCollectTransactionType | null {
  if (forcedType) {
    return forcedType;
  }

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

function readBulkCollectScopeSummary(input: {
  selectedRowsCount: number;
  selectedCollectableRowCount: number;
  collectableRowCount: number;
  forcedType: BulkCollectFormState['type'];
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

  if (input.forcedType) {
    return `${scopeLabel}을(를) 모두 ${bulkCollectTransactionTypeLabels[input.forcedType]}로 고정해 일괄 적용합니다.`;
  }

  const typeSummary = input.activeTypeBreakdown
    .map((item) => `${item.label} ${item.count}건`)
    .join(', ');

  if (typeSummary && input.unresolvedTargetCount > 0) {
    return `${scopeLabel} 기준 자동 판정은 ${typeSummary}이며, ${input.unresolvedTargetCount}건은 한 번 더 확인이 필요합니다.`;
  }

  if (typeSummary) {
    return `${scopeLabel} 기준 자동 판정은 ${typeSummary}입니다. 필요할 때만 거래유형별 세부 적용을 열어 덮어쓸 수 있습니다.`;
  }

  return `${scopeLabel} 기준으로 아직 자동 판정 가능한 거래유형이 없습니다. 기본값만 적용하거나 단건 검토를 먼저 진행해 주세요.`;
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
    parts.push('기본값 사용');
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
    : '현재는 기본값을 그대로 사용합니다.';
}
