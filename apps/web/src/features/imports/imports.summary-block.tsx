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
