'use client';

import { Alert, Stack } from '@mui/material';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { CategoriesSection } from './categories-section';
import { CategoryEditorDrawer } from './category-editor-drawer';
import { CategoryToggleDialog } from './category-toggle-dialog';
import { FundingAccountDeleteDialog } from './funding-account-delete-dialog';
import { FundingAccountEditorDrawer } from './funding-account-editor-drawer';
import { FundingAccountsSection } from './funding-accounts-section';
import { FundingAccountStatusDialog } from './funding-account-status-dialog';
import { ReferenceDataLookupsSection } from './reference-data-lookups-section';
import { ReferenceDataSectionNav } from './reference-data-section-nav';
import { useReferenceDataPage } from './use-reference-data-page';

export type ReferenceDataManagementSection =
  | 'funding-accounts'
  | 'categories'
  | 'lookups';

type ReferenceDataManagementPageProps = {
  section?: ReferenceDataManagementSection;
};

export function ReferenceDataManagementPage({
  section = 'funding-accounts'
}: ReferenceDataManagementPageProps) {
  const page = useReferenceDataPage(section);
  const activeFundingAccountsCount = page.fundingAccounts.filter(
    (item) => item.status === 'ACTIVE'
  ).length;
  const activeCategoriesCount = page.categories.filter(
    (item) => item.isActive
  ).length;
  const editorOpen =
    page.fundingAccountEditorState !== null || page.categoryEditorState !== null;

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="기준 데이터"
        title={readReferenceDataSectionTitle(section)}
        badges={[
          {
            label:
              section === 'lookups'
                ? '읽기 전용'
                : page.canManageReferenceData
                  ? '관리 가능'
                  : '조회 전용',
            color:
              section === 'lookups'
                ? ('default' as const)
                : page.canManageReferenceData
                  ? ('primary' as const)
                  : ('default' as const)
          }
        ]}
        metadata={buildReferenceDataMetadata(section, {
          workspaceLabel: page.workspaceLabel,
          ledgerLabel: page.ledgerLabel,
          fundingAccountCount: page.fundingAccounts.length,
          activeFundingAccountsCount,
          categoryCount: page.categories.length,
          activeCategoriesCount,
          accountSubjectCount: page.accountSubjects.length,
          ledgerTransactionTypeCount: page.ledgerTransactionTypes.length
        })}
      />

      <ReferenceDataSectionNav />

      {page.feedback?.severity === 'error' && !editorOpen ? (
        <Alert severity={page.feedback.severity} variant="outlined">
          {page.feedback.message}
        </Alert>
      ) : null}

      {page.queryErrors.length > 0 ? (
        <QueryErrorAlert
          title="기준 데이터를 불러오지 못했습니다."
          error={page.queryErrors[0]}
        />
      ) : null}

      {section === 'funding-accounts' ? (
        <>
          <FundingAccountsSection
            rows={page.fundingAccounts}
            canManageReferenceData={page.canManageReferenceData}
            onCreate={page.openFundingAccountCreate}
            onEdit={page.openFundingAccountEdit}
            onTransition={page.openFundingAccountTransition}
            onCompleteBootstrap={page.completeFundingAccountBootstrap}
            onDelete={page.openFundingAccountDelete}
          />
          <FundingAccountEditorDrawer
            editorState={page.fundingAccountEditorState}
            editingFundingAccount={page.editingFundingAccount}
            feedback={page.feedback}
            busy={page.saveFundingAccountPending}
            onClose={page.closeFundingAccountEditor}
            onSubmit={page.submitFundingAccount}
          />
          <FundingAccountStatusDialog
            target={page.fundingAccountStatusActionTarget}
            busy={page.transitionFundingAccountPending}
            onClose={page.closeFundingAccountStatusDialog}
            onConfirm={() => {
              void page.confirmFundingAccountTransition();
            }}
          />
          <FundingAccountDeleteDialog
            target={page.fundingAccountDeleteTarget}
            busy={page.deleteFundingAccountPending}
            onClose={page.closeFundingAccountDeleteDialog}
            onConfirm={() => {
              void page.confirmFundingAccountDelete();
            }}
          />
        </>
      ) : null}

      {section === 'categories' ? (
        <>
          <CategoriesSection
            rows={page.categories}
            canManageReferenceData={page.canManageReferenceData}
            onCreate={page.openCategoryCreate}
            onEdit={page.openCategoryEdit}
            onToggle={page.openCategoryToggle}
          />
          <CategoryEditorDrawer
            editorState={page.categoryEditorState}
            editingCategory={page.editingCategory}
            feedback={page.feedback}
            busy={page.saveCategoryPending}
            onClose={page.closeCategoryEditor}
            onSubmit={page.submitCategory}
          />
          <CategoryToggleDialog
            target={page.categoryToggleTarget}
            busy={page.toggleCategoryPending}
            onClose={page.closeCategoryToggle}
            onConfirm={() => {
              void page.confirmCategoryToggle();
            }}
          />
        </>
      ) : null}

      {section === 'lookups' ? (
        <ReferenceDataLookupsSection
          accountSubjects={page.accountSubjects}
          ledgerTransactionTypes={page.ledgerTransactionTypes}
        />
      ) : null}
    </Stack>
  );
}

function readReferenceDataSectionTitle(
  section: ReferenceDataManagementSection
) {
  switch (section) {
    case 'categories':
      return '카테고리';
    case 'lookups':
      return '공식 참조값';
    case 'funding-accounts':
    default:
      return '자금수단';
  }
}

function buildReferenceDataMetadata(
  section: ReferenceDataManagementSection,
  input: {
    workspaceLabel: string;
    ledgerLabel: string;
    fundingAccountCount: number;
    activeFundingAccountsCount: number;
    categoryCount: number;
    activeCategoriesCount: number;
    accountSubjectCount: number;
    ledgerTransactionTypeCount: number;
  }
) {
  const common = [
    { label: '사업장', value: input.workspaceLabel },
    { label: '장부', value: input.ledgerLabel }
  ];

  switch (section) {
    case 'categories':
      return [
        ...common,
        {
          label: '활성 / 전체',
          value: `${input.activeCategoriesCount} / ${input.categoryCount}`
        }
      ];
    case 'lookups':
      return [
        ...common,
        {
          label: '계정과목',
          value: `${input.accountSubjectCount}개`
        },
        {
          label: '거래유형',
          value: `${input.ledgerTransactionTypeCount}개`
        }
      ];
    case 'funding-accounts':
    default:
      return [
        ...common,
        {
          label: '활성 / 전체',
          value: `${input.activeFundingAccountsCount} / ${input.fundingAccountCount}`
        }
      ];
  }
}
