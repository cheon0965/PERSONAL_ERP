'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BulkCollectImportedRowsRequest,
  BulkCollectImportedRowsResponse,
  CollectedTransactionType,
  CollectImportedRowRequest,
  CreateImportBatchRequest,
  FundingAccountItem,
  ImportBatchCollectionJobItem,
  ImportBatchItem
} from '@personal-erp/contracts';
import {
  currentAccountingPeriodQueryKey,
  getCurrentAccountingPeriod
} from '@/features/accounting-periods/accounting-periods.api';
import { liabilitiesQueryKey } from '@/features/liabilities/liabilities.api';
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
import { useAppNotification } from '@/shared/providers/notification-provider';
import {
  buildImportBatchFallbackItem,
  buildImportedCollectedFallbackPreview,
  buildImportedCollectedFallbackResponse,
  bulkCollectImportedRows,
  cancelImportBatchCollection,
  cancelImportBatchCollectionJob,
  collectImportedRow,
  createImportBatch,
  createImportBatchFromFile,
  deleteImportBatch,
  getActiveImportBatchCollectionJob,
  getImportBatchCollectionJob,
  getImportBatches,
  importBatchesQueryKey,
  previewImportedRowCollection
} from './imports.api';
import {
  buildCollectSuccessMessage,
  isImportedRowOccurredOnInPeriod,
  normalizeOptionalValue,
  readParsedRowPreview,
  type FeedbackState,
  type ImportedRowTableItem
} from './imports.shared';

export type ImportUploadFormState = CreateImportBatchRequest & {
  fundingAccountId: string;
  file: File | null;
};

const defaultUploadForm: ImportUploadFormState = {
  sourceKind: 'MANUAL_UPLOAD',
  fileName: 'march-manual.csv',
  fundingAccountId: '',
  content: ['date,title,amount', '2026-03-12,Coffee beans,19800'].join('\n'),
  file: null
};

const defaultCollectForm: CollectImportedRowRequest = {
  type: 'EXPENSE',
  fundingAccountId: '',
  categoryId: '',
  memo: ''
};

export const bulkCollectTransactionTypes: CollectedTransactionType[] = [
  'INCOME',
  'EXPENSE',
  'TRANSFER',
  'REVERSAL'
];

type BulkCollectTypeOptionFormState = {
  categoryId: string;
  memo: string;
};

export type BulkCollectFormState = {
  type: '' | CollectedTransactionType;
  categoryId: string;
  memo: string;
  typeOptions: Record<CollectedTransactionType, BulkCollectTypeOptionFormState>;
};

const defaultBulkCollectForm: BulkCollectFormState = {
  type: '',
  categoryId: '',
  memo: '',
  typeOptions: buildDefaultBulkCollectTypeOptions()
};

/**
 * 업로드 배치 목록, 행 미리보기, 단건/일괄 수집 액션을 묶는 페이지 훅입니다.
 *
 * 업로드 화면은 원본 행을 바로 거래로 저장하지 않고, 현재 운영월/자금계좌/카테고리/계획 매칭 결과를 확인한 뒤
 * 수집 거래로 승격합니다. 이 훅은 그 과정의 선택 상태와 Job polling을 한곳에 모아 화면 컴포넌트가 흐름만 표현하게 합니다.
 */
