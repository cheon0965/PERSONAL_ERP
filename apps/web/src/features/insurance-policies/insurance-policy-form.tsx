'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Grid, MenuItem, Stack, TextField } from '@mui/material';
import type {
  CreateInsurancePolicyRequest,
  FundingAccountItem,
  InsurancePolicyItem,
  UpdateInsurancePolicyRequest
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
import { createPositiveMoneyWonSchema } from '@/shared/lib/money';
import { appLayout } from '@/shared/ui/layout-metrics';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import {
  buildInsurancePolicyFallbackItem,
  createInsurancePolicy,
  insurancePoliciesQueryKey,
  mergeInsurancePolicyItem,
  updateInsurancePolicy
} from './insurance-policies.api';

const insurancePolicySchema = z
  .object({
    provider: z.string().trim().min(2, '보험사 이름은 2자 이상이어야 합니다.'),
    productName: z.string().trim().min(2, '상품명은 2자 이상이어야 합니다.'),
    monthlyPremiumWon: createPositiveMoneyWonSchema(
      '월 보험료는 0보다 커야 합니다.'
    ),
    paymentDay: z.coerce
      .number()
      .int()
      .min(1, '납부일은 1 이상이어야 합니다.')
      .max(31, '납부일은 31 이하여야 합니다.'),
    cycle: z.enum(['MONTHLY', 'YEARLY']),
    fundingAccountId: z.string().min(1, '자금수단을 선택해 주세요.'),
    categoryId: z.string().min(1, '카테고리를 선택해 주세요.'),
    recurringStartDate: z.string().min(1, '반복 시작일을 입력해 주세요.'),
    renewalDate: z.string(),
    maturityDate: z.string(),
    status: z.enum(['ACTIVE', 'INACTIVE'])
  })
  .superRefine((value, context) => {
    if (
      value.renewalDate &&
      value.maturityDate &&
      value.maturityDate < value.renewalDate
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maturityDate'],
        message: '만기일은 갱신일보다 빠를 수 없습니다.'
      });
    }

    if (
      value.recurringStartDate &&
      readDateInputDay(value.recurringStartDate) !== value.paymentDay
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['recurringStartDate'],
        message: '반복 시작일의 날짜는 납부일과 같아야 합니다.'
      });
    }

    if (
      value.recurringStartDate &&
      value.maturityDate &&
      value.maturityDate < value.recurringStartDate
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maturityDate'],
        message: '만기일은 반복 시작일보다 빠를 수 없습니다.'
      });
    }
  });

type InsurancePolicyFormInput = z.infer<typeof insurancePolicySchema>;
type InsurancePolicyFormMode = 'create' | 'edit';

type SubmitFeedback = {
  severity: 'success' | 'error';
  message: string;
} | null;

type SaveInsurancePolicyMutationInput = {
  mode: InsurancePolicyFormMode;
  insurancePolicyId?: string;
  payload: UpdateInsurancePolicyRequest;
  fallback: InsurancePolicyItem;
};

type InsurancePolicyFormProps = {
  mode?: InsurancePolicyFormMode;
  initialPolicy?: InsurancePolicyItem | null;
  onCompleted?: (
    insurancePolicy: InsurancePolicyItem,
    mode: InsurancePolicyFormMode
  ) => void;
};

