'use client';

import { Alert } from '@mui/material';
import type { ReferenceDataReadinessSummary } from '@personal-erp/contracts';
import { ReferenceDataReadinessSummarySection } from './reference-data-readiness';

export function ReferenceDataReadinessSection({
  readiness,
  canManageReferenceData
}: {
  readiness: ReferenceDataReadinessSummary | undefined;
  canManageReferenceData: boolean;
}) {
  return (
    <>
      {readiness ? (
        <ReferenceDataReadinessSummarySection readiness={readiness} />
      ) : null}

      <Alert severity="info" variant="outlined">
        {canManageReferenceData
          ? '현재 범위에서는 자금수단과 카테고리를 앱 안에서 직접 추가하고, 이름 수정과 활성 상태 관리를 할 수 있습니다. 자금수단은 비활성 상태에서만 종료(CLOSED)할 수 있고, 종료 후에는 읽기 전용으로 유지됩니다. 잔액 직접 수정은 아직 지원하지 않습니다.'
          : '자금수단/카테고리 직접 관리는 OWNER 또는 MANAGER 역할에서만 가능합니다. 현재 역할은 기준 데이터 현황과 운영 영향을 확인하는 범위로 유지됩니다.'}
      </Alert>
    </>
  );
}
