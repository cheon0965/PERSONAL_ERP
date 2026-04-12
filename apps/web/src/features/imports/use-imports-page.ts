'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CollectImportedRowRequest,
  CreateImportBatchRequest,
  ImportBatchItem
} from '@personal-erp/contracts';
import {
  currentAccountingPeriodQueryKey,
  getCurrentAccountingPeriod
} from '@/features/accounting-periods/accounting-periods.api';
import {
  categoriesQueryKey,
  fundingAccountsQueryKey,
  getCategories,
  getFundingAccounts,
  getReferenceDataReadiness,
  referenceDataReadinessQueryKey
} from '@/features/reference-data/reference-data.api';
import { collectedTransactionsQueryKey } from '@/features/transactions/transactions.api';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import {
  buildImportBatchFallbackItem,
  buildImportedCollectedFallbackPreview,
  buildImportedCollectedFallbackResponse,
  collectImportedRow,
  createImportBatch,
  getImportBatches,
  importBatchesQueryKey,
  previewImportedRowCollection
} from './imports.api';
import {
  buildCollectSuccessMessage,
  normalizeOptionalValue,
  readParsedRowPreview,
  type FeedbackState,
  type ImportedRowTableItem
} from './imports.shared';

const defaultUploadForm: CreateImportBatchRequest = {
  sourceKind: 'MANUAL_UPLOAD',
  fileName: 'march-manual.csv',
  content: ['date,title,amount', '2026-03-12,Coffee beans,19800'].join('\n')
};

const defaultCollectForm: CollectImportedRowRequest = {
  type: 'EXPENSE',
  fundingAccountId: '',
  categoryId: '',
  memo: ''
};

