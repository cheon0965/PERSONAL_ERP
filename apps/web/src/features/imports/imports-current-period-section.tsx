'use client';

import { Grid, Typography } from '@mui/material';
import type { AccountingPeriodItem } from '@personal-erp/contracts';
import { appLayout } from '@/shared/ui/layout-metrics';
import { SectionCard } from '@/shared/ui/section-card';
import { StatusChip } from '@/shared/ui/status-chip';

export function ImportsCurrentPeriodSection({
  currentPeriod
}: {
  currentPeriod: AccountingPeriodItem | null;
}) {
  return (
    <SectionCard
      title="현재 운영 월"
      description="업로드 행 등록과 자동 준비 결과는 현재 열린 운영 월 기준으로만 처리됩니다."
    >
      {currentPeriod ? (
        <Grid container spacing={appLayout.fieldGap}>
          <Grid size={{ xs: 12, md: 3 }}>
            <Typography variant="caption" color="text.secondary">
              상태
            </Typography>
            <div>
              <StatusChip label={currentPeriod.status} />
            </div>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Typography variant="caption" color="text.secondary">
              운영 월
            </Typography>
            <Typography variant="body1">{currentPeriod.monthLabel}</Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="caption" color="text.secondary">
              허용 거래일 범위
            </Typography>
            <Typography variant="body1">
              {currentPeriod.startDate.slice(0, 10)} ~{' '}
              {currentPeriod.endDate.slice(0, 10)}
            </Typography>
          </Grid>
        </Grid>
      ) : (
        <Typography variant="body2" color="text.secondary">
          현재 열린 운영 기간이 없습니다. 배치는 미리 올릴 수 있지만 행 등록은
          `월 운영` 화면에서 기간을 연 뒤 진행해야 합니다.
        </Typography>
      )}
    </SectionCard>
  );
}
