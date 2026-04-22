'use client';

import type { ReactNode } from 'react';
import { Alert, Stack, Typography } from '@mui/material';
import type { CollectImportedRowPreview } from '@personal-erp/contracts';
import { appLayout } from '@/shared/ui/layout-metrics';
import { StatusChip } from '@/shared/ui/status-chip';

export function CollectPreviewSummary({
  preview
}: {
  preview: CollectImportedRowPreview;
}) {
  return (
    <Stack spacing={1}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={appLayout.fieldGap}
      >
        <SummaryBlock
          label="예상 다음 상태"
          content={
            <StatusChip label={preview.autoPreparation.nextWorkflowStatus} />
          }
        />
        <SummaryBlock
          label="매칭 계획 항목"
          content={
            <Typography variant="body2">
              {preview.autoPreparation.matchedPlanItemTitle ?? '자동 매칭 없음'}
            </Typography>
          }
        />
        <SummaryBlock
          label="적용 카테고리"
          content={
            <Typography variant="body2">
              {preview.autoPreparation.effectiveCategoryName ?? '미확정'}
            </Typography>
          }
        />
      </Stack>
      {preview.autoPreparation.hasDuplicateSourceFingerprint ? (
        <Alert severity="warning" variant="outlined">
          같은 원본 식별값이 이미 있어 자동 확정을 보류합니다.
        </Alert>
      ) : null}
      {preview.autoPreparation.willCreateTargetPeriod ? (
        <Alert severity="info" variant="outlined">
          {readTargetPeriodCreationMessage(preview.autoPreparation)}
        </Alert>
      ) : null}
      {(preview.autoPreparation.potentialDuplicateTransactionCount ?? 0) > 0 ? (
        <Alert severity="warning" variant="outlined">
          같은 거래일·금액·입출금 유형의 기존 거래{' '}
          {preview.autoPreparation.potentialDuplicateTransactionCount}건이 있어
          확인 후 등록해야 합니다.
        </Alert>
      ) : null}
      <Stack spacing={0.5}>
        {preview.autoPreparation.decisionReasons.map((reason) => (
          <Typography
            key={`${preview.importedRowId}-${reason}`}
            variant="body2"
            color="text.secondary"
          >
            - {reason}
          </Typography>
        ))}
      </Stack>
    </Stack>
  );
}

function readTargetPeriodCreationMessage(
  autoPreparation: CollectImportedRowPreview['autoPreparation']
): string {
  const monthLabel = autoPreparation.targetPeriodMonthLabel ?? '대상';

  if (autoPreparation.targetPeriodCreationReason === 'NEW_FUNDING_ACCOUNT') {
    return `${monthLabel} 운영월을 신규 계좌/카드 기초 업로드로 자동 생성합니다.`;
  }

  if (autoPreparation.targetPeriodCreationReason === 'INITIAL_SETUP') {
    return `${monthLabel} 운영월을 운영 시작 전 기초 입력으로 자동 생성합니다.`;
  }

  return `${monthLabel} 운영월을 등록 과정에서 자동 생성합니다.`;
}

export function SummaryBlock({
  label,
  content
}: {
  label: string;
  content: ReactNode;
}) {
  return (
    <Stack spacing={0.4} flex={1}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      {content}
    </Stack>
  );
}