export function InsurancePolicyForm({
  mode = 'create',
  initialPolicy = null,
  onCompleted
}: InsurancePolicyFormProps) {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = React.useState<SubmitFeedback>(null);
  const includeInactiveFundingAccounts =
    mode === 'edit' && Boolean(initialPolicy?.fundingAccountId);
  const includeInactiveCategories =
    mode === 'edit' && Boolean(initialPolicy?.categoryId);
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
  const form = useForm<InsurancePolicyFormInput>({
    resolver: zodResolver(insurancePolicySchema),
    defaultValues: buildDefaultValues()
  });
  const selectedFundingAccountId = form.watch('fundingAccountId');
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
  const availableCategories = React.useMemo(
    () =>
      categories.filter(
        (category) =>
          category.kind === 'EXPENSE' &&
          (category.isActive || category.id === selectedCategoryId)
      ),
    [categories, selectedCategoryId]
  );

  const mutation = useMutation({
    mutationFn: ({
      mode: nextMode,
      insurancePolicyId,
      payload,
      fallback
    }: SaveInsurancePolicyMutationInput) => {
      if (nextMode === 'edit' && insurancePolicyId) {
        return updateInsurancePolicy(insurancePolicyId, payload, fallback);
      }

      return createInsurancePolicy(payload, fallback);
    },
    onSuccess: async (saved) => {
      queryClient.setQueryData<InsurancePolicyItem[]>(
        insurancePoliciesQueryKey,
        (current) => mergeInsurancePolicyItem(current, saved)
      );

      if (!webRuntime.demoFallbackEnabled) {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: insurancePoliciesQueryKey
          }),
          queryClient.invalidateQueries({
            queryKey: ['recurring-rules']
          }),
          queryClient.invalidateQueries({
            queryKey: ['dashboard-summary']
          })
        ]);
      }
    }
  });

  React.useEffect(() => {
    if (!form.getValues('fundingAccountId') && availableFundingAccounts[0]) {
      form.setValue('fundingAccountId', availableFundingAccounts[0].id, {
        shouldValidate: true
      });
    }
  }, [availableFundingAccounts, form]);

  React.useEffect(() => {
    if (!form.getValues('categoryId') && availableCategories[0]) {
      form.setValue('categoryId', availableCategories[0].id, {
        shouldValidate: true
      });
    }
  }, [availableCategories, form]);

  React.useEffect(() => {
    setFeedback(null);

    if (mode === 'edit' && initialPolicy) {
      form.reset(mapPolicyToFormInput(initialPolicy));
      return;
    }

    form.reset(buildDefaultValues());
  }, [form, initialPolicy, mode]);

  const referenceError = fundingAccountsError ?? categoriesError;
  const isBusy =
    mutation.isPending ||
    form.formState.isSubmitting ||
    availableFundingAccounts.length === 0 ||
    availableCategories.length === 0 ||
    Boolean(referenceError);
  const submitLabel = mode === 'edit' ? '보험 계약 수정' : '보험 계약 저장';

  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        setFeedback(null);

        const selectedFundingAccount = availableFundingAccounts.find(
          (fundingAccount) => fundingAccount.id === values.fundingAccountId
        );
        if (!selectedFundingAccount) {
          setFeedback({
            severity: 'error',
            message: '반복 규칙에 사용할 자금수단을 선택해 주세요.'
          });
          return;
        }

        const selectedCategory = availableCategories.find(
          (category) => category.id === values.categoryId
        );
        if (!selectedCategory) {
          setFeedback({
            severity: 'error',
            message: '반복 규칙에 사용할 지출 카테고리를 선택해 주세요.'
          });
          return;
        }

        const payload: CreateInsurancePolicyRequest = {
          provider: values.provider.trim(),
          productName: values.productName.trim(),
          monthlyPremiumWon: values.monthlyPremiumWon,
          paymentDay: values.paymentDay,
          cycle: values.cycle,
          fundingAccountId: values.fundingAccountId,
          categoryId: values.categoryId,
          recurringStartDate: values.recurringStartDate,
          renewalDate: values.renewalDate || null,
          maturityDate: values.maturityDate || null,
          isActive: values.status === 'ACTIVE'
        };

        try {
          const saved = await mutation.mutateAsync({
            mode,
            insurancePolicyId: initialPolicy?.id,
            payload,
            fallback: buildInsurancePolicyFallbackItem(payload, {
              id: initialPolicy?.id,
              fundingAccountName: selectedFundingAccount.name,
              categoryName: selectedCategory.name,
              linkedRecurringRuleId: initialPolicy?.linkedRecurringRuleId
            })
          });

          if (onCompleted) {
            onCompleted(saved, mode);
            return;
          }

          if (mode === 'create') {
            form.reset({
              ...buildDefaultValues(),
              paymentDay: values.paymentDay,
              cycle: values.cycle,
              fundingAccountId: values.fundingAccountId,
              categoryId: values.categoryId,
              recurringStartDate: buildSuggestedRecurringStartDate(
                values.paymentDay
              ),
              status: values.status
            });
          }

          setFeedback({
            severity: 'success',
            message:
              mode === 'edit'
                ? '보험 계약과 연결된 반복 규칙을 함께 수정했습니다.'
                : '보험 계약과 연결된 반복 규칙을 함께 저장했습니다.'
          });
        } catch (error) {
          setFeedback({
            severity: 'error',
            message:
              error instanceof Error
                ? error.message
                : mode === 'edit'
                  ? '보험 계약을 수정하지 못했습니다.'
                  : '보험 계약을 저장하지 못했습니다.'
          });
        }
      })}
    >
      <Stack spacing={appLayout.cardGap}>
        {referenceError ? (
          <QueryErrorAlert
            title="보험 계약 반복 규칙 기준 조회에 실패했습니다."
            error={referenceError}
          />
        ) : null}
        {feedback ? (
          <Alert severity={feedback.severity} variant="outlined">
            {feedback.message}
          </Alert>
        ) : null}
        <Alert severity="info" variant="outlined">
          보험 계약을 저장하면 연결된 반복 규칙이 함께 생성되거나 갱신됩니다.
          실제 회계 확정은 이후 수집 거래와 전표 흐름에서 이어집니다.
        </Alert>

        <Grid container spacing={appLayout.fieldGap}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="보험사"
              error={Boolean(form.formState.errors.provider)}
              helperText={form.formState.errors.provider?.message}
              {...form.register('provider')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <TextField
              label="상품명"
              error={Boolean(form.formState.errors.productName)}
              helperText={form.formState.errors.productName?.message}
              {...form.register('productName')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              label="월 보험료 (원)"
              type="number"
              error={Boolean(form.formState.errors.monthlyPremiumWon)}
              helperText={form.formState.errors.monthlyPremiumWon?.message}
              {...form.register('monthlyPremiumWon')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              label="납부일"
              type="number"
              error={Boolean(form.formState.errors.paymentDay)}
              helperText={form.formState.errors.paymentDay?.message}
              {...form.register('paymentDay')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Controller
              control={form.control}
              name="cycle"
              render={({ field }) => (
                <TextField
                  select
                  label="주기"
                  error={Boolean(form.formState.errors.cycle)}
                  helperText={form.formState.errors.cycle?.message}
                  name={field.name}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                  inputRef={field.ref}
                >
                  <MenuItem value="MONTHLY">매월</MenuItem>
                  <MenuItem value="YEARLY">매년</MenuItem>
                </TextField>
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <TextField
                  select
                  label="상태"
                  name={field.name}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                  inputRef={field.ref}
                >
                  <MenuItem value="ACTIVE">활성</MenuItem>
                  <MenuItem value="INACTIVE">비활성</MenuItem>
                </TextField>
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Controller
              control={form.control}
              name="fundingAccountId"
              render={({ field }) => (
                <TextField
                  select
                  label="자금수단"
                  disabled={availableFundingAccounts.length === 0}
                  error={Boolean(form.formState.errors.fundingAccountId)}
                  helperText={
                    form.formState.errors.fundingAccountId?.message ??
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
          <Grid size={{ xs: 12, md: 6 }}>
            <Controller
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <TextField
                  select
                  label="지출 카테고리"
                  disabled={availableCategories.length === 0}
                  error={Boolean(form.formState.errors.categoryId)}
                  helperText={
                    form.formState.errors.categoryId?.message ??
                    (availableCategories.length === 0
                      ? '사용할 수 있는 지출 카테고리가 아직 없습니다.'
                      : ' ')
                  }
                  name={field.name}
                  value={field.value ?? ''}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                  inputRef={field.ref}
                >
                  {availableCategories.map((category) => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="반복 시작일"
              type="date"
              helperText={
                form.formState.errors.recurringStartDate?.message ??
                '납부일과 같은 날짜로 첫 반복 기준일을 지정합니다.'
              }
              error={Boolean(form.formState.errors.recurringStartDate)}
              {...form.register('recurringStartDate')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="갱신일"
              type="date"
              helperText="선택 사항"
              error={Boolean(form.formState.errors.renewalDate)}
              {...form.register('renewalDate')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="만기일"
              type="date"
              helperText={
                form.formState.errors.maturityDate?.message ?? '선택 사항'
              }
              error={Boolean(form.formState.errors.maturityDate)}
              {...form.register('maturityDate')}
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

function buildDefaultValues(): InsurancePolicyFormInput {
  return {
    provider: '',
    productName: '',
    monthlyPremiumWon: 0,
    paymentDay: 25,
    cycle: 'MONTHLY',
    fundingAccountId: '',
    categoryId: '',
    recurringStartDate: buildSuggestedRecurringStartDate(25),
    renewalDate: '',
    maturityDate: '',
    status: 'ACTIVE'
  };
}

function mapPolicyToFormInput(
  insurancePolicy: InsurancePolicyItem
): InsurancePolicyFormInput {
  return {
    provider: insurancePolicy.provider,
    productName: insurancePolicy.productName,
    monthlyPremiumWon: insurancePolicy.monthlyPremiumWon,
    paymentDay: insurancePolicy.paymentDay,
    cycle: insurancePolicy.cycle,
    fundingAccountId: insurancePolicy.fundingAccountId ?? '',
    categoryId: insurancePolicy.categoryId ?? '',
    recurringStartDate:
      insurancePolicy.recurringStartDate ??
      buildSuggestedRecurringStartDate(insurancePolicy.paymentDay),
    renewalDate: insurancePolicy.renewalDate ?? '',
    maturityDate: insurancePolicy.maturityDate ?? '',
    status: insurancePolicy.isActive ? 'ACTIVE' : 'INACTIVE'
  };
}

function buildSuggestedRecurringStartDate(paymentDay: number) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const currentMonthCandidate = new Date(year, month, paymentDay);
  const candidate =
    currentMonthCandidate >= stripTime(today)
      ? currentMonthCandidate
      : new Date(year, month + 1, paymentDay);

  return [
    candidate.getFullYear(),
    String(candidate.getMonth() + 1).padStart(2, '0'),
    String(candidate.getDate()).padStart(2, '0')
  ].join('-');
}

function stripTime(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function readDateInputDay(value: string) {
  const day = Number(value.slice(8, 10));

  return Number.isNaN(day) ? null : day;
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
