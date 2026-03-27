'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Grid, MenuItem, Stack, TextField } from '@mui/material';
import type {
  CreateTransactionRequest,
  TransactionItem
} from '@personal-erp/contracts';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { getAccounts, getCategories } from '@/features/reference-data/reference-data.api';
import { webRuntime } from '@/shared/config/env';
import { getTodayDateInputValue } from '@/shared/lib/date-input';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import {
  buildTransactionFallbackItem,
  createTransaction,
  mergeTransactionItem,
  transactionsQueryKey
} from './transactions.api';

const transactionSchema = z.object({
  title: z.string().trim().min(2, 'Title must be at least 2 characters.'),
  amountWon: z.coerce.number().int().positive('Amount must be greater than 0.'),
  businessDate: z.string().min(1, 'Business date is required.'),
  type: z.enum(['INCOME', 'EXPENSE']),
  accountId: z.string().min(1, 'Account is required.'),
  categoryId: z.string(),
  memo: z.string().max(500, 'Memo must be 500 characters or fewer.')
});

type TransactionFormInput = z.infer<typeof transactionSchema>;

type SubmitFeedback =
  | {
      severity: 'success' | 'error';
      message: string;
    }
  | null;

type CreateTransactionMutationInput = {
  payload: CreateTransactionRequest;
  fallback: TransactionItem;
};

export function TransactionForm() {
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
  const form = useForm<TransactionFormInput>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      title: '',
      amountWon: 0,
      businessDate: getTodayDateInputValue(),
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
      createTransaction(payload, fallback),
    onSuccess: async (created) => {
      queryClient.setQueryData<TransactionItem[]>(
        transactionsQueryKey,
        (current) => mergeTransactionItem(current, created)
      );

      if (!webRuntime.demoFallbackEnabled) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: transactionsQueryKey }),
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

  React.useEffect(() => {
    const selectedCategoryId = form.getValues('categoryId');
    if (
      selectedCategoryId &&
      !filteredCategories.some((category) => category.id === selectedCategoryId)
    ) {
      form.setValue('categoryId', '');
    }
  }, [filteredCategories, form]);

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
            message: 'Choose an account before saving the transaction.'
          });
          return;
        }

        const selectedCategory = filteredCategories.find(
          (category) => category.id === values.categoryId
        );
        const payload: CreateTransactionRequest = {
          title: values.title.trim(),
          type: values.type,
          amountWon: values.amountWon,
          businessDate: values.businessDate,
          accountId: values.accountId,
          categoryId: values.categoryId || undefined,
          memo: values.memo.trim() || undefined
        };

        try {
          await mutation.mutateAsync({
            payload,
            fallback: buildTransactionFallbackItem(payload, {
              accountName: selectedAccount.name,
              categoryName: selectedCategory?.name
            })
          });

          form.reset({
            title: '',
            amountWon: 0,
            businessDate: getTodayDateInputValue(),
            type: values.type,
            accountId: values.accountId,
            categoryId: '',
            memo: ''
          });
          setFeedback({
            severity: 'success',
            message: 'Transaction saved and the ledger list was refreshed.'
          });
        } catch (error) {
          setFeedback({
            severity: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'Could not save the transaction.'
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
              label="Business Date"
              type="date"
              error={Boolean(form.formState.errors.businessDate)}
              helperText={form.formState.errors.businessDate?.message}
              {...form.register('businessDate')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              select
              label="Type"
              error={Boolean(form.formState.errors.type)}
              helperText={form.formState.errors.type?.message}
              {...form.register('type')}
            >
              <MenuItem value="EXPENSE">Expense</MenuItem>
              <MenuItem value="INCOME">Income</MenuItem>
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
            <TextField
              select
              label="Category"
              disabled={filteredCategories.length === 0}
              helperText={
                filteredCategories.length === 0
                  ? 'No categories match the selected transaction type.'
                  : 'Optional'
              }
              {...form.register('categoryId')}
            >
              <MenuItem value="">No category</MenuItem>
              {filteredCategories.map((category) => (
                <MenuItem key={category.id} value={category.id}>
                  {category.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              label="Memo"
              multiline
              minRows={3}
              error={Boolean(form.formState.errors.memo)}
              helperText={form.formState.errors.memo?.message ?? 'Optional'}
              {...form.register('memo')}
            />
          </Grid>
        </Grid>
        <Button type="submit" variant="contained" disabled={isBusy} sx={{ alignSelf: 'flex-start' }}>
          {mutation.isPending ? 'Saving...' : 'Save Transaction'}
        </Button>
      </Stack>
    </form>
  );
}
