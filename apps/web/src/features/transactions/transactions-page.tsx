'use client';

import Link from 'next/link';
import {
  Alert,
  Button,
  CircularProgress,
  Stack,
  Typography
} from '@mui/material';
import { ReferenceDataReadinessAlert } from '@/features/reference-data/reference-data-readiness';
import { ConfirmActionDialog } from '@/shared/ui/confirm-action-dialog';
import { FormDrawer } from '@/shared/ui/form-drawer';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { TransactionForm } from './transaction-form';
import { readTransactionsDeleteDescription } from './transactions-page.commands';
import {
  CurrentPeriodSection,
  TransactionsFilterSection,
  TransactionsTableSection
} from './transactions-page.sections';
import { useTransactionsPage } from './use-transactions-page';

export function TransactionsPage() {
  const page = useTransactionsPage();

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="수집/확정"
        title="수집 거래"
        description="현재 열린 운영 월 안에서 사업 거래를 입력하고, 수집·검토·전표 준비 상태를 구분해 보완한 뒤 전표로 확정하는 화면입니다. 원계획과 전표 연결도 함께 추적합니다."
        primaryActionLabel="수집 거래 등록"
        primaryActionOnClick={page.openCreateDrawer}
      />

      {page.highlightedTransactionId || page.highlightedPlanItemId ? (
        <Alert severity="info" variant="outlined">
          다른 화면에서 연결된 수집 거래 맥락을 열었습니다. 관련 거래를 목록
          상단에 먼저 배치했습니다.
        </Alert>
      ) : null}
      {page.feedback ? (
        <Alert severity={page.feedback.severity} variant="outlined">
          {page.feedback.message}
        </Alert>
      ) : null}
      {page.currentPeriodQuery.error ? (
        <QueryErrorAlert
          title="현재 운영 기간을 확인하지 못했습니다."
          error={page.currentPeriodQuery.error}
        />
      ) : null}
      {page.transactionsQuery.error ? (
        <QueryErrorAlert
          title="수집 거래 조회에 실패했습니다."
          error={page.transactionsQuery.error}
        />
      ) : null}
      {page.journalEntriesQuery.error ? (
        <QueryErrorAlert
          title="전표 연결 정보를 불러오지 못했습니다."
          error={page.journalEntriesQuery.error}
        />
      ) : null}
      <ReferenceDataReadinessAlert
        readiness={page.referenceDataReadinessQuery.data ?? null}
        context="transaction-entry"
      />
      {page.referenceDataReadinessQuery.data &&
      !page.referenceDataReadinessQuery.data.isReadyForTransactionEntry ? (
        <Alert severity="info" variant="outlined">
          기준 데이터 준비가 완전하지 않은 상태에서도 기존 수집 거래는 확인할 수
          있지만, 새 입력과 다음 확정 흐름은 제한될 수 있습니다.{' '}
          <Button component={Link} href="/reference-data" size="small">
            기준 데이터 화면으로 이동
          </Button>
        </Alert>
      ) : null}

      <CurrentPeriodSection currentPeriod={page.currentPeriod} />

      <TransactionsFilterSection
        currentPeriod={page.currentPeriod}
        keyword={page.keyword}
        fundingAccountName={page.fundingAccountName}
        categoryName={page.categoryName}
        postingStatus={page.postingStatus}
        fundingAccountOptions={page.fundingAccountOptions}
        categoryOptions={page.categoryOptions}
        onKeywordChange={page.setKeyword}
        onFundingAccountChange={page.setFundingAccountName}
        onCategoryChange={page.setCategoryName}
        onPostingStatusChange={page.setPostingStatus}
      />

      <TransactionsTableSection
        currentPeriod={page.currentPeriod}
        rows={page.visibleTransactions}
        journalEntriesById={page.journalEntriesById}
        confirmPending={page.confirmPending}
        confirmingTransactionId={page.confirmingTransactionId}
        onConfirm={page.confirmTransaction}
        onEdit={page.openEditDrawer}
        onDelete={page.openDeleteDialog}
      />

      <FormDrawer
        open={page.drawerOpen}
        onClose={page.closeDrawer}
        title={page.drawerTitle}
        description={page.drawerDescription}
      >
        {page.drawerState?.mode === 'edit' ? (
          page.editingTransactionQuery.isPending ? (
            <Stack alignItems="center" spacing={1.5} sx={{ py: 4 }}>
              <CircularProgress size={28} />
              <Typography variant="body2" color="text.secondary">
                수정할 수집 거래를 불러오고 있습니다.
              </Typography>
            </Stack>
          ) : page.editingTransactionQuery.error ? (
            <QueryErrorAlert
              title="수집 거래 상세 조회에 실패했습니다."
              error={page.editingTransactionQuery.error}
            />
          ) : page.editingTransactionQuery.data ? (
            <TransactionForm
              currentPeriod={page.currentPeriod}
              mode="edit"
              initialTransaction={page.editingTransactionQuery.data}
              onCompleted={page.handleFormCompleted}
            />
          ) : (
            <Alert severity="warning" variant="outlined">
              수정할 수집 거래를 찾지 못했습니다.
            </Alert>
          )
        ) : (
          <TransactionForm
            currentPeriod={page.currentPeriod}
            mode="create"
            onCompleted={page.handleFormCompleted}
          />
        )}
      </FormDrawer>

      <ConfirmActionDialog
        open={page.deleteTarget !== null}
        title="수집 거래 삭제"
        description={readTransactionsDeleteDescription(page.deleteTarget)}
        confirmLabel="삭제"
        pendingLabel="삭제 중..."
        confirmColor="error"
        busy={page.deletePending}
        onClose={page.closeDeleteDialog}
        onConfirm={page.confirmDelete}
      />
    </Stack>
  );
}
