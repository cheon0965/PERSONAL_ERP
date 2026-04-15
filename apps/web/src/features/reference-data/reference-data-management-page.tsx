'use client';

import { Alert, Grid, Stack } from '@mui/material';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
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
import { ReferenceDataSectionNav } from './reference-data-section-nav';
import { useReferenceDataPage } from './use-reference-data-page';

export function ReferenceDataManagementPage() {
  const page = useReferenceDataPage();
  const activeFundingAccountsCount = page.fundingAccounts.filter(
    (item) => item.status === 'ACTIVE'
  ).length;
  const activeCategoriesCount = page.categories.filter(
    (item) => item.isActive
  ).length;

  useDomainHelp({
    title: '기준 데이터 관리 가이드',
    description:
      '기준 데이터 관리 화면은 자금수단과 카테고리를 직접 편집하고, 공식을 따르는 참조값은 읽는 화면입니다.',
    primaryEntity: 'FundingAccount / Category',
    relatedEntities: ['AccountSubject', 'LedgerTransactionType'],
    truthSource:
      '직접 관리하는 범위는 자금수단과 카테고리이며, 계정과목과 거래유형은 시스템 기준을 따릅니다.'
  });

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="기준 데이터"
        title="기준 데이터 관리"
        description="직접 관리하는 자금수단과 카테고리를 먼저 정리하고, 공식 참조값은 아래에서 확인합니다."
        badges={[
          {
            label: page.canManageReferenceData ? '관리 가능' : '조회 전용',
            color: page.canManageReferenceData ? 'primary' : 'default'
          }
        ]}
        metadata={[
          { label: '사업장', value: page.workspaceLabel },
          { label: '장부', value: page.ledgerLabel },
          {
            label: '편집 대상',
            value: `자금수단 ${activeFundingAccountsCount}/${page.fundingAccounts.length}개, 카테고리 ${activeCategoriesCount}/${page.categories.length}개 활성`
          },
          {
            label: '공식 참조',
            value: `계정과목 ${page.accountSubjects.length}개, 거래유형 ${page.ledgerTransactionTypes.length}개`
          }
        ]}
        secondaryActionLabel="공식 참조값"
        secondaryActionHref="#reference-lookups"
        primaryActionLabel="준비 상태 보기"
        primaryActionHref="/reference-data"
      />

      <ReferenceDataSectionNav />

      {page.feedback ? (
        <Alert severity={page.feedback.severity} variant="outlined">
          {page.feedback.message}
        </Alert>
      ) : null}

      {page.queryErrors.length > 0 ? (
        <QueryErrorAlert
          title="기준 데이터 관리 일부를 불러오지 못했습니다."
          error={page.queryErrors[0]}
        />
      ) : null}

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

      <Alert severity="info" variant="outlined">
        위 두 목록은 직접 관리하는 기준 데이터이고, 아래 공식 참조값은 전표/입력
        정책 확인용 읽기 전용 목록입니다.
      </Alert>

      <Stack id="reference-lookups">
        <ReferenceDataLookupsSection
          accountSubjects={page.accountSubjects}
          ledgerTransactionTypes={page.ledgerTransactionTypes}
        />
      </Stack>

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
