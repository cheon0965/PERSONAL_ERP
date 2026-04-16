'use client';

import { Alert, Grid, MenuItem, TextField } from '@mui/material';
import type {
  CategoryItem,
  FundingAccountItem,
} from '@personal-erp/contracts';
import { Controller, type UseFormReturn } from 'react-hook-form';
import { appLayout } from '@/shared/ui/layout-metrics';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import {
  type RecurringRuleFormInput,
  readFundingAccountOptionLabel
} from './recurring-rule-form.model';

type SubmitFeedback = {
  severity: 'success' | 'error';
  message: string;
} | null;

export function RecurringRuleReferenceAlerts({
  feedback,
  mode,
  referenceError
}: {
  feedback: SubmitFeedback;
  mode: 'create' | 'edit';
  referenceError: unknown;
}) {
  return (
    <>
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
    </>
  );
}

export function RecurringRuleFieldGrid({
  availableFundingAccounts,
  filteredCategories,
  form
}: {
  availableFundingAccounts: FundingAccountItem[];
  filteredCategories: CategoryItem[];
  form: UseFormReturn<RecurringRuleFormInput>;
}) {
  return (
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
                field.onChange(nextValue === '' ? undefined : Number(nextValue));
              }}
              inputRef={field.ref}
            />
          )}
        />
      </Grid>
    </Grid>
  );
}
