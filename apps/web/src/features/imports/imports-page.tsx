'use client';

import * as React from 'react';
import type { Route } from 'next';
import { Alert, Button, Grid, Stack, Typography } from '@mui/material';
import { useRouter } from 'next/navigation';
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

type ImportsLayout = 'list' | 'detail';

export function ImportsPage({
  mode = 'list',
  selectedBatchId = null
}: {
  mode?: ImportsLayout;
  selectedBatchId?: string | null;
}) {
  const router = useRouter();
  const page = useImportsPage(selectedBatchId, mode);
  const isDetailMode = mode === 'detail';
  const collectableRowCount = page.selectedBatchRows.filter(
    (row) => row.parseStatus === 'PARSED' && !row.createdCollectedTransactionId
  ).length;
  const collectedRowCount = page.selectedBatchRows.filter((row) =>
    Boolean(row.createdCollectedTransactionId)
  ).length;
  const selectedBatchWorkbenchHref = page.selectedBatch
    ? `/imports/${page.selectedBatch.id}`
    : null;
  const pageTitle = isDetailMode ? '업로드 배치 작업대' : '업로드 배치';
  const pageDescription = isDetailMode
    ? '선택한 업로드 배치의 행을 검토하고, 필요한 항목만 수집 거래로 등록하는 전용 작업 화면입니다.'
    : '원본을 업로드 배치로 보관하고, 검토할 배치를 선택해 작업대로 이어집니다.';

  async function handleDeleteSelectedBatch() {
    const deleted = await page.deleteSelectedBatch();

    if (deleted) {
      React.startTransition(() => {
        router.push('/imports' as Route);
      });
    }
  }

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
            label: '업로드 배치',
            value: `${page.batches.length}건`
          },
          {
            label: isDetailMode ? '현재 배치' : '선택 배치',
            value: page.selectedBatch?.fileName ?? '-'
          },
          {
            label: '연결 계좌/카드',
            value: page.selectedBatch?.fundingAccountName ?? '-'
          },
          {
            label: '등록 가능 행',
            value: `${collectableRowCount}건`
          },
          {
            label: '연결 완료 행',
            value: `${collectedRowCount}건`
          }
        ]}
        primaryActionLabel="업로드 배치 등록"
        primaryActionOnClick={page.openUploadDrawer}
        secondaryActionLabel={
          isDetailMode ? '배치 목록 보기' : '수집 거래 보기'
        }
        secondaryActionHref={isDetailMode ? '/imports' : '/transactions'}
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
            isDetailMode={isDetailMode}
            selectedBatchFileName={page.selectedBatch?.fileName ?? null}
            fundingAccountName={page.selectedBatch?.fundingAccountName ?? null}
            rowCount={page.selectedBatchRows.length}
            collectableRowCount={collectableRowCount}
            collectedRowCount={collectedRowCount}
            selectedBatchWorkbenchHref={selectedBatchWorkbenchHref}
            deleteSelectedBatchPending={page.deleteSelectedBatchPending}
            onDeleteSelectedBatch={handleDeleteSelectedBatch}
          />
        </Grid>
      </Grid>

      <ReferenceDataReadinessAlert
        readiness={page.referenceDataReadinessQuery.data ?? null}
        context="import-collection"
      />

      {!isDetailMode ? (
        <ImportBatchesGrid
          batches={page.batches}
          selectedBatchId={page.selectedBatch?.id ?? null}
          onSelectBatch={page.selectBatch}
          helperText="목록에서 배치를 선택한 뒤 선택 배치 작업대로 이동하면 업로드 행 검토와 거래 등록을 이어서 진행할 수 있습니다."
          actionLabel="배치 선택"
        />
      ) : page.selectedBatch ? (
        <ImportedRowsGrid
          selectedBatch={page.selectedBatch}
          rows={page.selectedBatchRows}
          selectedRowId={page.selectedRow?.id ?? null}
          selectedRowIds={page.selectedRowIds}
          selectedRowsCount={page.selectedRowsCount}
          collectableRowCount={page.collectableRowCount}
          selectedCollectableRowCount={page.selectedCollectableRowCount}
          bulkCollectJob={page.bulkCollectJob}
          bulkCollectPending={page.isBulkCollectPending}
          onSelectedRowIdsChange={page.selectRows}
          onPrepareCollect={page.prepareCollectRow}
          onBulkCollect={page.submitBulkCollect}
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
  isDetailMode,
  selectedBatchFileName,
  fundingAccountName,
  rowCount,
  collectableRowCount,
  collectedRowCount,
  selectedBatchWorkbenchHref,
  deleteSelectedBatchPending,
  onDeleteSelectedBatch
}: {
  isDetailMode: boolean;
  selectedBatchFileName: string | null;
  fundingAccountName: string | null;
  rowCount: number;
  collectableRowCount: number;
  collectedRowCount: number;
  selectedBatchWorkbenchHref: string | null;
  deleteSelectedBatchPending: boolean;
  onDeleteSelectedBatch: () => void;
}) {
  return (
    <SectionCard
      title="선택 배치 작업대"
      description={
        isDetailMode
          ? '현재 배치 기준으로 업로드 행 검토와 등록 가능 상태를 바로 확인합니다.'
          : '현재 선택한 배치를 기준으로 작업대 이동 전 검토 범위와 등록 가능 상태를 미리 확인합니다.'
      }
    >
      {selectedBatchFileName ? (
        <Stack spacing={appLayout.fieldGap}>
          <Grid container spacing={appLayout.fieldGap}>
            <Grid size={{ xs: 12, md: 3 }}>
              <SummaryInfoItem
                label="배치 파일"
                value={selectedBatchFileName}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <SummaryInfoItem
                label="연결 계좌/카드"
                value={fundingAccountName ?? '-'}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <SummaryInfoItem label="행 수" value={`${rowCount}건`} />
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <SummaryInfoItem
                label="등록 가능"
                value={`${collectableRowCount}건`}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <SummaryInfoItem
                label="연결 완료"
                value={`${collectedRowCount}건`}
              />
            </Grid>
          </Grid>
          {!isDetailMode && selectedBatchWorkbenchHref ? (
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', sm: 'center' }}
            >
              <Typography variant="body2" color="text.secondary">
                배치를 고른 뒤 작업대로 이동하면 업로드 행별 자동 판정 결과와
                수집 거래 등록을 같은 흐름에서 이어서 처리할 수 있습니다.
              </Typography>
              <Button href={selectedBatchWorkbenchHref} variant="outlined">
                선택 배치 작업대
              </Button>
            </Stack>
          ) : null}
          {isDetailMode ? (
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', sm: 'center' }}
            >
              <Typography variant="body2" color="text.secondary">
                배치 삭제는 연결된 수집 거래가 없는 경우에만 허용됩니다.
              </Typography>
              <Button
                color="error"
                variant="outlined"
                onClick={onDeleteSelectedBatch}
                disabled={deleteSelectedBatchPending}
              >
                배치 삭제
              </Button>
            </Stack>
          ) : null}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          먼저 업로드 배치를 선택하면, 이 영역에서 현재 검토 범위와 등록 가능
          상태를 함께 확인할 수 있습니다.
        </Typography>
      )}
    </SectionCard>
  );
}

function SummaryInfoItem({ label, value }: { label: string; value: string }) {
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