export function useImportsPage(
  initialSelectedBatchId: string | null = null,
  mode: 'list' | 'detail' = 'list'
) {
  const queryClient = useQueryClient();
  const { notifySuccess } = useAppNotification();
  const hasPinnedSelectedBatch = initialSelectedBatchId != null;
  const [feedback, setFeedback] = React.useState<FeedbackState>(null);
  const [selectedBatchId, setSelectedBatchId] = React.useState<string | null>(
    initialSelectedBatchId
  );
  const [selectedRowId, setSelectedRowId] = React.useState<string | null>(null);
  const [selectedRowIds, setSelectedRowIds] = React.useState<string[]>([]);
  const [bulkCollectJobId, setBulkCollectJobId] = React.useState<string | null>(
    null
  );
  const [notifiedBulkCollectJobId, setNotifiedBulkCollectJobId] =
    React.useState<string | null>(null);
  const [bulkCollectPollingEnabled, setBulkCollectPollingEnabled] =
    React.useState(false);
  const [isUploadDrawerOpen, setUploadDrawerOpen] = React.useState(false);
  const [isCollectDrawerOpen, setCollectDrawerOpen] = React.useState(false);
  const [uploadForm, setUploadForm] =
    React.useState<ImportUploadFormState>(defaultUploadForm);
  const [collectForm, setCollectForm] =
    React.useState<CollectImportedRowRequest>(defaultCollectForm);
  const [bulkCollectForm, setBulkCollectForm] =
    React.useState<BulkCollectFormState>(defaultBulkCollectForm);

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

  const uploadFundingAccounts = React.useMemo(
    () =>
      (fundingAccountsQuery.data ?? []).filter((fundingAccount) =>
        isImportBatchFundingAccount(fundingAccount)
      ),
    [fundingAccountsQuery.data]
  );
  const batches = React.useMemo(
    () => importBatchesQuery.data ?? [],
    [importBatchesQuery.data]
  );
  const selectedBatch = React.useMemo(
    () =>
      // URL에서 배치가 고정되지 않은 일반 목록 화면은 첫 배치를 기본 선택해 빈 상세 화면을 줄입니다.
      batches.find((candidate) => candidate.id === selectedBatchId) ??
      batches[0] ??
      null,
    [batches, selectedBatchId]
  );
  const currentPeriod = currentPeriodQuery.data ?? null;
  const selectedBatchRows = React.useMemo<ImportedRowTableItem[]>(
    () =>
      (selectedBatch?.rows ?? []).map((row) => {
        const parsed = readParsedRowPreview(row);

        // 원본 raw 행은 화면 표에서 바로 읽기 어렵기 때문에 파싱 결과와 현재 월 포함 여부를 함께 붙입니다.
        return {
          ...row,
          occurredOn: parsed?.occurredOn ?? '-',
          title: parsed?.title ?? '-',
          amount: parsed?.amount ?? null,
          direction: parsed?.direction ?? null,
          collectTypeHint: parsed?.collectTypeHint ?? null,
          balanceAfter: parsed?.balanceAfter ?? null,
          isCurrentPeriodRow: parsed
            ? isImportedRowOccurredOnInPeriod(parsed.occurredOn, currentPeriod)
            : false
        };
      }),
    [currentPeriod, selectedBatch]
  );
  const selectedRows = React.useMemo(
    () => selectedBatchRows.filter((row) => selectedRowIds.includes(row.id)),
    [selectedBatchRows, selectedRowIds]
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
        (candidate) =>
          candidate.id === normalizedCollectRequest.fundingAccountId
      ) ?? null,
    [fundingAccountsQuery.data, normalizedCollectRequest.fundingAccountId]
  );
  const selectedCategory = React.useMemo(
    () =>
      normalizedCollectRequest.categoryId
        ? ((categoriesQuery.data ?? []).find(
            (candidate) => candidate.id === normalizedCollectRequest.categoryId
          ) ?? null)
        : null,
    [categoriesQuery.data, normalizedCollectRequest.categoryId]
  );
  const collectableRows = React.useMemo(
    () => selectedBatchRows.filter((row) => isImportedRowCollectable(row)),
    [selectedBatchRows]
  );
  const selectedCollectableRows = React.useMemo(
    () => selectedRows.filter((row) => isImportedRowCollectable(row)),
    [selectedRows]
  );
  const bulkFundingAccountId =
    selectedBatch?.fundingAccountId ??
    normalizedCollectRequest.fundingAccountId ??
    '';
  const activeBulkCollectJobQuery = useQuery({
    queryKey: [
      ...importBatchesQueryKey,
      selectedBatch?.id ?? 'none',
      'collection-jobs',
      'active'
    ],
    queryFn: () => getActiveImportBatchCollectionJob(selectedBatch?.id ?? ''),
    enabled: Boolean(selectedBatch),
    // 다른 탭에서 시작된 작업도 감지해야 하므로 선택 배치가 있으면 느린 간격으로 활성 작업을 확인합니다.
    refetchInterval: selectedBatch ? 5000 : false
  });
  const trackedBulkCollectJobId =
    bulkCollectJobId ?? activeBulkCollectJobQuery.data?.id ?? null;
  const bulkCollectJobQuery = useQuery({
    queryKey: [
      ...importBatchesQueryKey,
      selectedBatch?.id ?? 'none',
      'collection-jobs',
      trackedBulkCollectJobId ?? 'none'
    ],
    queryFn: () =>
      getImportBatchCollectionJob(
        selectedBatch?.id ?? '',
        trackedBulkCollectJobId ?? ''
      ),
    enabled: Boolean(selectedBatch && trackedBulkCollectJobId),
    // 진행 중 작업은 사용자가 결과를 기다리는 흐름이라 완료될 때까지 짧은 간격으로 추적합니다.
    refetchInterval: bulkCollectPollingEnabled ? 1200 : false
  });
  const bulkCollectJob =
    bulkCollectJobQuery.data ?? activeBulkCollectJobQuery.data ?? null;
  const isBulkCollectJobRunning = bulkCollectJob
    ? isImportBatchCollectionJobRunning(bulkCollectJob)
    : false;
  const canCancelBulkCollectJob = bulkCollectJob
    ? isImportBatchCollectionJobCancellable(bulkCollectJob)
    : false;

  React.useEffect(() => {
    if (initialSelectedBatchId && selectedBatchId !== initialSelectedBatchId) {
      setSelectedBatchId(initialSelectedBatchId);
    }
  }, [initialSelectedBatchId, selectedBatchId]);

  React.useEffect(() => {
    if (!selectedBatch && selectedBatchId !== null && !hasPinnedSelectedBatch) {
      setSelectedBatchId(null);
    }

    // 배치가 삭제되거나 목록이 새로 로드되면 선택값을 목록의 첫 배치로 복구합니다.
    if (!selectedBatch && batches.length > 0 && !hasPinnedSelectedBatch) {
      setSelectedBatchId(batches[0]!.id);
    }
  }, [batches, hasPinnedSelectedBatch, selectedBatch, selectedBatchId]);

  React.useEffect(() => {
    if (!selectedRow && selectedRowId !== null) {
      setSelectedRowId(null);
    }
  }, [selectedRow, selectedRowId]);

  React.useEffect(() => {
    setSelectedRowIds((current) =>
      // 이미 수집되었거나 오류 상태로 바뀐 행은 일괄 수집 선택에서 자동으로 제거합니다.
      current.filter((rowId) =>
        selectedBatchRows.some(
          (candidate) =>
            candidate.id === rowId && isImportedRowCollectable(candidate)
        )
      )
    );
  }, [selectedBatchRows]);

  React.useEffect(() => {
    if (activeBulkCollectJobQuery.data?.id && !bulkCollectJobId) {
      setBulkCollectJobId(activeBulkCollectJobQuery.data.id);
      setBulkCollectPollingEnabled(
        isImportBatchCollectionJobRunning(activeBulkCollectJobQuery.data)
      );
    }
  }, [activeBulkCollectJobQuery.data, bulkCollectJobId]);

  React.useEffect(() => {
    if (!bulkCollectJob) {
      return;
    }

    if (isImportBatchCollectionJobRunning(bulkCollectJob)) {
      setBulkCollectPollingEnabled(true);
      return;
    }

    setBulkCollectPollingEnabled(false);

    if (notifiedBulkCollectJobId === bulkCollectJob.id) {
      return;
    }

    setNotifiedBulkCollectJobId(bulkCollectJob.id);
    if (
      bulkCollectJob.status === 'SUCCEEDED' ||
      bulkCollectJob.status === 'PARTIAL'
    ) {
      notifySuccess(buildBulkCollectFeedbackMessage(bulkCollectJob));
    } else {
      setFeedback({
        severity: 'error',
        message: buildBulkCollectFeedbackMessage(bulkCollectJob)
      });
    }
    setSelectedRowId(null);
    setSelectedRowIds([]);
    // 완료된 작업 결과가 화면 전반에 영향을 주므로 배치, 수집 거래, 활성 작업 캐시를 동시에 새로고침합니다.
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: importBatchesQueryKey }),
      queryClient.invalidateQueries({
        queryKey: collectedTransactionsQueryKey
      }),
      queryClient.invalidateQueries({
        queryKey: [
          ...importBatchesQueryKey,
          selectedBatch?.id ?? 'none',
          'collection-jobs',
          'active'
        ]
      })
    ]);
  }, [
    bulkCollectJob,
    notifiedBulkCollectJobId,
    queryClient,
    selectedBatch?.id
  ]);

  React.useEffect(() => {
    if (
      uploadForm.sourceKind === 'IM_BANK_PDF' &&
      !uploadForm.fundingAccountId &&
      uploadFundingAccounts[0]
    ) {
      setUploadForm((current) => ({
        ...current,
        fundingAccountId: uploadFundingAccounts[0]!.id
      }));
    }
  }, [
    uploadForm.fundingAccountId,
    uploadForm.sourceKind,
    uploadFundingAccounts
  ]);

  React.useEffect(() => {
    const batchFundingAccountId = selectedBatch?.fundingAccountId ?? '';
    const defaultFundingAccountId =
      batchFundingAccountId || fundingAccountsQuery.data?.[0]?.id || '';

    if (!defaultFundingAccountId) {
      return;
    }

    setCollectForm((current) => {
      if (
        batchFundingAccountId &&
        current.fundingAccountId !== batchFundingAccountId
      ) {
        return {
          ...current,
          fundingAccountId: batchFundingAccountId
        };
      }

      if (!current.fundingAccountId) {
        return {
          ...current,
          fundingAccountId: defaultFundingAccountId
        };
      }

      return current;
    });
  }, [
    fundingAccountsQuery.data,
    selectedBatch?.fundingAccountId,
    selectedBatch?.id
  ]);

  useDomainHelp(
    buildImportsHelpContext(mode, currentPeriod?.monthLabel ?? null)
  );

  const createImportBatchMutation = useMutation({
    mutationFn: (input: ImportUploadFormState) => {
      if (input.sourceKind === 'IM_BANK_PDF') {
        if (!input.file) {
          throw new Error('IM뱅크 PDF 파일을 선택해 주세요.');
        }

        if (!input.fundingAccountId.trim()) {
          throw new Error('IM뱅크 PDF와 연결할 계좌/카드를 선택해 주세요.');
        }

        return createImportBatchFromFile({
          sourceKind: input.sourceKind,
          fileName: input.fileName,
          fundingAccountId: input.fundingAccountId,
          file: input.file
        });
      }

      const request: CreateImportBatchRequest = {
        sourceKind: input.sourceKind,
        fileName: input.fileName,
        fundingAccountId: null,
        content: input.content
      };

      return createImportBatch(request, buildImportBatchFallbackItem(request));
    },
    onSuccess: async (created) => {
      notifySuccess(
        `${created.fileName} 업로드를 등록하고 ${created.rowCount}개 행을 읽었습니다.`
      );
      setUploadDrawerOpen(false);
      setSelectedBatchId(created.id);
      setSelectedRowId(null);
      setSelectedRowIds([]);
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
    Boolean(selectedBatch) &&
    Boolean(selectedRow) &&
    Boolean(selectedRow && isImportedRowCollectable(selectedRow));
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
      notifySuccess(buildCollectSuccessMessage(created));
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
  const bulkCollectMutation = useMutation({
    mutationFn: (input: {
      importBatchId: string;
      request: BulkCollectImportedRowsRequest;
    }) => bulkCollectImportedRows(input.importBatchId, input.request),
    onSuccess: async (result) => {
      setBulkCollectJobId(result.id);
      setNotifiedBulkCollectJobId(null);
      setBulkCollectPollingEnabled(true);
      notifySuccess(
        `${result.requestedRowCount}건 일괄 등록 작업을 시작했습니다.`
      );
      await queryClient.invalidateQueries({
        queryKey: [
          ...importBatchesQueryKey,
          result.importBatchId,
          'collection-jobs',
          result.id
        ]
      });
    },
    onError: (error) => {
      setFeedback({
        severity: 'error',
        message:
          error instanceof Error
            ? error.message
            : '업로드 행 일괄 등록에 실패했습니다.'
      });
    }
  });
  const cancelBulkCollectJobMutation = useMutation({
    mutationFn: (input: { importBatchId: string; jobId: string }) =>
      cancelImportBatchCollectionJob(input.importBatchId, input.jobId),
    onSuccess: async (result) => {
      setBulkCollectJobId(result.id);
      setNotifiedBulkCollectJobId(null);
      setBulkCollectPollingEnabled(!result.finishedAt);
      notifySuccess(
        `${result.requestedRowCount}건 일괄 등록 작업 중단을 요청했습니다. 이미 처리 중인 행은 완료된 뒤 멈춥니다.`
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [
            ...importBatchesQueryKey,
            result.importBatchId,
            'collection-jobs',
            result.id
          ]
        }),
        queryClient.invalidateQueries({
          queryKey: [
            ...importBatchesQueryKey,
            result.importBatchId,
            'collection-jobs',
            'active'
          ]
        })
      ]);
    },
    onError: (error) => {
      setFeedback({
        severity: 'error',
        message:
          error instanceof Error
            ? error.message
            : '업로드 행 일괄 등록 작업을 중단하지 못했습니다.'
      });
    }
  });
  const deleteImportBatchMutation = useMutation({
    mutationFn: (batch: ImportBatchItem) => deleteImportBatch(batch.id),
    onSuccess: async (_result, batch) => {
      notifySuccess(`${batch.fileName} 배치를 삭제했습니다.`);
      setCollectDrawerOpen(false);
      setSelectedBatchId(null);
      setSelectedRowId(null);
      setSelectedRowIds([]);
      await queryClient.invalidateQueries({ queryKey: importBatchesQueryKey });
    },
    onError: (error) => {
      setFeedback({
        severity: 'error',
        message:
          error instanceof Error
            ? error.message
            : '업로드 배치를 삭제하지 못했습니다.'
      });
    }
  });
  const cancelImportBatchCollectionMutation = useMutation({
    mutationFn: (batch: ImportBatchItem) =>
      cancelImportBatchCollection(batch.id),
    onSuccess: async (result, batch) => {
      notifySuccess(
        `${batch.fileName} 배치의 수집 거래 ${result.cancelledTransactionCount}건을 취소했습니다. 원계획 ${result.restoredPlanItemCount}건을 초안으로 되돌렸습니다.`
      );
      setCollectDrawerOpen(false);
      setSelectedRowId(null);
      setSelectedRowIds([]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: importBatchesQueryKey }),
        queryClient.invalidateQueries({
          queryKey: collectedTransactionsQueryKey
        }),
        queryClient.invalidateQueries({ queryKey: ['plan-items'] }),
        queryClient.invalidateQueries({ queryKey: liabilitiesQueryKey })
      ]);
    },
    onError: (error) => {
      setFeedback({
        severity: 'error',
        message:
          error instanceof Error
            ? error.message
            : '업로드 배치 등록을 취소하지 못했습니다.'
      });
    }
  });

  function handleSelectBatch(batch: ImportBatchItem) {
    setSelectedBatchId(batch.id);
    setSelectedRowId(null);
    setSelectedRowIds([]);
    setCollectDrawerOpen(false);
  }

  function handlePrepareCollectRow(row: ImportedRowTableItem) {
    if (!isImportedRowCollectable(row)) {
      setFeedback({
        severity: 'error',
        message:
          row.parseStatus === 'PARSED' && !row.isCurrentPeriodRow
            ? '현재 운영월 범위의 업로드 행만 수집 거래로 등록할 수 있습니다.'
            : '이 업로드 행은 아직 수집 거래로 등록할 수 없습니다.'
      });
      return;
    }

    setSelectedRowId(row.id);
    setCollectForm((current) => ({
      ...current,
      type: row.collectTypeHint ?? current.type
    }));
    setCollectDrawerOpen(true);
  }

  function updateUploadForm(patch: Partial<ImportUploadFormState>) {
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

  function updateBulkCollectForm(patch: Partial<BulkCollectFormState>) {
    setBulkCollectForm((current) => ({
      ...current,
      ...patch
    }));
  }

  async function submitUpload() {
    setFeedback(null);

    try {
      await createImportBatchMutation.mutateAsync(uploadForm);
    } catch {
      // React Query의 onError가 이미 실패를 페이지 피드백 영역에 반영한다.
    }
  }

  async function submitCollect() {
    if (!selectedBatch || !selectedRow) {
      return;
    }

    setFeedback(null);

    const potentialDuplicateTransactionCount =
      collectPreviewQuery.data?.autoPreparation
        .potentialDuplicateTransactionCount ?? 0;
    const request: CollectImportedRowRequest =
      potentialDuplicateTransactionCount > 0
        ? {
            ...normalizedCollectRequest,
            confirmPotentialDuplicate: false
          }
        : normalizedCollectRequest;

    if (potentialDuplicateTransactionCount > 0) {
      const confirmed = window.confirm(
        `${selectedRow.title} 행은 같은 거래일·금액·입출금 유형의 기존 거래 ${potentialDuplicateTransactionCount}건과 겹칩니다. 확인 후에도 등록할까요?`
      );

      if (!confirmed) {
        return;
      }

      request.confirmPotentialDuplicate = true;
    }

    try {
      await collectImportedRowMutation.mutateAsync({
        importBatchId: selectedBatch.id,
        importedRow: selectedRow,
        request
      });
    } catch {
      // React Query의 onError가 이미 실패를 페이지 피드백 영역에 반영한다.
    }
  }

  async function submitBulkCollect(rowIds?: string[]) {
    if (!selectedBatch) {
      return;
    }

    if (isBulkCollectJobRunning) {
      setFeedback({
        severity: 'error',
        message: '이미 일괄 등록 작업이 진행 중입니다. 진행률을 확인해 주세요.'
      });
      return;
    }

    if (!bulkFundingAccountId.trim()) {
      setFeedback({
        severity: 'error',
        message:
          '배치에 연결된 계좌/카드가 없어 일괄 등록할 수 없습니다. 먼저 배치 연결 계좌를 확인해 주세요.'
      });
      return;
    }

    const explicitRows = rowIds
      ? selectedBatchRows.filter((row) => rowIds.includes(row.id))
      : null;
    const hasSelection = explicitRows
      ? explicitRows.length > 0
      : selectedRows.length > 0;
    const targetRows = explicitRows
      ? explicitRows.filter((row) => isImportedRowCollectable(row))
      : hasSelection
        ? selectedCollectableRows
        : collectableRows;

    if (targetRows.length === 0) {
      setFeedback({
        severity: 'error',
        message: hasSelection
          ? '선택한 행 중 바로 등록할 수 있는 행이 없습니다.'
          : '바로 등록할 수 있는 행이 없습니다.'
      });
      return;
    }

    setFeedback(null);

    try {
      const categoryId = normalizeOptionalValue(bulkCollectForm.categoryId);
      const memo = normalizeOptionalValue(bulkCollectForm.memo);
      const typeOptions = buildBulkCollectTypeOptionsPayload(
        bulkCollectForm.typeOptions
      );

      await bulkCollectMutation.mutateAsync({
        importBatchId: selectedBatch.id,
        request: {
          rowIds: targetRows.map((row) => row.id),
          ...(bulkCollectForm.type ? { type: bulkCollectForm.type } : {}),
          fundingAccountId: bulkFundingAccountId,
          ...(categoryId ? { categoryId } : {}),
          ...(memo ? { memo } : {}),
          ...(typeOptions.length > 0 ? { typeOptions } : {})
        }
      });
    } catch {
      // React Query의 onError가 이미 실패를 페이지 피드백 영역에 반영한다.
    }
  }

  async function cancelBulkCollectJob() {
    if (!selectedBatch || !bulkCollectJob || !canCancelBulkCollectJob) {
      return false;
    }

    const confirmed = window.confirm(
      `${selectedBatch.fileName} 배치의 일괄 등록 작업을 중단할까요? 이미 처리 중인 행은 완료될 수 있고, 아직 시작하지 않은 행은 등록하지 않습니다.`
    );

    if (!confirmed) {
      return false;
    }

    setFeedback(null);

    try {
      await cancelBulkCollectJobMutation.mutateAsync({
        importBatchId: selectedBatch.id,
        jobId: bulkCollectJob.id
      });
      return true;
    } catch {
      return false;
    }
  }

  async function deleteSelectedBatch() {
    if (!selectedBatch) {
      return false;
    }

    const confirmed = window.confirm(
      `${selectedBatch.fileName} 배치를 삭제할까요? 연결된 수집 거래가 있는 배치는 삭제되지 않습니다.`
    );

    if (!confirmed) {
      return false;
    }

    setFeedback(null);

    try {
      await deleteImportBatchMutation.mutateAsync(selectedBatch);
      return true;
    } catch {
      return false;
    }
  }

  async function cancelSelectedBatchCollection() {
    if (!selectedBatch) {
      return false;
    }

    const confirmed = window.confirm(
      `${selectedBatch.fileName} 배치에서 등록된 수집 거래를 전체 취소할까요? 전표 확정 전 거래만 취소할 수 있고, 업로드 원본 행은 보존됩니다.`
    );

    if (!confirmed) {
      return false;
    }

    setFeedback(null);

    try {
      await cancelImportBatchCollectionMutation.mutateAsync(selectedBatch);
      return true;
    } catch {
      return false;
    }
  }

  return {
    batches,
    bulkCollectForm,
    canSubmitCollect:
      Boolean(selectedBatch) &&
      selectedRowCanCollect &&
      normalizedCollectRequest.fundingAccountId.length > 0,
    categories: categoriesQuery.data ?? [],
    cancelSelectedBatchCollection,
    cancelSelectedBatchCollectionPending:
      cancelImportBatchCollectionMutation.isPending,
    closeCollectDrawer: () => setCollectDrawerOpen(false),
    closeUploadDrawer: () => setUploadDrawerOpen(false),
    collectForm,
    collectPreview: {
      isLoading: collectPreviewQuery.isLoading,
      error: collectPreviewQuery.error,
      data: collectPreviewQuery.data
    },
    currentPeriod,
    collectableRowCount: collectableRows.length,
    currentPeriodQuery,
    deleteSelectedBatch,
    deleteSelectedBatchPending: deleteImportBatchMutation.isPending,
    feedback,
    fundingAccounts: fundingAccountsQuery.data ?? [],
    importBatchesQuery,
    bulkCollectJob,
    cancelBulkCollectJob,
    cancelBulkCollectJobPending: cancelBulkCollectJobMutation.isPending,
    isBulkCollectPending:
      bulkCollectMutation.isPending || isBulkCollectJobRunning,
    isCollectDrawerOpen,
    isUploadDrawerOpen,
    openUploadDrawer: () => setUploadDrawerOpen(true),
    prepareCollectRow: handlePrepareCollectRow,
    referenceDataReadinessQuery,
    selectBatch: handleSelectBatch,
    selectRows: setSelectedRowIds,
    selectedBatch,
    selectedBatchRows,
    selectedCollectableRowCount: selectedCollectableRows.length,
    selectedRow,
    selectedRowCanCollect,
    selectedRowId,
    selectedRowIds,
    selectedRowsCount: selectedRows.length,
    submitBulkCollect,
    submitCollect,
    submitCollectPending: collectImportedRowMutation.isPending,
    submitUpload,
    submitUploadPending: createImportBatchMutation.isPending,
    updateCollectForm,
    updateBulkCollectForm,
    updateUploadForm,
    uploadFundingAccounts,
    uploadForm
  };
}

