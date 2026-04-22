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
      description="업로드 행 등록은 최신 진행월 범위 안에서 처리합니다. 운영월 자동 생성은 운영 시작 전 초기 입력 또는 마감 후 신규 계좌/카드 기초 입력에만 제한됩니다."
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
          현재 열린 운영 기간이 없습니다. 운영 시작 전 초기 업로드는 첫
          운영월을 준비할 수 있지만, 운영 중에는 월 운영 화면에서 최신
          진행월을 먼저 열어 주세요.
        </Typography>
      )}
    </SectionCard>
  );
}
