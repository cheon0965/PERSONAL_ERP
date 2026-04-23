'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Stack } from '@mui/material';
import type { UpdateRecurringRuleRequest } from '@personal-erp/contracts';
import { useForm } from 'react-hook-form';
import {
  categoriesManagementQueryKey,
  categoriesQueryKey,
  fundingAccountsManagementQueryKey,
  fundingAccountsQueryKey,
  getCategories,
  getFundingAccounts
} from '@/features/reference-data/reference-data.api';
import { webRuntime } from '@/shared/config/env';
import { useAppNotification } from '@/shared/providers/notification-provider';
import { FeedbackAlert } from '@/shared/ui/feedback-alert';
import { appLayout } from '@/shared/ui/layout-metrics';
import {
  buildRecurringRuleFallbackItem,
  createRecurringRule,
  type ManagedRecurringRuleDetailItem,
  type ManagedRecurringRuleItem,
  mergeRecurringRuleItem,
  recurringRuleDetailQueryKey,
  recurringRulesQueryKey,
  updateRecurringRule
} from './recurring-rules.api';
import {
  buildCreateResetValues,
  buildDefaultValues,
  isVisibleCategory,
  isVisibleFundingAccount,
  mapDetailToFormInput,
  type RecurringRuleFormInput,
  recurringRuleSchema
} from './recurring-rule-form.model';
import {
  RecurringRuleFieldGrid,
  RecurringRuleReferenceAlerts
} from './recurring-rule-form.sections';

type RecurringRuleFormMode = 'create' | 'edit';

type SubmitFeedback = {
  severity: 'success' | 'error';
  message: string;
} | null;

type SaveRecurringRuleMutationInput = {
  mode: RecurringRuleFormMode;
  recurringRuleId?: string;
  payload: UpdateRecurringRuleRequest;
  fallback: ManagedRecurringRuleItem;
};

type RecurringRuleFormProps = {
  mode?: RecurringRuleFormMode;
  initialRule?: ManagedRecurringRuleDetailItem | null;
  onCompleted?: (
    recurringRule: ManagedRecurringRuleItem,
    mode: RecurringRuleFormMode
  ) => void;
};

export function RecurringRuleForm({
  mode = 'create',
  initialRule = null,
  onCompleted
}: RecurringRuleFormProps) {
  const queryClient = useQueryClient();
  const { notifySuccess } = useAppNotification();
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
    defaultValues: buildDefaultValues()
  });
  const selectedFundingAccountId = form.watch('accountId');
  const selectedCategoryId = form.watch('categoryId');
  const availableFundingAccounts = React.useMemo(
    () =>
      fundingAccounts.filter((fundingAccount) =>
        isVisibleFundingAccount(fundingAccount, selectedFundingAccountId)
      ),
    [fundingAccounts, selectedFundingAccountId]
  );
  const filteredCategories = React.useMemo(
    () =>
      categories.filter((category) =>
        isVisibleCategory(category, selectedCategoryId)
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
      queryClient.setQueryData<ManagedRecurringRuleItem[]>(
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

    form.reset(buildDefaultValues());
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
              isActive: payload.isActive,
              linkedInsurancePolicyId: initialRule?.linkedInsurancePolicyId
            })
          });

          if (onCompleted) {
            onCompleted(saved, mode);
            return;
          }

          if (mode === 'create') {
            form.reset(buildCreateResetValues(values));
          }

          notifySuccess(
            mode === 'edit'
              ? '반복 규칙을 수정했고 계획 기준 목록을 새로고침했습니다.'
              : '반복 규칙을 저장했고 계획 기준 목록을 새로고침했습니다.'
          );
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
        <RecurringRuleReferenceAlerts
          mode={mode}
          referenceError={referenceError}
        />
        <RecurringRuleFieldGrid
          availableFundingAccounts={availableFundingAccounts}
          filteredCategories={filteredCategories}
          form={form}
        />
        <FeedbackAlert feedback={feedback} />
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
