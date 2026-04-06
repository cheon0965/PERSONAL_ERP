'use client';

import { Alert, Stack } from '@mui/material';
import { ReferenceDataReadinessAlert } from '@/features/reference-data/reference-data-readiness';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { CollectImportedRowDialog } from './collect-imported-row-dialog';
import { ImportBatchesGrid } from './import-batches-grid';
import { ImportedRowsGrid } from './imported-rows-grid';
import { ImportsCurrentPeriodSection } from './imports-current-period-section';
import { ImportUploadDialog } from './import-upload-dialog';
import { useImportsPage } from './use-imports-page';

export function ImportsPage() {
  const page = useImportsPage();

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="업로드/자동화"
        title="업로드 배치"
        description="원본 파일을 업로드 배치로 남기고, 정상 파싱 행만 선택적으로 수집 거래로 올리는 화면입니다. 승격 전에 자동 판정 근거를 확인하고, 승격 뒤에는 실제 연결 결과를 다시 추적할 수 있습니다."
        primaryActionLabel="업로드 배치 등록"
        primaryActionOnClick={page.openUploadDrawer}
      />

      {page.feedback ? (
        <Alert severity={page.feedback.severity} variant="outlined">
          {page.feedback.message}
        </Alert>
      ) : null}
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

      <ImportsCurrentPeriodSection currentPeriod={page.currentPeriod} />

      <ReferenceDataReadinessAlert
        readiness={page.referenceDataReadinessQuery.data ?? null}
        context="import-collection"
      />

      <ImportBatchesGrid
        batches={page.batches}
        selectedBatchId={page.selectedBatch?.id ?? null}
        onSelectBatch={page.selectBatch}
      />

      <ImportedRowsGrid
        selectedBatch={page.selectedBatch}
        rows={page.selectedBatchRows}
        selectedRowId={page.selectedRow?.id ?? null}
        onPrepareCollect={page.prepareCollectRow}
      />

      <ImportUploadDialog
        open={page.isUploadDrawerOpen}
        form={page.uploadForm}
        submitPending={page.submitUploadPending}
        onClose={page.closeUploadDrawer}
        onChange={page.updateUploadForm}
        onSubmit={page.submitUpload}
      />

      <CollectImportedRowDialog
        open={page.isCollectDrawerOpen}
        selectedRow={page.selectedRow}
        currentPeriod={page.currentPeriod}
        readiness={page.referenceDataReadinessQuery.data ?? null}
        fundingAccounts={page.fundingAccounts}
        categories={page.categories}
        collectForm={page.collectForm}
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
