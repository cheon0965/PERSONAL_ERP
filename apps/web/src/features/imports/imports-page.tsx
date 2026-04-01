'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import type {
  CollectImportedRowRequest,
  CreateImportBatchRequest,
  ImportBatchItem,
  ImportSourceKind
} from '@personal-erp/contracts';
import type { GridColDef } from '@mui/x-data-grid';
import {
  currentAccountingPeriodQueryKey,
  getCurrentAccountingPeriod
} from '@/features/accounting-periods/accounting-periods.api';
import {
  categoriesQueryKey,
  fundingAccountsQueryKey,
  getCategories,
  getFundingAccounts
} from '@/features/reference-data/reference-data.api';
import { collectedTransactionsQueryKey } from '@/features/transactions/transactions.api';
import { formatWon } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { FormDrawer } from '@/shared/ui/form-drawer';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import { StatusChip } from '@/shared/ui/status-chip';
import {
  buildImportBatchFallbackItem,
  buildImportedCollectedFallbackItem,
  collectImportedRow,
  createImportBatch,
  getImportBatches,
  importBatchesQueryKey
} from './imports.api';

const sourceKindOptions: Array<{ value: ImportSourceKind; label: string }> = [
  { value: 'MANUAL_UPLOAD', label: '직접 붙여넣기' },
  { value: 'BANK_CSV', label: '계좌 CSV' },
  { value: 'CARD_EXCEL', label: '카드 엑셀' }
];

type FeedbackState = {
  severity: 'success' | 'error';
  message: string;
} | null;

type ImportedRowTableItem = ImportBatchItem['rows'][number] & {
  occurredOn: string;
  title: string;
  amount: number | null;
};

