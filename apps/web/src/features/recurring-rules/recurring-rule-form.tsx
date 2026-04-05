'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Grid, MenuItem, Stack, TextField } from '@mui/material';
import type {
  FundingAccountItem,
  RecurringRuleDetailItem,
  RecurringRuleItem,
  UpdateRecurringRuleRequest
} from '@personal-erp/contracts';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  categoriesManagementQueryKey,
  categoriesQueryKey,
  fundingAccountsManagementQueryKey,
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
  recurringRuleDetailQueryKey,
  recurringRulesQueryKey,
  updateRecurringRule
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
type RecurringRuleFormMode = 'create' | 'edit';

type SubmitFeedback = {
  severity: 'success' | 'error';
  message: string;
} | null;

type SaveRecurringRuleMutationInput = {
  mode: RecurringRuleFormMode;
  recurringRuleId?: string;
  payload: UpdateRecurringRuleRequest;
  fallback: RecurringRuleItem;
};

type RecurringRuleFormProps = {
  mode?: RecurringRuleFormMode;
  initialRule?: RecurringRuleDetailItem | null;
  onCompleted?: (
    recurringRule: RecurringRuleItem,
    mode: RecurringRuleFormMode
  ) => void;
};

export function RecurringRuleForm({
  mode = 'create',
  initialRule = null,
  onCompleted
}: RecurringRuleFormProps) {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = React.useState<SubmitFeedback>(null);
  const includeInactiveCategories =
    mode === 'edit' && Boolean(initialRule?.categoryId);
  const includeInactiveFundingAccounts =
    mode === 'edit' && Boolean(initialRule?.fundingAccountId);
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
          category.isActive || category.id === selectedCategoryId
      ),
    [categories, selectedCategoryId]
  );

  const mutation = useMutation({
    mutationFn: ({
      mode: nextMode,
      recurringRuleId,
      payload,
      fallback
    }: SaveRecurringRuleMutationInput) => {
      if (nextMode === 'edit' && recurringRuleId) {
        return updateRecurringRule(recurringRuleId, payload, fallback);
      }

      return createRecurringRule(payload, fallback);
    },
    onSuccess: async (saved, variables) => {
      queryClient.setQueryData<RecurringRuleItem[]>(
        recurringRulesQueryKey,
        (current) => mergeRecurringRuleItem(current, saved)
      );

      if (!webRuntime.demoFallbackEnabled) {
        const invalidations = [
          queryClient.invalidateQueries({ queryKey: recurringRulesQueryKey }),
          queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
        ];

        if (variables.mode === 'edit' && variables.recurringRuleId) {
          invalidations.push(
            queryClient.invalidateQueries({
              queryKey: recurringRuleDetailQueryKey(variables.recurringRuleId)
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
    setFeedback(null);

    if (mode === 'edit' && initialRule) {
      form.reset(mapDetailToFormInput(initialRule));
      return;
    }

    form.reset({
      title: '',
      accountId: '',
      categoryId: '',
      amountWon: 0,
      frequency: 'MONTHLY',
      dayOfMonth: 10,
      startDate: getTodayDateInputValue(),
      endDate: '',
      status: 'ACTIVE'
    });
  }, [form, initialRule, mode]);

  const referenceError = fundingAccountsError ?? categoriesError;
  const isBusy =
    mutation.isPending ||
    form.formState.isSubmitting ||
    availableFundingAccounts.length === 0 ||
    Boolean(referenceError) ||
    (mode === 'edit' && !initialRule);
  const submitLabel = mode === 'edit' ? '반복 규칙 수정' : '반복 규칙 저장';

  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        setFeedback(null);

        if (mode === 'edit' && !initialRule) {
          setFeedback({
            severity: 'error',
            message: '수정할 반복 규칙 상세 정보를 아직 불러오지 못했습니다.'
          });
          return;
        }

        const selectedFundingAccount = availableFundingAccounts.find(
          (fundingAccount) => fundingAccount.id === values.accountId
        );
        if (!selectedFundingAccount) {
          setFeedback({
            severity: 'error',
            message: '반복 규칙을 저장하기 전에 자금수단을 선택해 주세요.'
          });
          return;
        }

        const selectedCategory = filteredCategories.find(
          (category) => category.id === values.categoryId
        );
        const payload: UpdateRecurringRuleRequest = {
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
          const saved = await mutation.mutateAsync({
            mode,
            recurringRuleId: initialRule?.id,
            payload,
            fallback: buildRecurringRuleFallbackItem(payload, {
              id: initialRule?.id,
              fundingAccountName: selectedFundingAccount.name,
              categoryName: selectedCategory?.name,
              nextRunDate: initialRule?.nextRunDate ?? payload.startDate,
              isActive: payload.isActive
            })
          });

          if (onCompleted) {
            onCompleted(saved, mode);
            return;
          }

          if (mode === 'create') {
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
          }

          setFeedback({
            severity: 'success',
            message:
              mode === 'edit'
                ? '반복 규칙을 수정했고 계획 기준 목록을 새로고침했습니다.'
                : '반복 규칙을 저장했고 계획 기준 목록을 새로고침했습니다.'
          });
        } catch (error) {
          setFeedback({
            severity: 'error',
            message:
              error instanceof Error
                ? error.message
                : mode === 'edit'
                  ? '반복 규칙을 수정하지 못했습니다.'
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
        <Alert severity="info" variant="outlined">
          {mode === 'edit'
            ? '기존 반복 규칙 기준을 수정하면 이후 계획 생성 기준이 함께 바뀝니다.'
            : '반복 규칙은 계획 항목 생성 기준이며, 실제 수집 거래나 전표를 직접 만들지는 않습니다.'}
        </Alert>

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
            <Controller
              control={form.control}
              name="frequency"
              render={({ field }) => (
                <TextField
                  select
                  label="주기"
                  error={Boolean(form.formState.errors.frequency)}
                  helperText={form.formState.errors.frequency?.message}
                  name={field.name}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                  inputRef={field.ref}
                >
                  <MenuItem value="WEEKLY">매주</MenuItem>
                  <MenuItem value="MONTHLY">매월</MenuItem>
                  <MenuItem value="QUARTERLY">분기</MenuItem>
                  <MenuItem value="YEARLY">매년</MenuItem>
                </TextField>
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Controller
              control={form.control}
              name="accountId"
              render={({ field }) => (
                <TextField
                  select
                  label="자금수단"
                  disabled={availableFundingAccounts.length === 0}
                  error={Boolean(form.formState.errors.accountId)}
                  helperText={
                    form.formState.errors.accountId?.message ??
                    (availableFundingAccounts.length === 0
                      ? '사용할 수 있는 자금수단이 아직 없습니다.'
                      : ' ')
                  }
                  name={field.name}
                  value={field.value ?? ''}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                  inputRef={field.ref}
                >
                  {availableFundingAccounts.map((fundingAccount) => (
                    <MenuItem key={fundingAccount.id} value={fundingAccount.id}>
                      {readFundingAccountOptionLabel(fundingAccount)}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Controller
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <TextField
                  select
                  label="카테고리"
                  helperText="선택 사항"
                  name={field.name}
                  value={field.value ?? ''}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                  inputRef={field.ref}
                >
                  <MenuItem value="">카테고리 없음</MenuItem>
                  {filteredCategories.map((category) => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <TextField
                  select
                  label="상태"
                  helperText="중지한 규칙도 목록에는 남아 있지만 더 이상 계획 항목을 생성하지 않습니다."
                  name={field.name}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                  inputRef={field.ref}
                >
                  <MenuItem value="ACTIVE">활성</MenuItem>
                  <MenuItem value="PAUSED">일시중지</MenuItem>
                </TextField>
              )}
            />
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
            <Controller
              control={form.control}
              name="dayOfMonth"
              render={({ field }) => (
                <TextField
                  label="기준 일자"
                  type="number"
                  error={Boolean(form.formState.errors.dayOfMonth)}
                  helperText={
                    form.formState.errors.dayOfMonth?.message ??
                    '선택 사항입니다. 매월 계획 생성 기준일이 필요한 규칙에 유용합니다.'
                  }
                  name={field.name}
                  value={field.value ?? ''}
                  onBlur={field.onBlur}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    field.onChange(
                      nextValue === '' ? undefined : Number(nextValue)
                    );
                  }}
                  inputRef={field.ref}
                />
              )}
            />
          </Grid>
        </Grid>
        <Button
          type="submit"
          variant="contained"
          disabled={isBusy}
          sx={{ alignSelf: 'flex-start' }}
        >
          {mutation.isPending ? '저장 중...' : submitLabel}
        </Button>
      </Stack>
    </form>
  );
}

function mapDetailToFormInput(
  recurringRule: RecurringRuleDetailItem
): RecurringRuleFormInput {
  return {
    title: recurringRule.title,
    accountId: recurringRule.fundingAccountId,
    categoryId: recurringRule.categoryId ?? '',
    amountWon: recurringRule.amountWon,
    frequency: recurringRule.frequency,
    dayOfMonth: recurringRule.dayOfMonth ?? undefined,
    startDate: recurringRule.startDate,
    endDate: recurringRule.endDate ?? '',
    status: recurringRule.isActive ? 'ACTIVE' : 'PAUSED'
  };
}

function readFundingAccountOptionLabel(fundingAccount: FundingAccountItem) {
  switch (fundingAccount.status) {
    case 'INACTIVE':
      return `${fundingAccount.name} (비활성)`;
    case 'CLOSED':
      return `${fundingAccount.name} (종료)`;
    default:
      return fundingAccount.name;
  }
}
