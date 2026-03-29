'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Grid, MenuItem, Stack, TextField } from '@mui/material';
import type {
  AccountingPeriodItem,
  CollectedTransactionItem,
  CreateCollectedTransactionRequest
} from '@personal-erp/contracts';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { getFundingAccounts, getCategories } from '@/features/reference-data/reference-data.api';
import { webRuntime } from '@/shared/config/env';
import { getTodayDateInputValue } from '@/shared/lib/date-input';
import { appLayout } from '@/shared/ui/layout-metrics';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import {
  buildCollectedTransactionFallbackItem,
  collectedTransactionsQueryKey,
  createCollectedTransaction,
  mergeCollectedTransactionItem
} from './transactions.api';

const transactionSchema = z.object({
  title: z.string().trim().min(2, '제목은 2자 이상이어야 합니다.'),
  amountWon: z.coerce.number().int().positive('금액은 0보다 커야 합니다.'),
  businessDate: z.string().min(1, '거래일을 입력해 주세요.'),
  type: z.enum(['INCOME', 'EXPENSE']),
  accountId: z.string().min(1, '자금수단을 선택해 주세요.'),
  categoryId: z.string(),
  memo: z.string().max(500, '메모는 500자 이하여야 합니다.')
});

type TransactionFormInput = z.infer<typeof transactionSchema>;

type SubmitFeedback =
  | {
      severity: 'success' | 'error';
      message: string;
    }
  | null;

type CreateTransactionMutationInput = {
  payload: CreateCollectedTransactionRequest;
  fallback: CollectedTransactionItem;
};

type TransactionFormProps = {
  currentPeriod: AccountingPeriodItem | null;
};