export function useImportsPage() {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = React.useState<FeedbackState>(null);
  const [selectedBatchId, setSelectedBatchId] = React.useState<string | null>(
    null
  );
  const [selectedRowId, setSelectedRowId] = React.useState<string | null>(null);
  const [isUploadDrawerOpen, setUploadDrawerOpen] = React.useState(false);
  const [isCollectDrawerOpen, setCollectDrawerOpen] = React.useState(false);
  const [uploadForm, setUploadForm] =
    React.useState<CreateImportBatchRequest>(defaultUploadForm);
  const [collectForm, setCollectForm] =
    React.useState<CollectImportedRowRequest>(defaultCollectForm);

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
    queryFn: () => getFundingAccounts()
  });
  const categoriesQuery = useQuery({
    queryKey: categoriesQueryKey,
    queryFn: () => getCategories()
  });
  const referenceDataReadinessQuery = useQuery({
    queryKey: referenceDataReadinessQueryKey,
    queryFn: getReferenceDataReadiness
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
  const normalizedCollectRequest = React.useMemo<CollectImportedRowRequest>(
    () => ({
      ...collectForm,
      categoryId: normalizeOptionalValue(collectForm.categoryId),
      memo: normalizeOptionalValue(collectForm.memo)
    }),
    [collectForm]
  );
  const selectedFundingAccount = React.useMemo(
    () =>
      (fundingAccountsQuery.data ?? []).find(
        (candidate) => candidate.id === normalizedCollectRequest.fundingAccountId
      ) ?? null,
    [fundingAccountsQuery.data, normalizedCollectRequest.fundingAccountId]
  );
  const selectedCategory = React.useMemo(
    () =>
      normalizedCollectRequest.categoryId
        ? (categoriesQuery.data ?? []).find(
            (candidate) => candidate.id === normalizedCollectRequest.categoryId
          ) ?? null
        : null,
    [categoriesQuery.data, normalizedCollectRequest.categoryId]
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

  const currentPeriod = currentPeriodQuery.data ?? null;

  useDomainHelp({
    title: '업로드 배치 사용 가이드',
    description:
      '이 화면은 파일이나 붙여넣기 원본을 업로드 배치로 보관하고, 필요한 행만 검토해 수집 거래로 올리는 곳입니다. 전표 확정 전에 원본과 자동 판정 근거를 먼저 확인합니다.',
    primaryEntity: '업로드 배치',
    relatedEntities: ['업로드 행', '수집 거래', '계획 항목', '운영 월'],
    truthSource:
      '업로드 배치는 파싱과 후보 수집 단계이며, 실제 회계 확정은 전표에서 이루어집니다.',
    supplementarySections: [
      {
        title: '바로 쓰는 순서',
        items: [
          '업로드 배치 등록을 열고 원본 종류, 파일명, CSV 또는 붙여넣기 내용을 입력합니다.',
          '업로드 배치 목록에서 검토할 배치를 선택합니다.',
          '업로드 행 목록에서 파싱 완료된 행의 행 승격을 엽니다.',
          '승격 드로어에서 거래 성격, 자금수단, 카테고리를 확인하고 자동 판정 preview를 읽습니다.',
          '승격 후 수집 거래 화면으로 이동해 전표 준비 상태인지 확인하고 전표로 확정합니다.'
        ]
      },
      {
        title: '막히면 확인',
        items: [
          '열린 운영 월이 없으면 행 승격과 자동 판정 preview가 막힙니다.',
          '자금수단이나 카테고리 선택지가 부족하면 기준 데이터 관리 화면에서 먼저 보완합니다.',
          '이미 수집 거래로 올린 행은 다시 승격하지 않고 연결된 수집 거래 상태를 추적합니다.'
        ]
      }
    ],
    readModelNote: currentPeriod
      ? `${currentPeriod.monthLabel} 운영 월이 열려 있어 승격 전에 자동 판정 근거를 확인하고 바로 수집 거래로 올릴 수 있습니다.`
      : '현재 열린 운영 월이 없으면 업로드는 가능하지만 업로드 행 승격과 자동 판정 preview는 막힙니다.'
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

  const selectedRowCanCollect =
    Boolean(currentPeriod) &&
    Boolean(selectedBatch) &&
    Boolean(selectedRow) &&
    selectedRow?.parseStatus === 'PARSED' &&
    !selectedRow?.createdCollectedTransactionId;
  const collectPreviewQuery = useQuery({
    queryKey: [
      'import-row-collect-preview',
      selectedBatch?.id ?? null,
      selectedRow?.id ?? null,
      normalizedCollectRequest.type,
      normalizedCollectRequest.fundingAccountId,
      normalizedCollectRequest.categoryId ?? null
    ],
    queryFn: () =>
      previewImportedRowCollection(
        selectedBatch!.id,
        selectedRow!.id,
        normalizedCollectRequest,
        buildImportedCollectedFallbackPreview({
          request: normalizedCollectRequest,
          row: selectedRow!,
          fundingAccountId: selectedFundingAccount?.id ?? '',
          fundingAccountName: selectedFundingAccount?.name ?? '선택 자금수단',
          requestedCategoryId: normalizedCollectRequest.categoryId,
          requestedCategoryName: selectedCategory?.name
        })
      ),
    enabled:
      isCollectDrawerOpen &&
      Boolean(currentPeriod) &&
      Boolean(selectedBatch) &&
      Boolean(selectedRowCanCollect) &&
      Boolean(normalizedCollectRequest.fundingAccountId)
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
        buildImportedCollectedFallbackResponse({
          request: input.request,
          row: input.importedRow,
          fundingAccountId: selectedFundingAccount?.id ?? '',
          fundingAccountName: selectedFundingAccount?.name ?? '선택 자금수단',
          requestedCategoryId: input.request.categoryId,
          requestedCategoryName: selectedCategory?.name
        })
      ),
    onSuccess: async (created) => {
      setFeedback({
        severity: 'success',
        message: buildCollectSuccessMessage(created)
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
            : '업로드 행을 수집 거래로 올리지 못했습니다.'
      });
    }
  });

  function handleSelectBatch(batch: ImportBatchItem) {
    setSelectedBatchId(batch.id);
    setSelectedRowId(null);
  }

  function handlePrepareCollectRow(row: ImportedRowTableItem) {
    setSelectedRowId(row.id);
    setCollectDrawerOpen(true);
  }

  function updateUploadForm(patch: Partial<CreateImportBatchRequest>) {
    setUploadForm((current) => ({
      ...current,
      ...patch
    }));
  }

  function updateCollectForm(patch: Partial<CollectImportedRowRequest>) {
    setCollectForm((current) => ({
      ...current,
      ...patch
    }));
  }

  async function submitUpload() {
    setFeedback(null);
    await createImportBatchMutation.mutateAsync(uploadForm);
  }

  async function submitCollect() {
    if (!selectedBatch || !selectedRow) {
      return;
    }

    setFeedback(null);
    await collectImportedRowMutation.mutateAsync({
      importBatchId: selectedBatch.id,
      importedRow: selectedRow,
      request: normalizedCollectRequest
    });
  }

  return {
    batches,
    canSubmitCollect:
      Boolean(selectedBatch) &&
      selectedRowCanCollect &&
      normalizedCollectRequest.fundingAccountId.length > 0,
    categories: categoriesQuery.data ?? [],
    collectForm,
    collectPreview: {
      isLoading: collectPreviewQuery.isLoading,
      error: collectPreviewQuery.error,
      data: collectPreviewQuery.data
    },
    closeCollectDrawer: () => setCollectDrawerOpen(false),
    closeUploadDrawer: () => setUploadDrawerOpen(false),
    currentPeriod,
    currentPeriodQuery,
    feedback,
    fundingAccounts: fundingAccountsQuery.data ?? [],
    importBatchesQuery,
    isCollectDrawerOpen,
    isUploadDrawerOpen,
    openUploadDrawer: () => setUploadDrawerOpen(true),
    prepareCollectRow: handlePrepareCollectRow,
    referenceDataReadinessQuery,
    selectBatch: handleSelectBatch,
    selectedBatch,
    selectedBatchRows,
    selectedRow,
    selectedRowCanCollect,
    submitCollect,
    submitCollectPending: collectImportedRowMutation.isPending,
    submitUpload,
    submitUploadPending: createImportBatchMutation.isPending,
    updateCollectForm,
    updateUploadForm,
    uploadForm
  };
}