function isImportBatchFundingAccount(fundingAccount: FundingAccountItem) {
  return (
    fundingAccount.status === 'ACTIVE' &&
    (fundingAccount.type === 'BANK' || fundingAccount.type === 'CARD')
  );
}

function buildDefaultBulkCollectTypeOptions(): Record<
  CollectedTransactionType,
  BulkCollectTypeOptionFormState
> {
  return {
    INCOME: { categoryId: '', memo: '' },
    EXPENSE: { categoryId: '', memo: '' },
    TRANSFER: { categoryId: '', memo: '' },
    REVERSAL: { categoryId: '', memo: '' }
  };
}

function buildBulkCollectTypeOptionsPayload(
  typeOptions: BulkCollectFormState['typeOptions']
): NonNullable<BulkCollectImportedRowsRequest['typeOptions']> {
  return bulkCollectTransactionTypes.flatMap((type) => {
    const categoryId = normalizeOptionalValue(typeOptions[type].categoryId);
    const memo = normalizeOptionalValue(typeOptions[type].memo);

    if (!categoryId && !memo) {
      return [];
    }

    return [
      {
        type,
        ...(categoryId ? { categoryId } : {}),
        ...(memo ? { memo } : {})
      }
    ];
  });
}

function isImportedRowCollectable(row: ImportedRowTableItem) {
  return (
    row.parseStatus === 'PARSED' &&
    !row.createdCollectedTransactionId &&
    row.isCurrentPeriodRow
  );
}