export function ImportsPage() {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = React.useState<FeedbackState>(null);
  const [selectedBatchId, setSelectedBatchId] = React.useState<string | null>(
    null
  );
  const [selectedRowId, setSelectedRowId] = React.useState<string | null>(null);
  const [isUploadDrawerOpen, setUploadDrawerOpen] = React.useState(false);
  const [isCollectDrawerOpen, setCollectDrawerOpen] = React.useState(false);
  const [uploadForm, setUploadForm] = React.useState<CreateImportBatchRequest>({
    sourceKind: 'MANUAL_UPLOAD',
    fileName: 'march-manual.csv',
    content: ['date,title,amount', '2026-03-12,Coffee beans,19800'].join('\n')
  });
  const [collectForm, setCollectForm] =
    React.useState<CollectImportedRowRequest>({
      type: 'EXPENSE',
      fundingAccountId: '',
      categoryId: '',
      memo: ''
    });

  const currentPeriodQuery = useQuery({
    queryKey: currentAccountingPeriodQueryKey,
    queryFn: getCurrentAccountingPeriod
  });
  const importBatchesQuery = useQuery({
    queryKey: importBatchesQueryKey,
    queryFn: getImportBatches
  });
  const fundingAccountsQuery = useQuery({
    queryKey: fundingAccountsQueryKey,
    queryFn: getFundingAccounts
  });
  const categoriesQuery = useQuery({
    queryKey: categoriesQueryKey,
    queryFn: getCategories
  });

  const batches = React.useMemo(
    () => importBatchesQuery.data ?? [],
    [importBatchesQuery.data]
  );
  const selectedBatch = React.useMemo(
    () =>
      batches.find((candidate) => candidate.id === selectedBatchId) ??
      batches[0] ??
      null,
    [batches, selectedBatchId]
  );
  const selectedBatchRows = React.useMemo<ImportedRowTableItem[]>(
    () =>
      (selectedBatch?.rows ?? []).map((row) => {
        const parsed = readParsedRowPreview(row);

        return {
          ...row,
          occurredOn: parsed?.occurredOn ?? '-',
          title: parsed?.title ?? '-',
          amount: parsed?.amount ?? null
        };
      }),
    [selectedBatch]
  );
  const selectedRow = React.useMemo(
    () =>
      selectedBatchRows.find((candidate) => candidate.id === selectedRowId) ??
      selectedBatchRows[0] ??
      null,
    [selectedBatchRows, selectedRowId]
  );

  React.useEffect(() => {
    if (!selectedBatch && selectedBatchId !== null) {
      setSelectedBatchId(null);
    }

    if (!selectedBatch && batches.length > 0) {
      setSelectedBatchId(batches[0]!.id);
    }
  }, [batches, selectedBatch, selectedBatchId]);

  React.useEffect(() => {
    if (!selectedRow && selectedRowId !== null) {
      setSelectedRowId(null);
    }
  }, [selectedRow, selectedRowId]);

  React.useEffect(() => {
    if (!collectForm.fundingAccountId) {
      const defaultFundingAccount = fundingAccountsQuery.data?.[0]?.id;

      if (defaultFundingAccount) {
        setCollectForm((current) => ({
          ...current,
          fundingAccountId: defaultFundingAccount
        }));
      }
    }
  }, [collectForm.fundingAccountId, fundingAccountsQuery.data]);

  useDomainHelp({
    title: '업로드 배치 개요',
    description:
      '업로드 배치는 원본 파일과 파싱 결과를 보존하는 수집 경계입니다. 정상 행만 명시적으로 CollectedTransaction으로 승격하며, 유일한 계획 항목이 맞으면 category 보완과 READY_TO_POST까지 자동 준비됩니다.',
    primaryEntity: '업로드 배치 (ImportBatch)',
    relatedEntities: [
      '원본 행 (ImportedRow)',
      '수집 거래 (CollectedTransaction)',
      '계획 항목 (PlanItem)',
      '운영 기간 (AccountingPeriod)'
    ],
    truthSource:
      'ImportBatch는 파싱/후보 수집 경계이고, 실제 회계 확정은 JournalEntry에서 이루어집니다.',
    readModelNote: currentPeriodQuery.data
      ? `${currentPeriodQuery.data.monthLabel} 운영 기간이 열려 있어 승격된 행을 바로 READY_TO_POST까지 자동 준비할 수 있습니다.`
      : '현재 열린 운영 기간이 없으면 업로드는 가능하지만 ImportedRow 승격은 막힙니다.'
  });

  const createImportBatchMutation = useMutation({
    mutationFn: (input: CreateImportBatchRequest) =>
      createImportBatch(input, buildImportBatchFallbackItem(input)),
    onSuccess: async (created) => {
      setFeedback({
        severity: 'success',
        message: `${created.fileName} 업로드를 등록하고 ${created.rowCount}개 행을 파싱했습니다.`
      });
      setUploadDrawerOpen(false);
      setSelectedBatchId(created.id);
      setSelectedRowId(null);
      await queryClient.invalidateQueries({ queryKey: importBatchesQueryKey });
    },
    onError: (error) => {
      setFeedback({
        severity: 'error',
        message:
          error instanceof Error
            ? error.message
            : '업로드 배치를 생성하지 못했습니다.'
      });
    }
  });
  const collectImportedRowMutation = useMutation({
    mutationFn: (input: {
      importBatchId: string;
      importedRow: ImportedRowTableItem;
      request: CollectImportedRowRequest;
    }) =>
      collectImportedRow(
        input.importBatchId,
        input.importedRow.id,
        input.request,
        buildImportedCollectedFallbackItem({
          request: input.request,
          row: input.importedRow,
          fundingAccountName:
            fundingAccountsQuery.data?.find(
              (candidate) => candidate.id === input.request.fundingAccountId
            )?.name ?? '선택 자금수단',
          categoryName:
            categoriesQuery.data?.find(
              (candidate) =>
                candidate.id ===
                normalizeOptionalValue(input.request.categoryId)
            )?.name ?? '-'
        })
      ),
    onSuccess: async () => {
      setFeedback({
        severity: 'success',
        message:
          '선택한 ImportedRow를 수집 거래로 승격했습니다. 조건이 맞는 경우 category 보완과 READY_TO_POST도 함께 처리했습니다.'
      });
      setCollectDrawerOpen(false);
      setSelectedRowId(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: importBatchesQueryKey }),
        queryClient.invalidateQueries({
          queryKey: collectedTransactionsQueryKey
        })
      ]);
    },
    onError: (error) => {
      setFeedback({
        severity: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'ImportedRow를 수집 거래로 승격하지 못했습니다.'
      });
    }
  });

  const batchColumns = React.useMemo<GridColDef<ImportBatchItem>[]>(
    () => [
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
            variant={selectedBatch?.id === params.row.id ? 'contained' : 'text'}
            onClick={() => {
              setSelectedBatchId(params.row.id);
              setSelectedRowId(null);
            }}
          >
            행 보기
          </Button>
        )
      }
    ],
    [selectedBatch]
  );
  const rowColumns = React.useMemo<GridColDef<ImportedRowTableItem>[]>(
    () => [
      { field: 'rowNumber', headerName: '행', flex: 0.5 },
      { field: 'occurredOn', headerName: '거래일', flex: 0.8 },
      { field: 'title', headerName: '설명', flex: 1.3 },
      {
        field: 'amount',
        headerName: '금액',
        flex: 0.9,
        valueFormatter: (value) =>
          value == null ? '-' : formatWon(Number(value))
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
        flex: 1,
        renderCell: (params) => {
          const row = params.row;

          if (row.createdCollectedTransactionId) {
            return (
              <Button size="small" component={Link} href="/transactions">
                생성됨
              </Button>
            );
          }

          if (row.parseStatus !== 'PARSED') {
            return (
              <Typography variant="body2" color="error.main">
                오류 보류
              </Typography>
            );
          }

          return (
            <Button
              size="small"
              variant={selectedRow?.id === row.id ? 'contained' : 'text'}
              onClick={() => {
                setSelectedRowId(row.id);
                setCollectDrawerOpen(true);
              }}
            >
              승격 준비
            </Button>
          );
        }
      }
    ],
    [selectedRow]
  );

  const currentPeriod = currentPeriodQuery.data ?? null;
  const selectedRowCanCollect =
    Boolean(currentPeriod) &&
    Boolean(selectedBatch) &&
    Boolean(selectedRow) &&
    selectedRow?.parseStatus === 'PARSED' &&
    !selectedRow?.createdCollectedTransactionId;

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="업로드/자동화"
        title="업로드 배치"
        description="원본 파일을 ImportBatch로 남기고, 정상 파싱 행만 명시적으로 수집 거래로 승격하는 운영 화면입니다. 유일한 계획 항목이 맞으면 category 보완과 READY_TO_POST까지 자동으로 준비합니다."
        primaryActionLabel="업로드 배치 등록"
        primaryActionOnClick={() => setUploadDrawerOpen(true)}
      />

      {feedback ? (
        <Alert severity={feedback.severity} variant="outlined">
          {feedback.message}
        </Alert>
      ) : null}
      {currentPeriodQuery.error ? (
        <QueryErrorAlert
          title="현재 운영 기간을 불러오지 못했습니다."
          error={currentPeriodQuery.error}
        />
      ) : null}
      {importBatchesQuery.error ? (
        <QueryErrorAlert
          title="업로드 배치 조회에 실패했습니다."
          error={importBatchesQuery.error}
        />
      ) : null}

      <SectionCard
        title="현재 운영 기간"
        description="배치 생성은 언제든 가능하지만, ImportedRow 승격과 자동 준비는 현재 열린 운영 기간 안에서만 처리됩니다."
      >
        {currentPeriod ? (
          <Grid container spacing={appLayout.fieldGap}>
            <Grid size={{ xs: 12, md: 3 }}>
              <Typography variant="caption" color="text.secondary">
                상태
              </Typography>
              <div>
                <StatusChip label={currentPeriod.status} />
              </div>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Typography variant="caption" color="text.secondary">
                운영 월
              </Typography>
              <Typography variant="body1">
                {currentPeriod.monthLabel}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="caption" color="text.secondary">
                허용 거래일 범위
              </Typography>
              <Typography variant="body1">
                {currentPeriod.startDate.slice(0, 10)} ~{' '}
                {currentPeriod.endDate.slice(0, 10)}
              </Typography>
            </Grid>
          </Grid>
        ) : (
          <Typography variant="body2" color="text.secondary">
            현재 열린 운영 기간이 없습니다. 배치는 미리 올릴 수 있지만 행 승격은
            `월 운영` 화면에서 기간을 연 뒤 진행해야 합니다.
          </Typography>
        )}
      </SectionCard>

      <DataTableCard
        title="업로드 배치 목록"
        description="최근 업로드 배치를 확인하고, 선택한 배치의 ImportedRow를 바로 검토할 수 있습니다."
        rows={batches}
        columns={batchColumns}
        height={360}
      />

      <DataTableCard
        title={
          selectedBatch
            ? `${selectedBatch.fileName} ImportedRow`
            : 'ImportedRow'
        }
        description={
          selectedBatch
            ? `${selectedBatch.fileName}의 행을 검토하고, 정상 파싱 행만 수집 거래로 승격할 수 있습니다.`
            : '먼저 업로드 배치를 선택해 주세요.'
        }
        rows={selectedBatchRows}
        columns={rowColumns}
        height={420}
      />

      <FormDrawer
        open={isUploadDrawerOpen}
        onClose={() => setUploadDrawerOpen(false)}
        title="새 업로드 배치"
        description="UTF-8 텍스트 본문을 그대로 붙여 넣어 ImportBatch와 ImportedRow를 생성합니다."
      >
        <Stack spacing={appLayout.fieldGap}>
          <TextField
            select
            label="원천 형식"
            size="small"
            value={uploadForm.sourceKind}
            onChange={(event) => {
              setUploadForm((current) => ({
                ...current,
                sourceKind: event.target.value as ImportSourceKind
              }));
            }}
          >
            {sourceKindOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="파일명"
            size="small"
            value={uploadForm.fileName}
            onChange={(event) => {
              setUploadForm((current) => ({
                ...current,
                fileName: event.target.value
              }));
            }}
          />
          <TextField
            label="UTF-8 본문"
            multiline
            minRows={8}
            value={uploadForm.content}
            onChange={(event) => {
              setUploadForm((current) => ({
                ...current,
                content: event.target.value
              }));
            }}
          />
          <Button
            variant="contained"
            disabled={
              createImportBatchMutation.isPending ||
              uploadForm.fileName.trim().length === 0 ||
              uploadForm.content.trim().length === 0
            }
            onClick={() => {
              setFeedback(null);
              void createImportBatchMutation.mutateAsync(uploadForm);
            }}
          >
            {createImportBatchMutation.isPending ? '업로드 중...' : '배치 생성'}
          </Button>
        </Stack>
      </FormDrawer>

      <FormDrawer
        open={isCollectDrawerOpen}
        onClose={() => setCollectDrawerOpen(false)}
        title="행 승격"
        description="선택한 ImportedRow를 CollectedTransaction으로 올립니다. 유일한 계획 항목이 맞으면 category 보완과 READY_TO_POST가 자동으로 적용됩니다."
      >
        {selectedRow ? (
          <Stack spacing={appLayout.fieldGap}>
            <div>
              <Typography variant="caption" color="text.secondary">
                선택 행
              </Typography>
              <Typography variant="body1">
                #{selectedRow.rowNumber} {selectedRow.title}
              </Typography>
            </div>
            <div>
              <Typography variant="caption" color="text.secondary">
                파싱 결과
              </Typography>
              <Typography variant="body2">
                {selectedRow.occurredOn} /{' '}
                {selectedRow.amount == null
                  ? '-'
                  : formatWon(selectedRow.amount)}
              </Typography>
            </div>
            <div>
              <Typography variant="caption" color="text.secondary">
                fingerprint
              </Typography>
              <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                {selectedRow.sourceFingerprint ?? '-'}
              </Typography>
            </div>
            {selectedRow.parseError ? (
              <Alert severity="warning" variant="outlined">
                {selectedRow.parseError}
              </Alert>
            ) : null}
            <TextField
              select
              label="거래 유형"
              size="small"
              value={collectForm.type}
              onChange={(event) => {
                setCollectForm((current) => ({
                  ...current,
                  type: event.target.value as CollectImportedRowRequest['type']
                }));
              }}
            >
              <MenuItem value="INCOME">수입</MenuItem>
              <MenuItem value="EXPENSE">지출</MenuItem>
              <MenuItem value="TRANSFER">이체</MenuItem>
            </TextField>
            <TextField
              select
              label="자금수단"
              size="small"
              value={collectForm.fundingAccountId}
              onChange={(event) => {
                setCollectForm((current) => ({
                  ...current,
                  fundingAccountId: event.target.value
                }));
              }}
            >
              {(fundingAccountsQuery.data ?? []).map((account) => (
                <MenuItem key={account.id} value={account.id}>
                  {account.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="카테고리"
              size="small"
              value={collectForm.categoryId ?? ''}
              onChange={(event) => {
                setCollectForm((current) => ({
                  ...current,
                  categoryId: event.target.value
                }));
              }}
              helperText="비워 두면 유일한 계획 항목이 맞는 경우 category를 자동 보완합니다."
            >
              <MenuItem value="">자동 보완 허용</MenuItem>
              {(categoriesQuery.data ?? []).map((category) => (
                <MenuItem key={category.id} value={category.id}>
                  {category.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="메모"
              size="small"
              multiline
              minRows={3}
              value={collectForm.memo ?? ''}
              onChange={(event) => {
                setCollectForm((current) => ({
                  ...current,
                  memo: event.target.value
                }));
              }}
            />
            <Button
              variant="contained"
              disabled={
                collectImportedRowMutation.isPending ||
                !selectedBatch ||
                !selectedRowCanCollect ||
                collectForm.fundingAccountId.length === 0
              }
              onClick={() => {
                if (!selectedBatch || !selectedRow) {
                  return;
                }

                setFeedback(null);
                void collectImportedRowMutation.mutateAsync({
                  importBatchId: selectedBatch.id,
                  importedRow: selectedRow,
                  request: {
                    ...collectForm,
                    categoryId: normalizeOptionalValue(collectForm.categoryId),
                    memo: normalizeOptionalValue(collectForm.memo)
                  }
                });
              }}
            >
              {collectImportedRowMutation.isPending
                ? '승격 중...'
                : '수집 거래로 승격'}
            </Button>
            {!currentPeriod ? (
              <Alert severity="info" variant="outlined">
                현재 열린 운영 기간이 없어 승격이 비활성화되어 있습니다.
              </Alert>
            ) : null}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            먼저 배치에서 검토할 행을 선택해 주세요.
          </Typography>
        )}
      </FormDrawer>
    </Stack>
  );
}

function readParsedRowPreview(row: ImportBatchItem['rows'][number]): {
  occurredOn: string;
  title: string;
  amount: number;
} | null {
  const parsed =
    isObjectRecord(row.rawPayload) && isObjectRecord(row.rawPayload.parsed)
      ? row.rawPayload.parsed
      : null;

  if (
    !parsed ||
    typeof parsed.occurredOn !== 'string' ||
    typeof parsed.title !== 'string' ||
    typeof parsed.amount !== 'number'
  ) {
    return null;
  }

  return {
    occurredOn: parsed.occurredOn,
    title: parsed.title,
    amount: parsed.amount
  };
}

function normalizeOptionalValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}
