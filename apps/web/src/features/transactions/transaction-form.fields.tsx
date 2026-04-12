'use client';

import { Button, Grid, MenuItem, TextField } from '@mui/material';
import type {
  AccountingPeriodItem,
  CategoryItem,
  FundingAccountItem
} from '@personal-erp/contracts';
import { Controller, type UseFormReturn } from 'react-hook-form';
import { appLayout } from '@/shared/ui/layout-metrics';
import type { TransactionFormInput } from './transaction-form.schema';
import { readFundingAccountOptionLabel } from './transaction-form.mapper';

export function TransactionFormFields({
  currentPeriod,
  form,
  availableFundingAccounts,
  filteredCategories,
  isBusy,
  submitLabel
}: {
  currentPeriod: AccountingPeriodItem | null;
  form: UseFormReturn<TransactionFormInput>;
  availableFundingAccounts: FundingAccountItem[];
  filteredCategories: CategoryItem[];
  isBusy: boolean;
  submitLabel: string;
}) {
  return (
    <>
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
          <Controller
            control={form.control}
            name="type"
            render={({ field }) => (
              <TextField
                select
                label="거래 성격"
                disabled={!currentPeriod}
                error={Boolean(form.formState.errors.type)}
                helperText={form.formState.errors.type?.message}
                name={field.name}
                value={field.value ?? 'EXPENSE'}
                onBlur={field.onBlur}
                onChange={field.onChange}
                inputRef={field.ref}
              >
                <MenuItem value="EXPENSE">지출</MenuItem>
                <MenuItem value="INCOME">수입</MenuItem>
                <MenuItem value="TRANSFER">이체</MenuItem>
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
                disabled={!currentPeriod || availableFundingAccounts.length === 0}
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
                disabled={!currentPeriod || filteredCategories.length === 0}
                helperText={
                  filteredCategories.length === 0
                    ? '선택한 거래 유형에 맞는 카테고리가 없으면 비워 둘 수 있습니다.'
                    : '이체는 카테고리 없이 전표 준비 상태가 됩니다. 손익 거래는 카테고리가 비어 있으면 검토 상태로 남습니다.'
                }
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
      <Button
        type="submit"
        variant="contained"
        disabled={isBusy}
        sx={{ alignSelf: 'flex-start' }}
      >
        {submitLabel}
      </Button>
    </>
  );
}
