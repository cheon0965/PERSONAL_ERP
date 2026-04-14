'use client';

import Link from 'next/link';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import { Button, Grid, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { formatNumber } from '@/shared/lib/format';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import { SummaryCard } from '@/shared/ui/summary-card';
import {
  getOperationsSummary,
  operationsSummaryQueryKey
} from './operations.api';
import { OperationsSectionNav } from './operations-section-nav';
import { readOperationsStatusLabel } from './operations-labels';

export function OperationsHomePage() {
  const summaryQuery = useQuery({
    queryKey: operationsSummaryQueryKey,
    queryFn: getOperationsSummary
  });
  const summary = summaryQuery.data;

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="운영 지원"
        title="운영 허브"
        description="체크리스트, 예외 처리함, 월 마감, 업로드 현황을 한곳에서 묶어 당장 처리할 운영 리스크를 빠르게 확인합니다."
        primaryActionLabel="예외 처리함 보기"
        primaryActionHref="/operations/exceptions"
      />

      <OperationsSectionNav />

      {summaryQuery.error ? (
        <QueryErrorAlert
          title="운영 허브 요약을 불러오지 못했습니다."
          error={summaryQuery.error}
        />
      ) : null}

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            eyebrow="체크리스트"
            title="처리 필요 항목"
            value={formatNumber(summary?.checklist.totals.actionRequired ?? 0, 0)}
            subtitle="일일 점검과 월 마감 전 확인이 필요한 항목입니다."
            tone="warning"
            icon={AssignmentTurnedInRoundedIcon}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            eyebrow="예외 처리함"
            title="전체 예외 건수"
            value={formatNumber(summary?.exceptions.totalCount ?? 0, 0)}
            subtitle="기준 데이터, 거래, 업로드, 마감 차단 사유를 합산합니다."
            tone="warning"
            icon={ErrorOutlineRoundedIcon}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            eyebrow="월 마감"
            title="마감 상태"
            value={readOperationsStatusLabel(
              summary?.monthEnd.closeReadiness ?? 'INFO'
            )}
            subtitle={summary?.monthEnd.period?.monthLabel ?? '운영 기간 없음'}
            tone={summary?.monthEnd.closeReadiness === 'READY' ? 'success' : 'warning'}
            icon={EventAvailableRoundedIcon}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            eyebrow="업로드"
            title="미수집 행"
            value={formatNumber(summary?.imports.uncollectedRowCount ?? 0, 0)}
            subtitle={`${formatNumber((summary?.imports.collectionRate ?? 0) * 100, 1)}% 수집 승격률`}
            tone="neutral"
            icon={UploadFileRoundedIcon}
          />
        </Grid>
      </Grid>

      <Grid container spacing={appLayout.sectionGap}>
        <HubCard
          title="운영 체크리스트"
          description="월 시작 전, 일일 점검, 월 마감 전, 배포 전 확인 항목을 운영 순서대로 봅니다."
          href="/operations/checklist"
          actionLabel="체크리스트 보기"
        />
        <HubCard
          title="예외 처리함"
          description="미확정 거래, 업로드 미수집 행, 기준 데이터 부족, 마감 차단 사유를 한곳에서 봅니다."
          href="/operations/exceptions"
          actionLabel="예외 처리"
        />
        <HubCard
          title="월 마감 대시보드"
          description="현재 월의 마감 가능 여부와 차단 사유, 공식 산출물 생성 상태를 확인합니다."
          href="/operations/month-end"
          actionLabel="마감 점검"
        />
        <HubCard
          title="업로드 운영 현황"
          description="최근 업로드 배치의 실패 행, 미수집 행, 수집 승격률을 운영자 관점에서 봅니다."
          href="/operations/imports"
          actionLabel="업로드 현황"
        />
        <HubCard
          title="시스템 상태 / 헬스"
          description="API, DB readiness, 메일 발송 경계와 최근 운영 활동 상태를 확인합니다."
          href="/operations/status"
          actionLabel="상태 점검"
        />
        <HubCard
          title="알림 / 이벤트 센터"
          description="마감 차단, 업로드 오류, 보안/권한 경고를 파생 알림으로 모아봅니다."
          href="/operations/alerts"
          actionLabel="알림 보기"
        />
        <HubCard
          title="백업 / 내보내기"
          description="기준 데이터, 수집 거래, 전표, 재무제표 스냅샷을 감사 로그를 남기며 CSV로 반출합니다."
          href="/operations/exports"
          actionLabel="CSV 반출"
        />
        <HubCard
          title="운영 메모 / 인수인계"
          description="월 마감, 예외 처리, 알림 후속 조치 메모를 남겨 운영 흐름을 다음 담당자에게 연결합니다."
          href="/operations/notes"
          actionLabel="메모 남기기"
        />
      </Grid>
    </Stack>
  );
}

function HubCard({
  title,
  description,
  href,
  actionLabel
}: {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
}) {
  return (
    <Grid size={{ xs: 12, md: 6 }}>
      <SectionCard title={title} description={description}>
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            운영 허브의 숫자는 기존 회계 흐름을 대체하지 않고, 처리 우선순위를
            빠르게 정리하는 read-only 요약입니다.
          </Typography>
          <Button component={Link} href={href} variant="outlined">
            {actionLabel}
          </Button>
        </Stack>
      </SectionCard>
    </Grid>
  );
}
