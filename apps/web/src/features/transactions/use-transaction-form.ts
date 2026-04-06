'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AccountingPeriodItem,
  CollectedTransactionDetailItem,
  CollectedTransactionItem,
  UpdateCollectedTransactionRequest
} from '@personal-erp/contracts';
import { useForm } from 'react-hook-form';
import {
  categoriesManagementQueryKey,
  categoriesQueryKey,
  fundingAccountsManagementQueryKey,
  fundingAccountsQueryKey,
  getCategories,
  getFundingAccounts,
  getReferenceDataReadiness,
  referenceDataReadinessQueryKey
} from '@/features/reference-data/reference-data.api';
import { webRuntime } from '@/shared/config/env';
import { resolveStatusLabel } from '@/shared/ui/status-chip';
import {
  buildCollectedTransactionFallbackItem,
  collectedTransactionDetailQueryKey,
  collectedTransactionsQueryKey,
  createCollectedTransaction,
  mergeCollectedTransactionItem,
  updateCollectedTransaction
} from './transactions.api';
import { resolveManualCollectedTransactionPostingStatus } from './transaction-workflow';
import { mapDetailToFormInput } from './transaction-form.mapper';
import {
  isWithinPeriod,
  resolveInitialBusinessDate,
  transactionSchema,
  type TransactionFormInput
} from './transaction-form.schema';

export type TransactionFormMode = 'create' | 'edit';

type SubmitFeedback = {
  severity: 'success' | 'error';
  message: string;
} | null;

type SaveTransactionMutationInput = {
  mode: TransactionFormMode;
  collectedTransactionId?: string;
  payload: UpdateCollectedTransactionRequest;
  fallback: CollectedTransactionItem;
};

