'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { Alert, Button, Grid, Stack, Typography } from '@mui/material';
import type { AccountingPeriodItem } from '@personal-erp/contracts';
import { appLayout } from '@/shared/ui/layout-metrics';
import { SectionCard } from '@/shared/ui/section-card';
import {
  FinancialStatementsDetailSections,
  ReportInfoItem,
  readOpeningSourceLabel
} from './financial-statements-page.detail-sections';
import { getFinancialStatements } from './financial-statements.api';

export function FinancialStatementsOverview({
  canGenerate,
  detailHref,
  hasStatements,
  isGenerating,
  onGenerate,
  selectedPeriod,
  view
}: {
  canGenerate: boolean;
  detailHref: Route | null;
  hasStatements: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
  selectedPeriod: AccountingPeriodItem;
  view: Awaited<ReturnType<typeof getFinancialStatements>> | undefined;
}) {
  return (
    <Stack spacing={appLayout.sectionGap}>
      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <SectionCard
            title="선택한 기간 작업대"
            description="여기서는 생성 여부와 다음 이동만 빠르게 판단하고, 상세 해석은 보고서 보기 화면에서 읽습니다."
          >
            <Stack spacing={appLayout.cardGap}>
              <Grid container spacing={appLayout.fieldGap}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <ReportInfoItem
                    label="보고 대상"
                    value={selectedPeriod.monthLabel}
                    description={`상태: ${readPeriodStatusLabel(selectedPeriod.status)}`}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <ReportInfoItem
                    label="스냅샷 상태"
                    value={hasStatements ? '생성됨' : '미생성'}
                    description={
                      hasStatements
                        ? `${view?.snapshots.length ?? 0}개 보고서 스냅샷을 볼 수 있습니다.`
                        : '먼저 공식 재무제표 생성을 실행해야 합니다.'
                    }
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <ReportInfoItem
                    label="전기 비교"
                    value={view?.previousPeriod?.monthLabel ?? '없음'}
                    description={
                      view?.previousPeriod
                        ? '보고서 보기 화면에서 전기 대비 비교를 함께 확인합니다.'
                        : '비교 가능한 직전 잠금 기간이 아직 없습니다.'
                    }
                  />
                </Grid>
              </Grid>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                useFlexGap
                flexWrap="wrap"
              >
                {detailHref && hasStatements ? (
                  <Button
                    component={Link}
                    href={detailHref}
                    variant="contained"
                  >
                    보고서 보기
                  </Button>
                ) : canGenerate ? (
                  <Button
                    variant="contained"
                    color="inherit"
                    onClick={onGenerate}
                    disabled={isGenerating}
                  >
                    {isGenerating ? '스냅샷 생성 중...' : '공식 재무제표 생성'}
                  </Button>
                ) : null}
                {canGenerate && hasStatements ? (
                  <Button
                    variant="outlined"
                    onClick={onGenerate}
                    disabled={isGenerating}
                  >
                    현재 기준으로 다시 생성
                  </Button>
                ) : null}
                {!hasStatements ? (
                  <Button
                    component={Link}
                    href="/journal-entries"
                    variant="outlined"
                  >
                    전표 보기
                  </Button>
                ) : null}
                <Button component={Link} href="/carry-forwards" variant="text">
                  차기 이월 보기
                </Button>
              </Stack>
            </Stack>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <SectionCard
            title="현재 기준선"
            description="상세 보고서로 내려가기 전에 어떤 마감과 이월 기준을 타는지만 먼저 확인합니다."
          >
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                기초 잔액 출처:{' '}
                {readOpeningSourceLabel(
                  view?.basis.openingBalanceSourceKind ?? null
                )}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                기준 월: {view?.basis.sourceMonthLabel ?? '없음'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                차기 이월 기록: {view?.basis.carryForwardRecordId ?? '없음'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                기준 마감 스냅샷:{' '}
                {view?.basis.sourceClosingSnapshotId ?? '없음'}
              </Typography>
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>
    </Stack>
  );
}

export function FinancialStatementsDetail({
  view
}: {
  view: NonNullable<Awaited<ReturnType<typeof getFinancialStatements>>>;
}) {
  return (
    <Stack spacing={appLayout.sectionGap}>
      {view.warnings.map((warning) => (
        <Alert key={warning} severity="info" variant="outlined">
          {warning}
        </Alert>
      ))}

      <SectionCard
        title="보고 기준 요약"
        description="생성 대상, 전기 비교, 기초 잔액 기준선을 먼저 확인한 뒤 상세 보고서로 내려갑니다."
      >
        <Grid container spacing={appLayout.fieldGap}>
          <Grid size={{ xs: 12, md: 4 }}>
            <ReportInfoItem
              label="보고 대상"
              value={view.period.monthLabel}
              description={`상태: ${readPeriodStatusLabel(view.period.status)}`}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <ReportInfoItem
              label="직전 잠금 기간"
              value={view.previousPeriod?.monthLabel ?? '없음'}
              description={
                view.previousPeriod
                  ? '전기 대비 비교 카드와 지표에 사용합니다.'
                  : '비교 가능한 직전 잠금 기간이 아직 없습니다.'
              }
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <ReportInfoItem
              label="기초 잔액 출처"
              value={readOpeningSourceLabel(
                view.basis.openingBalanceSourceKind
              )}
              description={
                view.basis.sourceMonthLabel
                  ? `${view.basis.sourceMonthLabel} 마감/이월에서 이어졌습니다.`
                  : '초기 설정 또는 직접 생성 기준입니다.'
              }
            />
          </Grid>
        </Grid>
      </SectionCard>

      <FinancialStatementsDetailSections view={view} />
    </Stack>
  );
}

export function buildFinancialStatementsDetailHref(periodId: string) {
  return `/financial-statements/${periodId}` as Route;
}

export function readPeriodStatusLabel(status: string) {
  switch (status) {
    case 'LOCKED':
      return '잠금';
    case 'CLOSING':
      return '마감 중';
    case 'IN_REVIEW':
      return '검토 중';
    case 'OPEN':
      return '열림';
    default:
      return status;
  }
}
