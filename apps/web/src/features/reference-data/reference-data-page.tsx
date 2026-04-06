'use client';

import { Alert, Grid, Stack } from '@mui/material';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { CategoriesSection } from './categories-section';
import { CategoryEditorDrawer } from './category-editor-drawer';
import { CategoryToggleDialog } from './category-toggle-dialog';
import { FundingAccountEditorDrawer } from './funding-account-editor-drawer';
import { FundingAccountsSection } from './funding-accounts-section';
import { FundingAccountStatusDialog } from './funding-account-status-dialog';
import { ReferenceDataLookupsSection } from './reference-data-lookups-section';
import { ReferenceDataReadinessSection } from './reference-data-readiness-section';
import { useReferenceDataPage } from './use-reference-data-page';

export function ReferenceDataPage() {
  const page = useReferenceDataPage();

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="기준 데이터"
        title="기준 데이터와 참조 입력"
        description="현재 사업 장부에서 사용하는 활성 기준 데이터와 준비 상태를 한 번에 확인합니다."
      />

      {page.feedback ? (
        <Alert severity={page.feedback.severity} variant="outlined">
          {page.feedback.message}
        </Alert>
      ) : null}

      {page.queryErrors.length > 0 ? (
        <QueryErrorAlert
          title="기준 데이터 일부를 불러오지 못했습니다."
          error={page.queryErrors[0]}
        />
      ) : null}

      <ReferenceDataReadinessSection
        readiness={page.readiness}
        canManageReferenceData={page.canManageReferenceData}
      />

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, xl: 6 }}>
          <FundingAccountsSection
            rows={page.fundingAccounts}
            canManageReferenceData={page.canManageReferenceData}
            onCreate={page.openFundingAccountCreate}
            onEdit={page.openFundingAccountEdit}
            onTransition={page.openFundingAccountTransition}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
          <CategoriesSection
            rows={page.categories}
            canManageReferenceData={page.canManageReferenceData}
            onCreate={page.openCategoryCreate}
            onEdit={page.openCategoryEdit}
            onToggle={page.openCategoryToggle}
          />
        </Grid>
      </Grid>

      <ReferenceDataLookupsSection
        accountSubjects={page.accountSubjects}
        ledgerTransactionTypes={page.ledgerTransactionTypes}
      />

      <FundingAccountEditorDrawer
        editorState={page.fundingAccountEditorState}
        editingFundingAccount={page.editingFundingAccount}
        busy={page.saveFundingAccountPending}
        onClose={page.closeFundingAccountEditor}
        onSubmit={page.submitFundingAccount}
      />

      <CategoryEditorDrawer
        editorState={page.categoryEditorState}
        editingCategory={page.editingCategory}
        busy={page.saveCategoryPending}
        onClose={page.closeCategoryEditor}
        onSubmit={page.submitCategory}
      />

      <FundingAccountStatusDialog
        target={page.fundingAccountStatusActionTarget}
        busy={page.transitionFundingAccountPending}
        onClose={page.closeFundingAccountStatusDialog}
        onConfirm={() => {
          void page.confirmFundingAccountTransition();
        }}
      />

      <CategoryToggleDialog
        target={page.categoryToggleTarget}
        busy={page.toggleCategoryPending}
        onClose={page.closeCategoryToggle}
        onConfirm={() => {
          void page.confirmCategoryToggle();
        }}
      />
    </Stack>
  );
}
