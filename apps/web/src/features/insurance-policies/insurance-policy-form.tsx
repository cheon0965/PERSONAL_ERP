'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Stack } from '@mui/material';
import type {
  CreateInsurancePolicyRequest,
  InsurancePolicyItem,
  UpdateInsurancePolicyRequest
} from '@personal-erp/contracts';
import { useForm } from 'react-hook-form';
import {
  categoriesManagementQueryKey,
  categoriesQueryKey,
  fundingAccountsManagementQueryKey,
  fundingAccountsQueryKey,
  getCategories,
  getFundingAccounts
} from '@/features/reference-data/reference-data.api';
import { buildErrorFeedback } from '@/shared/api/fetch-json';
import { webRuntime } from '@/shared/config/env';
import { useAppNotification } from '@/shared/providers/notification-provider';
import {
  FeedbackAlert,
  type FeedbackAlertValue
} from '@/shared/ui/feedback-alert';
import { appLayout } from '@/shared/ui/layout-metrics';
import {
  buildInsurancePolicyFallbackItem,
  createInsurancePolicy,
  insurancePoliciesQueryKey,
  mergeInsurancePolicyItem,
  updateInsurancePolicy
} from './insurance-policies.api';
import {
  buildDefaultValues,
  buildSuggestedRecurringStartDate,
  type InsurancePolicyFormInput,
  insurancePolicySchema,
  mapPolicyToFormInput
} from './insurance-policy-form.model';
import {
  InsurancePolicyFieldGrid,
  InsurancePolicyReferenceAlerts
} from './insurance-policy-form.sections';

type InsurancePolicyFormMode = 'create' | 'edit';

type SubmitFeedback = FeedbackAlertValue;

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
  const { notifySuccess } = useAppNotification();
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

          notifySuccess(
            mode === 'edit'
              ? '보험 계약과 연결된 반복 규칙을 함께 수정했습니다.'
              : '보험 계약과 연결된 반복 규칙을 함께 저장했습니다.'
          );
        } catch (error) {
          setFeedback(
            buildErrorFeedback(
              error,
              mode === 'edit'
                ? '보험 계약을 수정하지 못했습니다.'
                : '보험 계약을 저장하지 못했습니다.'
            )
          );
        }
      })}
    >
      <Stack spacing={appLayout.cardGap}>
        <InsurancePolicyReferenceAlerts referenceError={referenceError} />

        <InsurancePolicyFieldGrid
          form={form}
          availableFundingAccounts={availableFundingAccounts}
          availableCategories={availableCategories}
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
