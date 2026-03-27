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
import { getAccounts, getCategories } from '@/features/reference-data/reference-data.api';
import { webRuntime } from '@/shared/config/env';
import { getTodayDateInputValue } from '@/shared/lib/date-input';
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
    .min(1, 'Day of month must be at least 1.')
    .max(31, 'Day of month must be 31 or less.')
    .optional()
);

const recurringRuleSchema = z.object({
  title: z.string().trim().min(2, 'Title must be at least 2 characters.'),
  accountId: z.string().min(1, 'Account is required.'),
  categoryId: z.string(),
  amountWon: z.coerce.number().int().positive('Amount must be greater than 0.'),
  frequency: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
  dayOfMonth: optionalDayOfMonthSchema,
  startDate: z.string().min(1, 'Start date is required.'),
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
  const { data: accounts = [], error: accountsError } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts
  });
  const { data: categories = [], error: categoriesError } = useQuery({
    queryKey: ['categories'],
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
    const firstAccount = accounts[0];
    if (!form.getValues('accountId') && firstAccount) {
      form.setValue('accountId', firstAccount.id, { shouldValidate: true });
    }
  }, [accounts, form]);

  const referenceError = accountsError ?? categoriesError;
  const isBusy =
    mutation.isPending ||
    form.formState.isSubmitting ||
    accounts.length === 0 ||
    Boolean(referenceError);

  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        setFeedback(null);

        const selectedAccount = accounts.find(
          (account) => account.id === values.accountId
        );
        if (!selectedAccount) {
          setFeedback({
            severity: 'error',
            message: 'Choose an account before saving the recurring rule.'
          });
          return;
        }

        const selectedCategory = categories.find(
          (category) => category.id === values.categoryId
        );
        const payload: CreateRecurringRuleRequest = {
          title: values.title.trim(),
          accountId: values.accountId,
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
              accountName: selectedAccount.name,
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
            message: 'Recurring rule saved and the schedule list was refreshed.'
          });
        } catch (error) {
          setFeedback({
            severity: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'Could not save the recurring rule.'
          });
        }
      })}
    >
      <Stack spacing={2.5}>
        {referenceError ? (
          <QueryErrorAlert
            title="Reference data request failed"
            error={referenceError}
          />
        ) : null}
        {feedback ? (
          <Alert severity={feedback.severity} variant="outlined">
            {feedback.message}
          </Alert>
        ) : null}

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="Title"
              error={Boolean(form.formState.errors.title)}
              helperText={form.formState.errors.title?.message}
              {...form.register('title')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              label="Amount (KRW)"
              type="number"
              error={Boolean(form.formState.errors.amountWon)}
              helperText={form.formState.errors.amountWon?.message}
              {...form.register('amountWon')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              select
              label="Frequency"
              error={Boolean(form.formState.errors.frequency)}
              helperText={form.formState.errors.frequency?.message}
              {...form.register('frequency')}
            >
              <MenuItem value="WEEKLY">Weekly</MenuItem>
              <MenuItem value="MONTHLY">Monthly</MenuItem>
              <MenuItem value="QUARTERLY">Quarterly</MenuItem>
              <MenuItem value="YEARLY">Yearly</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              select
              label="Account"
              disabled={accounts.length === 0}
              error={Boolean(form.formState.errors.accountId)}
              helperText={
                form.formState.errors.accountId?.message ??
                (accounts.length === 0 ? 'No accounts available yet.' : ' ')
              }
              {...form.register('accountId')}
            >
              {accounts.map((account) => (
                <MenuItem key={account.id} value={account.id}>
                  {account.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField select label="Category" helperText="Optional" {...form.register('categoryId')}>
              <MenuItem value="">No category</MenuItem>
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
              label="Status"
              helperText="Inactive rules stay visible but stop scheduling."
              {...form.register('status')}
            >
              <MenuItem value="ACTIVE">Active</MenuItem>
              <MenuItem value="PAUSED">Paused</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="Start Date"
              type="date"
              error={Boolean(form.formState.errors.startDate)}
              helperText={form.formState.errors.startDate?.message}
              {...form.register('startDate')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="End Date"
              type="date"
              helperText="Optional"
              {...form.register('endDate')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="Day of Month"
              type="number"
              error={Boolean(form.formState.errors.dayOfMonth)}
              helperText={
                form.formState.errors.dayOfMonth?.message ??
                'Optional. Useful for monthly billing cycles.'
              }
              {...form.register('dayOfMonth')}
            />
          </Grid>
        </Grid>
        <Button type="submit" variant="contained" disabled={isBusy} sx={{ alignSelf: 'flex-start' }}>
          {mutation.isPending ? 'Saving...' : 'Save Rule'}
        </Button>
      </Stack>
    </form>
  );
}
