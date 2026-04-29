'use client';

import * as React from 'react';
import { Stack, Typography } from '@mui/material';
import { ReferenceDataReadinessAlert } from '@/features/reference-data/reference-data-readiness';
import { FeedbackAlert } from '@/shared/ui/feedback-alert';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import { CollectImportedRowDialog } from './collect-imported-row-dialog';
import { ImportBatchesGrid } from './import-batches-grid';
import { ImportedRowsGrid } from './imported-rows-grid';
import { ImportUploadDialog } from './import-upload-dialog';
import { useImportsPage } from './use-imports-page';

type ImportsLayout = 'list' | 'detail';

export function ImportsPage({
  mode = 'list',
  selectedBatchId = null
}: {
  mode?: ImportsLayout;
  selectedBatchId?: string | null;
}) {
  const page = useImportsPage(selectedBatchId, mode);
  const isDetailMode = mode === 'detail';
  const pageTitle = isDetailMode ? '업로드 배치 작업대' : '업로드 배치';
  const pageDescription = isDetailMode
    ? '선택한 업로드 배치의 행을 검토하고, 필요한 항목만 수집 거래로 등록하는 전용 작업 화면입니다.'
    : '원본을 업로드 배치로 보관하고, 검토할 배치를 선택해 작업대로 이어집니다.';
  const currentPeriodDateRange = page.currentPeriod
    ? `${page.currentPeriod.startDate.slice(0, 10)} ~ ${page.currentPeriod.endDate.slice(0, 10)}`
    : '-';

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="업로드/자동화"
        title={pageTitle}
        description={pageDescription}
        badges={[
          {
            label: page.currentPeriod?.monthLabel ?? '열린 운영 월 없음',
            color: page.currentPeriod ? 'primary' : 'default'
          },
          {
            label: page.referenceDataReadinessQuery.data
              ?.isReadyForImportCollection
              ? '등록 준비됨'
              : '기준 데이터 점검 필요',
            color: page.referenceDataReadinessQuery.data
              ?.isReadyForImportCollection
              ? 'success'
              : 'warning'
          }
        ]}
        metadata={[
          {
            label: '상태',
            value: page.currentPeriod?.status ?? '운영 월 없음'
          },
          {
            label: '운영 월',
            value: page.currentPeriod?.monthLabel ?? '-'
          },
          {
            label: '허용 거래일 범위',
            value: currentPeriodDateRange
          }
        ]}
        metadataSingleRow
        primaryActionLabel="업로드 배치 등록"
        primaryActionOnClick={page.openUploadDrawer}
        secondaryActionLabel={
          isDetailMode ? '배치 목록 보기' : '수집 거래 보기'
        }
        secondaryActionHref={isDetailMode ? '/imports' : '/transactions'}
      />

      <FeedbackAlert feedback={page.feedback} />
      {page.currentPeriodQuery.error ? (
        <QueryErrorAlert
          title="현재 운영 기간을 불러오지 못했습니다."
          error={page.currentPeriodQuery.error}
        />
      ) : null}
      {page.importBatchesQuery.error ? (
        <QueryErrorAlert
          title="업로드 배치 조회에 실패했습니다."
          error={page.importBatchesQuery.error}
        />
      ) : null}

      <ReferenceDataReadinessAlert
        readiness={page.referenceDataReadinessQuery.data ?? null}
        context="import-collection"
      />

      {!isDetailMode ? (
        <ImportBatchesGrid
          batches={page.batches}
          currentPeriod={page.currentPeriod}
          selectedBatchId={page.selectedBatch?.id ?? null}
          onSelectBatch={page.selectBatch}
          helperText="검토할 배치를 선택하면 작업대 열기 버튼이 활성화됩니다."
          actionLabel="선택"
        />
      ) : page.selectedBatch ? (
        <ImportedRowsGrid
          selectedBatch={page.selectedBatch}
          rows={page.selectedBatchRows}
          selectedRowIds={page.selectedRowIds}
          selectedRowsCount={page.selectedRowsCount}
          collectableRowCount={page.collectableRowCount}
          selectedCollectableRowCount={page.selectedCollectableRowCount}
          bulkCollectForm={page.bulkCollectForm}
          categories={page.categories}
          bulkCollectJob={page.bulkCollectJob}
          bulkCollectPending={page.isBulkCollectPending}
          cancelBulkCollectPending={page.cancelBulkCollectJobPending}
          onBulkCollectFormChange={page.updateBulkCollectForm}
          onSelectedRowIdsChange={page.selectRows}
          onPrepareCollect={page.prepareCollectRow}
          onBulkCollect={page.submitBulkCollect}
          onCancelBulkCollect={page.cancelBulkCollectJob}
        />
      ) : (
        <SectionCard
          title="선택한 배치를 찾지 못했습니다"
          description="배치가 삭제되었거나 아직 목록에 없는 경우일 수 있습니다."
        >
          <Typography variant="body2" color="text.secondary">
            배치 목록으로 돌아가 다시 선택해 주세요.
          </Typography>
        </SectionCard>
      )}

      <ImportUploadDialog
        open={page.isUploadDrawerOpen}
        form={page.uploadForm}
        feedback={page.uploadFeedback}
        fundingAccounts={page.uploadFundingAccounts}
        submitPending={page.submitUploadPending}
        onClose={page.closeUploadDrawer}
        onChange={page.updateUploadForm}
        onSubmit={page.submitUpload}
      />

      <CollectImportedRowDialog
        open={page.isCollectDrawerOpen}
        selectedRow={page.selectedRow}
        readiness={page.referenceDataReadinessQuery.data ?? null}
        fundingAccounts={page.fundingAccounts}
        categories={page.categories}
        collectForm={page.collectForm}
        feedback={page.collectFeedback}
        collectPreview={page.collectPreview}
        submitPending={page.submitCollectPending}
        canSubmit={page.canSubmitCollect}
        onClose={page.closeCollectDrawer}
        onChange={page.updateCollectForm}
        onSubmit={page.submitCollect}
      />
    </Stack>
  );
}