export function useTransactionForm(input: {
  currentPeriod: AccountingPeriodItem | null;
  mode: TransactionFormMode;
  initialTransaction: CollectedTransactionDetailItem | null;
  onCompleted?: (
    transaction: CollectedTransactionItem,
    mode: TransactionFormMode
  ) => void;
}) {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = React.useState<SubmitFeedback>(null);
  const includeInactiveCategories =
    input.mode === 'edit' && Boolean(input.initialTransaction?.categoryId);
  const includeInactiveFundingAccounts =
    input.mode === 'edit' &&
    Boolean(input.initialTransaction?.fundingAccountId);
  const { data: fundingAccounts = [], error: fundingAccountsError } = useQuery({
    queryKey: includeInactiveFundingAccounts
      ? fundingAccountsManagementQueryKey
      : fundingAccountsQueryKey,
    queryFn: () =>
      getFundingAccounts({ includeInactive: includeInactiveFundingAccounts })
  });
  const { data: categories = [], error: categoriesError } = useQuery({
    queryKey: includeInactiveCategories
      ? categoriesManagementQueryKey
      : categoriesQueryKey,
    queryFn: () => getCategories({ includeInactive: includeInactiveCategories })
  });
  const referenceDataReadinessQuery = useQuery({
    queryKey: referenceDataReadinessQueryKey,
    queryFn: getReferenceDataReadiness
  });
  const form = useForm<TransactionFormInput>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      title: '',
      amountWon: 0,
      businessDate: resolveInitialBusinessDate(input.currentPeriod),
      type: 'EXPENSE',
      accountId: '',
      categoryId: '',
      memo: ''
    }
  });
  const selectedType = form.watch('type');
  const selectedFundingAccountId = form.watch('accountId');
  const selectedCategoryId = form.watch('categoryId');
  const availableFundingAccounts = React.useMemo(
    () =>
      fundingAccounts.filter(
        (fundingAccount) =>
          fundingAccount.status === 'ACTIVE' ||
          fundingAccount.id === selectedFundingAccountId
      ),
    [fundingAccounts, selectedFundingAccountId]
  );
  const filteredCategories = React.useMemo(
    () =>
      categories.filter(
        (category) =>
          category.kind === selectedType &&
          (category.isActive || category.id === selectedCategoryId)
      ),
    [categories, selectedCategoryId, selectedType]
  );
  const predictedStatus = React.useMemo(
    () =>
      resolveManualCollectedTransactionPostingStatus({
        type: selectedType,
        categoryId: selectedCategoryId
      }),
    [selectedCategoryId, selectedType]
  );

  const mutation = useMutation({
    mutationFn: ({
      mode,
      collectedTransactionId,
      payload,
      fallback
    }: SaveTransactionMutationInput) => {
      if (mode === 'edit' && collectedTransactionId) {
        return updateCollectedTransaction(
          collectedTransactionId,
          payload,
          fallback
        );
      }

      return createCollectedTransaction(payload, fallback);
    },
    onSuccess: async (saved, variables) => {
      queryClient.setQueryData<CollectedTransactionItem[]>(
        collectedTransactionsQueryKey,
        (current) => mergeCollectedTransactionItem(current, saved)
      );

      if (!webRuntime.demoFallbackEnabled) {
        const invalidations = [
          queryClient.invalidateQueries({
            queryKey: collectedTransactionsQueryKey
          }),
          queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
        ];

        if (variables.mode === 'edit' && variables.collectedTransactionId) {
          invalidations.push(
            queryClient.invalidateQueries({
              queryKey: collectedTransactionDetailQueryKey(
                variables.collectedTransactionId
              )
            })
          );
        }

        await Promise.all(invalidations);
      }
    }
  });

  React.useEffect(() => {
    const firstFundingAccount = availableFundingAccounts[0];
    if (!form.getValues('accountId') && firstFundingAccount) {
      form.setValue('accountId', firstFundingAccount.id, {
        shouldValidate: true
      });
    }
  }, [availableFundingAccounts, form]);

  React.useEffect(() => {
    const currentCategoryId = form.getValues('categoryId');
    if (
      currentCategoryId &&
      !filteredCategories.some((category) => category.id === currentCategoryId)
    ) {
      form.setValue('categoryId', '');
    }
  }, [filteredCategories, form]);

  React.useEffect(() => {
    setFeedback(null);

    if (input.mode === 'edit' && input.initialTransaction) {
      form.reset(mapDetailToFormInput(input.initialTransaction));
      return;
    }

    form.reset({
      title: '',
      amountWon: 0,
      businessDate: resolveInitialBusinessDate(input.currentPeriod),
      type: 'EXPENSE',
      accountId: '',
      categoryId: '',
      memo: ''
    });
  }, [form, input.currentPeriod, input.initialTransaction, input.mode]);

  React.useEffect(() => {
    const nextValue = resolveInitialBusinessDate(input.currentPeriod);
    const currentValue = form.getValues('businessDate');

    if (!currentValue || !isWithinPeriod(currentValue, input.currentPeriod)) {
      form.setValue('businessDate', nextValue, { shouldValidate: true });
    }
  }, [form, input.currentPeriod]);

  const referenceError = fundingAccountsError ?? categoriesError;
  const canSaveInPeriod = Boolean(input.currentPeriod);
  const isBusy =
    mutation.isPending ||
    form.formState.isSubmitting ||
    availableFundingAccounts.length === 0 ||
    Boolean(referenceError) ||
    !canSaveInPeriod ||
    (input.mode === 'edit' && !input.initialTransaction);

  async function submit(values: TransactionFormInput) {
    setFeedback(null);

    if (!input.currentPeriod) {
      setFeedback({
        severity: 'error',
        message:
          '현재 열린 운영 기간이 없어 수집 거래를 저장할 수 없습니다. 먼저 월 운영을 시작해 주세요.'
      });
      return;
    }

    if (input.mode === 'edit' && !input.initialTransaction) {
      setFeedback({
        severity: 'error',
        message: '수정할 수집 거래 상세 정보를 아직 불러오지 못했습니다.'
      });
      return;
    }

    if (!isWithinPeriod(values.businessDate, input.currentPeriod)) {
      setFeedback({
        severity: 'error',
        message: '거래 일자는 현재 열린 운영 기간 안에 있어야 합니다.'
      });
      return;
    }

    const selectedFundingAccount = availableFundingAccounts.find(
      (fundingAccount) => fundingAccount.id === values.accountId
    );
    if (!selectedFundingAccount) {
      setFeedback({
        severity: 'error',
        message: '수집 거래를 저장하기 전에 자금수단을 선택해 주세요.'
      });
      return;
    }

    const selectedCategory = filteredCategories.find(
      (category) => category.id === values.categoryId
    );
    const payload: UpdateCollectedTransactionRequest = {
      title: values.title.trim(),
      type: values.type,
      amountWon: values.amountWon,
      businessDate: values.businessDate,
      fundingAccountId: values.accountId,
      categoryId: values.categoryId || undefined,
      memo: values.memo.trim() || undefined
    };

    try {
      const saved = await mutation.mutateAsync({
        mode: input.mode,
        collectedTransactionId: input.initialTransaction?.id,
        payload,
        fallback: buildCollectedTransactionFallbackItem(payload, {
          id: input.initialTransaction?.id,
          fundingAccountName: selectedFundingAccount.name,
          categoryName: selectedCategory?.name,
          sourceKind: input.initialTransaction?.sourceKind,
          postingStatus: input.initialTransaction?.postingStatus,
          postedJournalEntryId: input.initialTransaction?.postedJournalEntryId,
          postedJournalEntryNumber:
            input.initialTransaction?.postedJournalEntryNumber
        })
      });

      if (input.onCompleted) {
        input.onCompleted(saved, input.mode);
        return;
      }

      if (input.mode === 'create') {
        form.reset({
          title: '',
          amountWon: 0,
          businessDate: resolveInitialBusinessDate(input.currentPeriod),
          type: values.type,
          accountId: values.accountId,
          categoryId: '',
          memo: ''
        });
      }

      setFeedback({
        severity: 'success',
        message:
          input.mode === 'edit'
            ? `수집 거래를 수정했고 ${resolveStatusLabel(saved.postingStatus)} 상태로 반영했습니다.`
            : `수집 거래를 등록했고 ${resolveStatusLabel(saved.postingStatus)} 상태로 반영했습니다.`
      });
    } catch (error) {
      setFeedback({
        severity: 'error',
        message:
          error instanceof Error
            ? error.message
            : input.mode === 'edit'
              ? '수집 거래를 수정하지 못했습니다.'
              : '수집 거래를 등록하지 못했습니다.'
      });
    }
  }

  return {
    availableFundingAccounts,
    currentPeriod: input.currentPeriod,
    feedback,
    filteredCategories,
    form,
    isBusy,
    mode: input.mode,
    mutationPending: mutation.isPending,
    predictedStatus,
    referenceDataReadinessQuery,
    referenceError,
    selectedType,
    setFeedback,
    submit,
    submitLabel: input.mode === 'edit' ? '수집 거래 수정' : '수집 거래 등록'
  };
}
