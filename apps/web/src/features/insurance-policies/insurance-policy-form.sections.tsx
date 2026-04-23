'use client';

import { Alert, Grid, MenuItem, TextField } from '@mui/material';
import type { CategoryItem, FundingAccountItem } from '@personal-erp/contracts';
import { Controller, type UseFormReturn } from 'react-hook-form';
import { appLayout } from '@/shared/ui/layout-metrics';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import {
  type InsurancePolicyFormInput,
  readFundingAccountOptionLabel
} from './insurance-policy-form.model';

export function InsurancePolicyReferenceAlerts({
  referenceError
}: {
  referenceError: unknown;
}) {
  return (
    <>
      {referenceError ? (
        <QueryErrorAlert
          title="보험 계약 반복 규칙 기준 조회에 실패했습니다."
          error={referenceError}
        />
      ) : null}
      <Alert severity="info" variant="outlined">
        보험 계약을 저장하면 연결된 반복 규칙이 함께 생성되거나 갱신됩니다. 실제
        회계 확정은 이후 수집 거래와 전표 흐름에서 이어집니다.
      </Alert>
    </>
  );
}

export function InsurancePolicyFieldGrid({
  form,
  availableFundingAccounts,
  availableCategories
}: {
  form: UseFormReturn<InsurancePolicyFormInput>;
  availableFundingAccounts: FundingAccountItem[];
  availableCategories: CategoryItem[];
}) {
  return (
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
  );
}
