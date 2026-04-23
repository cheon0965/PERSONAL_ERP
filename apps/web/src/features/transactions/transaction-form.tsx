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
  accountingPeriods: AccountingPeriodItem[];
  mode?: TransactionFormMode;
  initialTransaction?: CollectedTransactionDetailItem | null;
  onCompleted?: (
    transaction: CollectedTransactionItem,
    mode: TransactionFormMode
  ) => void;
};

export function TransactionForm({
  currentPeriod,
  accountingPeriods,
  mode = 'create',
  initialTransaction = null,
  onCompleted
}: TransactionFormProps) {
  const formState = useTransactionForm({
    currentPeriod,
    accountingPeriods,
    mode,
    initialTransaction,
    onCompleted
  });
  const hasCollectingPeriod = formState.collectingPeriods.length > 0;
  const periodScopeLabel =
    formState.preferredPeriod?.monthLabel ?? currentPeriod?.monthLabel;

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
        {!hasCollectingPeriod ? (
          <Alert severity="warning" variant="outlined">
            현재 열린 운영 기간이 없습니다. 먼저 `월 운영` 화면에서 운영 기간을
            시작해야 수집 거래를 저장할 수 있습니다.
          </Alert>
        ) : mode === 'edit' ? (
          <Alert severity="info" variant="outlined">
            최신 진행월 {periodScopeLabel} 범위의 미확정 거래만 수정할 수
            있습니다. 현재 입력 기준 저장 시{' '}
            {resolveStatusLabel(formState.predictedStatus)} 상태로 반영됩니다.
          </Alert>
        ) : (
          <Alert severity="info" variant="outlined">
            현재 수집 거래는 최신 진행월 {periodScopeLabel} 범위 안에서
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
        formState.selectedType !== 'REVERSAL' &&
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
          currentPeriod={formState.preferredPeriod}
          hasCollectingPeriod={hasCollectingPeriod}
          hasMultipleCollectingPeriods={false}
          form={formState.form}
          availableFundingAccounts={formState.availableFundingAccounts}
          filteredCategories={formState.filteredCategories}
          feedback={formState.feedback}
          includeReversalTypeOption={formState.selectedType === 'REVERSAL'}
          isBusy={formState.isBusy}
          submitLabel={
            formState.mutationPending ? '저장 중...' : formState.submitLabel
          }
        />
      </Stack>
    </form>
  );
}
