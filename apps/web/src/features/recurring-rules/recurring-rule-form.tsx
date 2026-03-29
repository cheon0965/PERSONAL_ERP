'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Grid, MenuItem, Stack, TextField } from '@mui/material';
import type {
  CreateRecurringRuleRequest,
  RecurringRuleItem
} from '@personal-erp/contracts';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  categoriesQueryKey,
  fundingAccountsQueryKey,
  getCategories,
  getFundingAccounts
} from '@/features/reference-data/reference-data.api';
import { webRuntime } from '@/shared/config/env';
import { getTodayDateInputValue } from '@/shared/lib/date-input';
import { appLayout } from '@/shared/ui/layout-metrics';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import {
  buildRecurringRuleFallbackItem,
  createRecurringRule,
  mergeRecurringRuleItem,
  recurringRulesQueryKey
} from './recurring-rules.api';

const optionalDayOfMonthSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.coerce
    .number()
    .int()
    .min(1, '일자는 1 이상이어야 합니다.')
    .max(31, '일자는 31 이하여야 합니다.')
    .optional()
);

const recurringRuleSchema = z.object({
  title: z.string().trim().min(2, '제목은 2자 이상이어야 합니다.'),
  accountId: z.string().min(1, '자금수단을 선택해 주세요.'),
  categoryId: z.string(),
  amountWon: z.coerce.number().int().positive('금액은 0보다 커야 합니다.'),
  frequency: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
  dayOfMonth: optionalDayOfMonthSchema,
  startDate: z.string().min(1, '시작일을 입력해 주세요.'),
  endDate: z.string(),
  status: z.enum(['ACTIVE', 'PAUSED'])
});

type RecurringRuleFormInput = z.infer<typeof recurringRuleSchema>;

type SubmitFeedback =
  | {
      severity: 'success' | 'error';
      message: string;
    }
  | null;

type CreateRecurringRuleMutationInput = {
  payload: CreateRecurringRuleRequest;
  fallback: RecurringRuleItem;
};

export function RecurringRuleForm() {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = React.useState<SubmitFeedback>(null);
  const { data: fundingAccounts = [], error: fundingAccountsError } = useQuery({
    queryKey: fundingAccountsQueryKey,
    queryFn: getFundingAccounts
  });
  const { data: categories = [], error: categoriesError } = useQuery({
    queryKey: categoriesQueryKey,
    queryFn: getCategories
  });
  const form = useForm<RecurringRuleFormInput>({
    resolver: zodResolver(recurringRuleSchema),
    defaultValues: {
      title: '',
      accountId: '',
      categoryId: '',
      amountWon: 0,
      frequency: 'MONTHLY',
      dayOfMonth: 10,
      startDate: getTodayDateInputValue(),
      endDate: '',
      status: 'ACTIVE'
    }
  });

  const mutation = useMutation({
    mutationFn: ({ payload, fallback }: CreateRecurringRuleMutationInput) =>
      createRecurringRule(payload, fallback),
    onSuccess: async (created) => {
      queryClient.setQueryData<RecurringRuleItem[]>(
        recurringRulesQueryKey,
        (current) => mergeRecurringRuleItem(current, created)
      );

      if (!webRuntime.demoFallbackEnabled) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: recurringRulesQueryKey }),
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

  const referenceError = fundingAccountsError ?? categoriesError;
  const isBusy =
    mutation.isPending ||
    form.formState.isSubmitting ||
    fundingAccounts.length === 0 ||
    Boolean(referenceError);

  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        setFeedback(null);

        const selectedFundingAccount = fundingAccounts.find(
          (fundingAccount) => fundingAccount.id === values.accountId
        );
        if (!selectedFundingAccount) {
          setFeedback({
            severity: 'error',
            message: '반복 규칙을 저장하기 전에 자금수단을 선택해 주세요.'
          });
          return;
        }

        const selectedCategory = categories.find(
          (category) => category.id === values.categoryId
        );
        const payload: CreateRecurringRuleRequest = {
          title: values.title.trim(),
          fundingAccountId: values.accountId,
          categoryId: values.categoryId || undefined,
          amountWon: values.amountWon,
          frequency: values.frequency,
          dayOfMonth: values.dayOfMonth,
          startDate: values.startDate,
          endDate: values.endDate || undefined,
          isActive: values.status === 'ACTIVE'
        };

        try {
          await mutation.mutateAsync({
            payload,
            fallback: buildRecurringRuleFallbackItem(payload, {
              fundingAccountName: selectedFundingAccount.name,
              categoryName: selectedCategory?.name
            })
          });

          form.reset({
            title: '',
            accountId: values.accountId,
            categoryId: '',
            amountWon: 0,
            frequency: values.frequency,
            dayOfMonth: values.dayOfMonth,
            startDate: getTodayDateInputValue(),
            endDate: '',
            status: values.status
          });
          setFeedback({
            severity: 'success',
            message: '반복 규칙을 저장했고 계획 기준 목록을 새로고침했습니다.'
          });
        } catch (error) {
          setFeedback({
            severity: 'error',
            message:
              error instanceof Error
                ? error.message
                : '반복 규칙을 저장하지 못했습니다.'
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

        <Grid container spacing={appLayout.fieldGap}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="규칙명"
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
              select
              label="주기"
              error={Boolean(form.formState.errors.frequency)}
              helperText={form.formState.errors.frequency?.message}
              {...form.register('frequency')}
            >
              <MenuItem value="WEEKLY">매주</MenuItem>
              <MenuItem value="MONTHLY">매월</MenuItem>
              <MenuItem value="QUARTERLY">분기</MenuItem>
              <MenuItem value="YEARLY">매년</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              select
              label="자금수단"
              disabled={fundingAccounts.length === 0}
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
            <TextField select label="카테고리" helperText="선택 사항" {...form.register('categoryId')}>
              <MenuItem value="">카테고리 없음</MenuItem>
              {categories.map((category) => (
                <MenuItem key={category.id} value={category.id}>
                  {category.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              select
              label="상태"
              helperText="중지한 규칙도 목록에는 남아 있지만 더 이상 계획 항목을 생성하지 않습니다."
              {...form.register('status')}
            >
              <MenuItem value="ACTIVE">활성</MenuItem>
              <MenuItem value="PAUSED">일시중지</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="시작일"
              type="date"
              error={Boolean(form.formState.errors.startDate)}
              helperText={form.formState.errors.startDate?.message}
              {...form.register('startDate')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="종료일"
              type="date"
              helperText="선택 사항"
              {...form.register('endDate')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="기준 일자"
              type="number"
              error={Boolean(form.formState.errors.dayOfMonth)}
              helperText={
                form.formState.errors.dayOfMonth?.message ??
                '선택 사항입니다. 매월 계획 생성 기준일이 필요한 규칙에 유용합니다.'
              }
              {...form.register('dayOfMonth')}
            />
          </Grid>
        </Grid>
        <Button type="submit" variant="contained" disabled={isBusy} sx={{ alignSelf: 'flex-start' }}>
          {mutation.isPending ? '저장 중...' : '반복 규칙 저장'}
        </Button>
      </Stack>
    </form>
  );
}