export function TransactionForm({ currentPeriod }: TransactionFormProps) {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = React.useState<SubmitFeedback>(null);
  const { data: fundingAccounts = [], error: fundingAccountsError } = useQuery({
    queryKey: ['funding-accounts'],
    queryFn: getFundingAccounts
  });
  const { data: categories = [], error: categoriesError } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories
  });
  const form = useForm<TransactionFormInput>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      title: '',
      amountWon: 0,
      businessDate: resolveInitialBusinessDate(currentPeriod),
      type: 'EXPENSE',
      accountId: '',
      categoryId: '',
      memo: ''
    }
  });
  const selectedType = form.watch('type');
  const filteredCategories = React.useMemo(
    () => categories.filter((category) => category.kind === selectedType),
    [categories, selectedType]
  );

  const mutation = useMutation({
    mutationFn: ({ payload, fallback }: CreateTransactionMutationInput) =>
      createCollectedTransaction(payload, fallback),
    onSuccess: async (created) => {
      queryClient.setQueryData<CollectedTransactionItem[]>(
        collectedTransactionsQueryKey,
        (current) => mergeCollectedTransactionItem(current, created)
      );

      if (!webRuntime.demoFallbackEnabled) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: collectedTransactionsQueryKey }),
          queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
        ]);
      }
    }
  });

  React.useEffect(() => {
    const firstFundingAccount = fundingAccounts[0];
    if (!form.getValues('accountId') && firstFundingAccount) {
      form.setValue('accountId', firstFundingAccount.id, { shouldValidate: true });
    }
  }, [fundingAccounts, form]);

  React.useEffect(() => {
    const selectedCategoryId = form.getValues('categoryId');
    if (
      selectedCategoryId &&
      !filteredCategories.some((category) => category.id === selectedCategoryId)
    ) {
      form.setValue('categoryId', '');
    }
  }, [filteredCategories, form]);

  React.useEffect(() => {
    const nextValue = resolveInitialBusinessDate(currentPeriod);
    const currentValue = form.getValues('businessDate');

    if (
      !currentValue ||
      !isWithinPeriod(currentValue, currentPeriod)
    ) {
      form.setValue('businessDate', nextValue, { shouldValidate: true });
    }
  }, [currentPeriod, form]);

  const referenceError = fundingAccountsError ?? categoriesError;
  const canCreateInPeriod = Boolean(currentPeriod);
  const isBusy =
    mutation.isPending ||
    form.formState.isSubmitting ||
    fundingAccounts.length === 0 ||
    Boolean(referenceError) ||
    !canCreateInPeriod;

  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        setFeedback(null);

        if (!currentPeriod) {
          setFeedback({
            severity: 'error',
            message:
              '현재 열린 운영 기간이 없어 수집 거래를 등록할 수 없습니다. 먼저 월 운영을 시작해 주세요.'
          });
          return;
        }

        if (!isWithinPeriod(values.businessDate, currentPeriod)) {
          setFeedback({
            severity: 'error',
            message:
              '거래 일자는 현재 열린 운영 기간 안에 있어야 합니다.'
          });
          return;
        }

        const selectedFundingAccount = fundingAccounts.find(
          (fundingAccount) => fundingAccount.id === values.accountId
        );
        if (!selectedFundingAccount) {
          setFeedback({
            severity: 'error',
            message: '수집 거래를 등록하기 전에 자금수단을 선택해 주세요.'
          });
          return;
        }

        const selectedCategory = filteredCategories.find(
          (category) => category.id === values.categoryId
        );
        const payload: CreateCollectedTransactionRequest = {
          title: values.title.trim(),
          type: values.type,
          amountWon: values.amountWon,
          businessDate: values.businessDate,
          fundingAccountId: values.accountId,
          categoryId: values.categoryId || undefined,
          memo: values.memo.trim() || undefined
        };

        try {
          await mutation.mutateAsync({
            payload,
            fallback: buildCollectedTransactionFallbackItem(payload, {
              fundingAccountName: selectedFundingAccount.name,
              categoryName: selectedCategory?.name
            })
          });

          form.reset({
            title: '',
            amountWon: 0,
            businessDate: resolveInitialBusinessDate(currentPeriod),
            type: values.type,
            accountId: values.accountId,
            categoryId: '',
            memo: ''
          });
          setFeedback({
            severity: 'success',
            message: '수집 거래를 등록했고 목록을 새로고침했습니다.'
          });
        } catch (error) {
          setFeedback({
            severity: 'error',
            message:
              error instanceof Error
                ? error.message
                : '수집 거래를 등록하지 못했습니다.'
          });
        }
      })}
    >
      <Stack spacing={appLayout.cardGap}>
        {referenceError ? (
          <QueryErrorAlert
            title="자금수단 또는 카테고리 조회에 실패했습니다."
            error={referenceError}
          />
        ) : null}
        {feedback ? (
          <Alert severity={feedback.severity} variant="outlined">
            {feedback.message}
          </Alert>
        ) : null}
        {!currentPeriod ? (
          <Alert severity="warning" variant="outlined">
            현재 열린 운영 기간이 없습니다. 먼저 `월 운영` 화면에서 운영 기간을 시작해야
            수집 거래를 등록할 수 있습니다.
          </Alert>
        ) : (
          <Alert severity="info" variant="outlined">
            현재 수집 거래는 {currentPeriod.monthLabel} 운영 기간 안에서만 등록됩니다.
          </Alert>
        )}

        <Grid container spacing={appLayout.fieldGap}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="적요"
              error={Boolean(form.formState.errors.title)}
              helperText={form.formState.errors.title?.message}
              {...form.register('title')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              label="금액 (원)"
              type="number"
              error={Boolean(form.formState.errors.amountWon)}
              helperText={form.formState.errors.amountWon?.message}
              {...form.register('amountWon')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              label="거래일"
              type="date"
              disabled={!currentPeriod}
              error={Boolean(form.formState.errors.businessDate)}
              helperText={
                form.formState.errors.businessDate?.message ??
                (currentPeriod
                  ? `${currentPeriod.monthLabel} 운영 기간 범위 안에서만 선택할 수 있습니다.`
                  : '현재 열린 운영 기간이 없습니다.')
              }
              {...form.register('businessDate')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              select
              label="거래 성격"
              disabled={!currentPeriod}
              error={Boolean(form.formState.errors.type)}
              helperText={form.formState.errors.type?.message}
              {...form.register('type')}
            >
              <MenuItem value="EXPENSE">지출</MenuItem>
              <MenuItem value="INCOME">수입</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              select
              label="자금수단"
              disabled={!currentPeriod || fundingAccounts.length === 0}
              error={Boolean(form.formState.errors.accountId)}
              helperText={
                form.formState.errors.accountId?.message ??
                (fundingAccounts.length === 0
                  ? '사용할 수 있는 자금수단이 아직 없습니다.'
                  : ' ')
              }
              {...form.register('accountId')}
            >
              {fundingAccounts.map((fundingAccount) => (
                <MenuItem key={fundingAccount.id} value={fundingAccount.id}>
                  {fundingAccount.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              select
              label="카테고리"
              disabled={!currentPeriod || filteredCategories.length === 0}
              helperText={
                filteredCategories.length === 0
                  ? '선택한 거래 유형에 맞는 카테고리가 없습니다.'
                  : '선택 사항'
              }
              {...form.register('categoryId')}
            >
              <MenuItem value="">카테고리 없음</MenuItem>
              {filteredCategories.map((category) => (
                <MenuItem key={category.id} value={category.id}>
                  {category.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              label="메모"
              multiline
              minRows={3}
              error={Boolean(form.formState.errors.memo)}
              helperText={form.formState.errors.memo?.message ?? '선택 사항'}
              {...form.register('memo')}
            />
          </Grid>
        </Grid>
        <Button type="submit" variant="contained" disabled={isBusy} sx={{ alignSelf: 'flex-start' }}>
          {mutation.isPending ? '저장 중...' : '수집 거래 등록'}
        </Button>
      </Stack>
    </form>
  );
}

function resolveInitialBusinessDate(currentPeriod: AccountingPeriodItem | null): string {
  const today = getTodayDateInputValue();
  if (!currentPeriod) {
    return today;
  }

  if (isWithinPeriod(today, currentPeriod)) {
    return today;
  }

  return currentPeriod.startDate.slice(0, 10);
}

function isWithinPeriod(
  businessDate: string,
  currentPeriod: AccountingPeriodItem | null
): boolean {
  if (!currentPeriod) {
    return false;
  }

  const businessTime = Date.parse(`${businessDate}T00:00:00.000Z`);
  const startTime = Date.parse(currentPeriod.startDate);
  const endTime = Date.parse(currentPeriod.endDate);

  return businessTime >= startTime && businessTime < endTime;
}