function buildBulkCollectFeedbackMessage(
  result: BulkCollectImportedRowsResponse
) {
  const firstFailure = result.results.find(
    (candidate) => candidate.status === 'FAILED'
  )?.message;
  const parts = [
    `${result.requestedRowCount}건 중 ${result.processedRowCount}건 처리, ${result.succeededCount}건을 수집 거래로 등록했습니다.`
  ];

  if (result.failedCount > 0) {
    parts.push(`실패 ${result.failedCount}건이 남았습니다.`);
  }

  if (firstFailure) {
    parts.push(`첫 실패 사유: ${firstFailure}`);
  }

  return parts.join(' ');
}

function isImportBatchCollectionJobRunning(job: ImportBatchCollectionJobItem) {
  return (
    job.status === 'PENDING' ||
    job.status === 'RUNNING' ||
    (job.status === 'CANCELLED' && !job.finishedAt)
  );
}

function isImportBatchCollectionJobCancellable(
  job: ImportBatchCollectionJobItem
) {
  return job.status === 'PENDING' || job.status === 'RUNNING';
}

function buildImportsHelpContext(
  mode: 'list' | 'detail',
  currentPeriodLabel: string | null
) {
  if (mode === 'detail') {
    return {
      title: '업로드 배치 작업대 도움말',
      description:
        '이 화면은 선택한 업로드 배치의 행을 검토하고, 필요한 항목만 수집 거래로 등록하는 전용 작업대입니다.',
      primaryEntity: '업로드 행 등록 작업대',
      relatedEntities: ['업로드 배치', '수집 거래', '자금수단', '카테고리'],
      truthSource:
        '업로드 행은 거래 후보 검토 단계이며, 실제 회계 확정은 수집 거래 확정 뒤 전표에서 이루어집니다.',
      supplementarySections: [
        {
          title: '이 탭에서 하는 일',
          items: [
            '현재 선택한 배치의 업로드 행을 훑어보며 등록 가능한 행을 찾습니다.',
            '수집 거래 등록 화면에서 거래 성격, 자금수단, 카테고리와 자동 판정 결과를 확인합니다.',
            '등록 후에는 수집 거래 화면으로 넘어가 전표 준비 상태와 확정 여부를 이어서 검토합니다.'
          ]
        },
        {
          title: '막히면 확인',
          items: [
            '운영 중에는 최신 진행월 범위의 업로드 행만 수집 거래로 등록합니다.',
            '운영월 자동 생성은 운영 시작 전 초기 입력 또는 마감 후 신규 계좌/카드 기초 입력에만 제한됩니다.',
            '잠금된 마감월 데이터나 최신 진행월 밖의 거래는 저장되지 않으며, 해당 사유를 바로 안내합니다.',
            '자금수단이나 카테고리 선택지가 부족하면 기준 데이터 관리 화면에서 먼저 보완합니다.',
            '거래일·금액·입출금 유형이 같은 기존 거래가 있으면 한 번 더 확인한 뒤 등록합니다.'
          ]
        },
        {
          title: '이어지는 화면',
          links: [
            {
              title: '업로드 배치',
              description:
                '다른 배치를 다시 선택하거나 새 업로드 배치를 등록합니다.',
              href: '/imports',
              actionLabel: '배치 목록 보기'
            },
            {
              title: '수집 거래',
              description:
                '등록한 거래가 전표 준비 상태인지 확인하고 전표로 확정합니다.',
              href: '/transactions',
              actionLabel: '수집 거래 보기'
            }
          ]
        }
      ],
      readModelNote: currentPeriodLabel
        ? `${currentPeriodLabel} 최신 진행월 범위의 거래만 업로드 행에서 수집 거래로 등록할 수 있습니다.`
        : '열린 운영 월이 없을 때의 자동 생성은 운영 시작 전 초기 입력 또는 신규 계좌/카드 기초 입력으로 제한됩니다.'
    };
  }

  return {
    title: '업로드 배치 도움말',
    description:
      '이 화면은 파일이나 붙여넣기 원본을 업로드 배치로 보관하고, 검토할 배치를 골라 작업대로 이어가는 시작 화면입니다.',
    primaryEntity: '업로드 배치',
    relatedEntities: ['업로드 행', '수집 거래', '계획 항목', '운영 월'],
    truthSource:
      '업로드 배치는 파일을 읽고 거래 후보를 고르는 단계이며, 실제 회계 확정은 전표에서 이루어집니다.',
    supplementarySections: [
      {
        title: '이 탭에서 하는 일',
        items: [
          '업로드 배치 등록을 열고 원본 종류, 파일명, CSV 또는 붙여넣기 내용을 입력합니다.',
          '업로드 배치 목록에서 검토할 배치를 선택합니다.',
          '배치를 고른 뒤 작업대로 이동해 업로드 행 검토와 수집 거래 등록을 이어서 진행합니다.'
        ]
      },
      {
        title: '이어지는 화면',
        links: [
          {
            title: '수집 거래',
            description:
              '업로드에서 등록한 거래를 전표 준비 상태와 함께 최종 검토합니다.',
            href: '/transactions',
            actionLabel: '수집 거래 보기'
          }
        ]
      }
    ],
    readModelNote: currentPeriodLabel
      ? `${currentPeriodLabel} 최신 진행월 기준으로 업로드 배치를 검토하고, 진행월 밖의 행은 월 운영 흐름을 먼저 정리한 뒤 처리합니다.`
      : '열린 운영 월이 없을 때의 자동 생성은 운영 시작 전 초기 입력 또는 신규 계좌/카드 기초 입력으로 제한됩니다.'
  };
}
