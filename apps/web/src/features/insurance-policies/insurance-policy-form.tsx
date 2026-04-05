'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Grid, MenuItem, Stack, TextField } from '@mui/material';
import type {
  CreateInsurancePolicyRequest,
  InsurancePolicyItem,
  UpdateInsurancePolicyRequest
} from '@personal-erp/contracts';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { webRuntime } from '@/shared/config/env';
import { appLayout } from '@/shared/ui/layout-metrics';
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
    monthlyPremiumWon: z.coerce
      .number()
      .int()
      .positive('월 보험료는 0보다 커야 합니다.'),
    paymentDay: z.coerce
      .number()
      .int()
      .min(1, '납부일은 1 이상이어야 합니다.')
      .max(31, '납부일은 31 이하여야 합니다.'),
    cycle: z.enum(['MONTHLY', 'YEARLY']),
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
  const form = useForm<InsurancePolicyFormInput>({
    resolver: zodResolver(insurancePolicySchema),
    defaultValues: buildDefaultValues()
  });

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
        await queryClient.invalidateQueries({
          queryKey: insurancePoliciesQueryKey
        });
      }
    }
  });

  React.useEffect(() => {
    setFeedback(null);

    if (mode === 'edit' && initialPolicy) {
      form.reset(mapPolicyToFormInput(initialPolicy));
      return;
    }

    form.reset(buildDefaultValues());
  }, [form, initialPolicy, mode]);

  const isBusy = mutation.isPending || form.formState.isSubmitting;
  const submitLabel = mode === 'edit' ? '보험 계약 수정' : '보험 계약 저장';

  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        setFeedback(null);

        const payload: CreateInsurancePolicyRequest = {
          provider: values.provider.trim(),
          productName: values.productName.trim(),
          monthlyPremiumWon: values.monthlyPremiumWon,
          paymentDay: values.paymentDay,
          cycle: values.cycle,
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
              id: initialPolicy?.id
            })
          });

          if (onCompleted) {
            onCompleted(saved, mode);
            return;
          }

          if (mode === 'create') {
            form.reset({
              ...buildDefaultValues(),
              cycle: values.cycle,
              paymentDay: values.paymentDay,
              status: values.status
            });
          }

          setFeedback({
            severity: 'success',
            message:
              mode === 'edit'
                ? '보험 계약을 수정했고 목록을 새로고침했습니다.'
                : '보험 계약을 저장했고 목록을 새로고침했습니다.'
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
        {feedback ? (
          <Alert severity={feedback.severity} variant="outlined">
            {feedback.message}
          </Alert>
        ) : null}
        <Alert severity="info" variant="outlined">
          보험 계약은 운영 보조 데이터이며, 실제 회계 확정은 반복 규칙과 수집
          거래, 전표 흐름에서 이어집니다.
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
    renewalDate: insurancePolicy.renewalDate ?? '',
    maturityDate: insurancePolicy.maturityDate ?? '',
    status: insurancePolicy.isActive ? 'ACTIVE' : 'INACTIVE'
  };
}
