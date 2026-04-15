'use client';

import { Alert, Grid, Stack, Typography } from '@mui/material';
import { ReferenceDataReadinessAlert } from '@/features/reference-data/reference-data-readiness';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import { CollectImportedRowDialog } from './collect-imported-row-dialog';
import { ImportBatchesGrid } from './import-batches-grid';
import { ImportedRowsGrid } from './imported-rows-grid';
import { ImportsCurrentPeriodSection } from './imports-current-period-section';
import { ImportUploadDialog } from './import-upload-dialog';
import { useImportsPage } from './use-imports-page';

export function ImportsPage() {
  const page = useImportsPage();
  const collectableRowCount = page.selectedBatchRows.filter(
    (row) => row.parseStatus === 'PARSED' && !row.createdCollectedTransactionId
  ).length;
  const collectedRowCount = page.selectedBatchRows.filter(
    (row) => Boolean(row.createdCollectedTransactionId)
  ).length;

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="업로드/자동화"
        title="업로드 배치"
        description="원본을 업로드 배치로 보관하고, 필요한 행만 수집 거래로 승격합니다."
        badges={[
          {
            label: page.currentPeriod?.monthLabel ?? '열린 운영 월 없음',
            color: page.currentPeriod ? 'primary' : 'default'
          },
          {
            label:
              page.referenceDataReadinessQuery.data?.isReadyForImportCollection
                ? '승격 준비됨'
                : '기준 데이터 점검 필요',
            color:
              page.referenceDataReadinessQuery.data?.isReadyForImportCollection
                ? 'success'
                : 'warning'
          }
        ]}
        metadata={[
          {
            label: '업로드 배치',
            value: `${page.batches.length}건`
          },
          {
            label: '선택 배치',
            value: page.selectedBatch?.fileName ?? '-'
          },
          {
            label: '승격 가능 행',
            value: `${collectableRowCount}건`
          },
          {
            label: '연결 완료 행',
            value: `${collectedRowCount}건`
          }
        ]}
        primaryActionLabel="업로드 배치 등록"
        primaryActionOnClick={page.openUploadDrawer}
        secondaryActionLabel="수집 거래 보기"
        secondaryActionHref="/transactions"
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

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, xl: 5 }}>
          <ImportsCurrentPeriodSection currentPeriod={page.currentPeriod} />
        </Grid>
        <Grid size={{ xs: 12, xl: 7 }}>
          <ImportsSelectionSummaryCard
            selectedBatchFileName={page.selectedBatch?.fileName ?? null}
            rowCount={page.selectedBatchRows.length}
            collectableRowCount={collectableRowCount}
            collectedRowCount={collectedRowCount}
          />
        </Grid>
      </Grid>

      <ReferenceDataReadinessAlert
        readiness={page.referenceDataReadinessQuery.data ?? null}
        context="import-collection"
      />

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, xl: 5 }}>
          <ImportBatchesGrid
            batches={page.batches}
            selectedBatchId={page.selectedBatch?.id ?? null}
            onSelectBatch={page.selectBatch}
          />
        </Grid>

        <Grid size={{ xs: 12, xl: 7 }}>
          <ImportedRowsGrid
            selectedBatch={page.selectedBatch}
            rows={page.selectedBatchRows}
            selectedRowId={page.selectedRow?.id ?? null}
            onPrepareCollect={page.prepareCollectRow}
          />
        </Grid>
      </Grid>

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

function ImportsSelectionSummaryCard({
  selectedBatchFileName,
  rowCount,
  collectableRowCount,
  collectedRowCount
}: {
  selectedBatchFileName: string | null;
  rowCount: number;
  collectableRowCount: number;
  collectedRowCount: number;
}) {
  return (
    <SectionCard
      title="선택 배치 작업대"
      description="현재 선택한 배치 기준으로 업로드 행 검토와 승격 가능 상태를 바로 확인합니다."
    >
      {selectedBatchFileName ? (
        <Grid container spacing={appLayout.fieldGap}>
          <Grid size={{ xs: 12, md: 6 }}>
            <SummaryInfoItem label="배치 파일" value={selectedBatchFileName} />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <SummaryInfoItem label="행 수" value={`${rowCount}건`} />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <SummaryInfoItem label="승격 가능" value={`${collectableRowCount}건`} />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <SummaryInfoItem label="연결 완료" value={`${collectedRowCount}건`} />
          </Grid>
        </Grid>
      ) : (
        <Typography variant="body2" color="text.secondary">
          먼저 업로드 배치를 선택하면, 이 영역에서 현재 검토 범위와 승격 가능
          상태를 함께 확인할 수 있습니다.
        </Typography>
      )}
    </SectionCard>
  );
}

function SummaryInfoItem({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <Stack spacing={0.35}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600}>
        {value}
      </Typography>
    </Stack>
  );
}
