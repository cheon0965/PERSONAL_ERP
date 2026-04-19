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

export function useImportsPage(
  initialSelectedBatchId: string | null = null,
  mode: 'list' | 'detail' = 'list'
) {
  const queryClient = useQueryClient();
  const hasPinnedSelectedBatch = initialSelectedBatchId != null;
  const [feedback, setFeedback] = React.useState<FeedbackState>(null);
  const [selectedBatchId, setSelectedBatchId] = React.useState<string | null>(
    initialSelectedBatchId
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

  React.useEffect(() => {
    if (initialSelectedBatchId && selectedBatchId !== initialSelectedBatchId) {
      setSelectedBatchId(initialSelectedBatchId);
    }
  }, [initialSelectedBatchId, selectedBatchId]);

  React.useEffect(() => {
    if (!selectedBatch && selectedBatchId !== null && !hasPinnedSelectedBatch) {
      setSelectedBatchId(null);
    }

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

  useDomainHelp(buildImportsHelpContext(mode, currentPeriod?.monthLabel ?? null));

  const createImportBatchMutation = useMutation({
    mutationFn: (input: CreateImportBatchRequest) =>
      createImportBatch(input, buildImportBatchFallbackItem(input)),
    onSuccess: async (created) => {
      setFeedback({
        severity: 'success',
        message: `${created.fileName} 업로드를 등록하고 ${created.rowCount}개 행을 읽었습니다.`
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
            '열린 운영 월이 없으면 업로드 행 등록과 자동 판정 결과가 막힙니다.',
            '자금수단이나 카테고리 선택지가 부족하면 기준 데이터 관리 화면에서 먼저 보완합니다.',
            '이미 수집 거래로 올린 행은 다시 등록하지 않고 연결된 수집 거래 상태만 추적합니다.'
          ]
        },
        {
          title: '이어지는 화면',
          links: [
            {
              title: '업로드 배치',
              description: '다른 배치를 다시 선택하거나 새 업로드 배치를 등록합니다.',
              href: '/imports',
              actionLabel: '배치 목록 보기'
            },
            {
              title: '수집 거래',
              description: '등록한 거래가 전표 준비 상태인지 확인하고 전표로 확정합니다.',
              href: '/transactions',
              actionLabel: '수집 거래 보기'
            }
          ]
        }
      ],
      readModelNote: currentPeriodLabel
        ? `${currentPeriodLabel} 운영 월이 열려 있어 자동 판정 근거를 확인한 뒤 바로 수집 거래로 올릴 수 있습니다.`
        : '현재 열린 운영 월이 없으면 업로드는 가능하지만 업로드 행 등록과 자동 판정 결과는 막힙니다.'
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
            description: '업로드에서 등록한 거래를 전표 준비 상태와 함께 최종 검토합니다.',
            href: '/transactions',
            actionLabel: '수집 거래 보기'
          }
        ]
      }
    ],
    readModelNote: currentPeriodLabel
      ? `${currentPeriodLabel} 운영 월이 열려 있어 배치를 고른 뒤 바로 업로드 행 등록 작업대로 이어갈 수 있습니다.`
      : '현재 열린 운영 월이 없으면 업로드 자체는 가능하지만, 실제 거래 등록 단계는 제한될 수 있습니다.'
  };
}
