'use client';

import Link from 'next/link';
import { Alert, Button, Stack } from '@mui/material';
import type {
  AccountingPeriodItem,
  CollectedTransactionDetailItem,
  CollectedTransactionItem
} from '@personal-erp/contracts';
import { ReferenceDataReadinessAlert } from '@/features/reference-data/reference-data-readiness';
import { appLayout } from '@/shared/ui/layout-metrics';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { resolveStatusLabel } from '@/shared/ui/status-chip';
import { TransactionFormFields } from './transaction-form.fields';
import {
  useTransactionForm,
  type TransactionFormMode
} from './use-transaction-form';

type TransactionFormProps = {
  currentPeriod: AccountingPeriodItem | null;
  mode?: TransactionFormMode;
  initialTransaction?: CollectedTransactionDetailItem | null;
  onCompleted?: (
    transaction: CollectedTransactionItem,
    mode: TransactionFormMode
  ) => void;
};

export function TransactionForm({
  currentPeriod,
  mode = 'create',
  initialTransaction = null,
  onCompleted
}: TransactionFormProps) {
  const formState = useTransactionForm({
    currentPeriod,
    mode,
    initialTransaction,
    onCompleted
  });

  return (
    <form
      onSubmit={formState.form.handleSubmit(async (values) => {
        await formState.submit(values);
      })}
    >
      <Stack spacing={appLayout.cardGap}>
        <ReferenceDataReadinessAlert
          readiness={formState.referenceDataReadinessQuery.data ?? null}
          context="transaction-entry"
        />
        {formState.referenceError ? (
          <QueryErrorAlert
            title="자금수단 또는 카테고리 조회에 실패했습니다."
            error={formState.referenceError}
          />
        ) : null}
        {formState.feedback ? (
          <Alert severity={formState.feedback.severity} variant="outlined">
            {formState.feedback.message}
          </Alert>
        ) : null}
        {!currentPeriod ? (
          <Alert severity="warning" variant="outlined">
            현재 열린 운영 기간이 없습니다. 먼저 `월 운영` 화면에서 운영 기간을
            시작해야 수집 거래를 저장할 수 있습니다.
          </Alert>
        ) : mode === 'edit' ? (
          <Alert severity="info" variant="outlined">
            {currentPeriod.monthLabel} 운영 기간 안의 미확정 거래만 수정할 수
            있습니다. 현재 입력 기준 저장 시{' '}
            {resolveStatusLabel(formState.predictedStatus)} 상태로 반영됩니다.
          </Alert>
        ) : (
          <Alert severity="info" variant="outlined">
            현재 수집 거래는 {currentPeriod.monthLabel} 운영 기간 안에서만
            등록됩니다. 저장 시 {resolveStatusLabel(formState.predictedStatus)}{' '}
            상태로 반영됩니다.
          </Alert>
        )}
        {formState.availableFundingAccounts.length === 0 ? (
          <Alert severity="warning" variant="outlined">
            사용할 수 있는 자금수단이 아직 없습니다.{' '}
            <Button
              component={Link}
              href="/reference-data/funding-accounts"
              size="small"
            >
              자금수단
            </Button>
          </Alert>
        ) : null}
        {formState.selectedType !== 'TRANSFER' &&
        formState.filteredCategories.length === 0 ? (
          <Alert severity="warning" variant="outlined">
            선택한 거래 성격에 맞는 카테고리가 아직 없습니다.{' '}
            <Button
              component={Link}
              href="/reference-data/categories"
              size="small"
            >
              카테고리
            </Button>
          </Alert>
        ) : null}

        <TransactionFormFields
          currentPeriod={currentPeriod}
          form={formState.form}
          availableFundingAccounts={formState.availableFundingAccounts}
          filteredCategories={formState.filteredCategories}
          isBusy={formState.isBusy}
          submitLabel={
            formState.mutationPending ? '저장 중...' : formState.submitLabel
          }
        />
      </Stack>
    </form>
  );
}
