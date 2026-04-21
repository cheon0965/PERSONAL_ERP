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
      description="현재 열린 운영 월은 참고 정보입니다. 업로드 행은 다른 월도 등록할 수 있고, 없는 운영 월은 등록 시 자동으로 준비됩니다."
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
          현재 열린 운영 기간이 없어도 업로드 행 등록은 가능합니다. 다만
          잠금된 마감월 데이터는 저장되지 않습니다.
        </Typography>
      )}
    </SectionCard>
  );
}
