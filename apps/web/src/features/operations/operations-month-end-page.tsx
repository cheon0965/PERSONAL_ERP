'use client';

import Link from 'next/link';
import { Alert, Button, Chip, Grid, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { formatNumber, formatWon } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import {
  getOperationsMonthEnd,
  operationsMonthEndQueryKey
} from './operations.api';
import {
  readOperationsStatusColor,
  readOperationsStatusLabel
} from './operations-labels';
import { OperationsSectionNav } from './operations-section-nav';

export function OperationsMonthEndPage() {
  const monthEndQuery = useQuery({
    queryKey: operationsMonthEndQueryKey,
    queryFn: getOperationsMonthEnd
  });
  const monthEnd = monthEndQuery.data;

  useDomainHelp({
    title: '월 마감 가이드',
    description:
      '월 마감 화면은 현재 운영 월의 마감 가능 여부와 차단 사유를 점검하는 화면입니다.',
    primaryEntity: '운영 기간',
    relatedEntities: [
      '수집 거래',
      '계획 항목',
      '업로드 배치',
      '재무제표 스냅샷',
      '차기 이월'
    ],
    truthSource:
      '마감 가능 여부는 현재 운영 월 기준의 미확정 거래, 실패 행, 남은 계획, 보고 자료 상태를 함께 읽어 판단합니다.',
    supplementarySections: [
      {
        title: '읽는 순서',
        items: [
          '현재 운영 월과 마감 상태를 먼저 확인합니다.',
          '차단 사유를 보고 해결 화면으로 이동합니다.'
        ]
      },
      {
        title: '이어지는 화면',
        links: [
          {
            title: '예외 처리함',
            description: `미확정 거래 ${formatNumber(monthEnd?.unresolvedTransactionCount ?? 0, 0)}건과 차단 사유를 먼저 정리합니다.`,
            href: '/operations/exceptions',
            actionLabel: '예외 처리함 보기'
          },
          {
            title: '업로드 운영 현황',
            description: `업로드 실패 행 ${formatNumber(monthEnd?.failedImportRowCount ?? 0, 0)}건을 다시 확인합니다.`,
            href: '/operations/imports',
            actionLabel: '업로드 현황 보기'
          },
          {
            title: '재무제표 생성 / 선택',
            description: `현재 생성된 스냅샷 ${formatNumber(monthEnd?.financialStatementSnapshotCount ?? 0, 0)}개를 확인합니다.`,
            href: '/financial-statements',
            actionLabel: '재무제표 보기'
          },
          {
            title: '이월 기준 생성 / 선택',
            description: monthEnd?.carryForwardCreated
              ? '다음 월 연결 기준이 이미 생성되어 있습니다.'
              : '월 마감 후 다음 월 연결 기준 생성을 확인합니다.',
            href: '/carry-forwards',
            actionLabel: '차기 이월 보기'
          }
        ]
      }
    ]
  });

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="운영 지원"
        title="월 마감"
        description="현재 월의 마감 가능 여부를 확인하고, 차단 사유와 후속 작업을 바로 정리합니다."
        badges={[
          {
            label: monthEnd?.period?.monthLabel ?? '운영 기간 없음',
            color: monthEnd?.period ? 'primary' : 'default'
          },
          {
            label: readOperationsStatusLabel(
              monthEnd?.closeReadiness ?? 'INFO'
            ),
            color: readOperationsStatusColor(monthEnd?.closeReadiness ?? 'INFO')
          }
        ]}
        metadata={[
          {
            label: '미확정 거래',
            value: `${formatNumber(monthEnd?.unresolvedTransactionCount ?? 0, 0)}건`
          },
          {
            label: '업로드 실패 행',
            value: `${formatNumber(monthEnd?.failedImportRowCount ?? 0, 0)}건`
          },
          {
            label: '남은 계획',
            value: `${formatNumber(monthEnd?.remainingPlanItemCount ?? 0, 0)}건`
          },
          {
            label: '남은 계획 지출',
            value: formatWon(monthEnd?.remainingPlannedExpenseWon ?? 0)
          }
        ]}
        primaryActionLabel="월 운영 화면"
        primaryActionHref="/periods"
        secondaryActionLabel="예외 처리함"
        secondaryActionHref="/operations/exceptions"
      />

      <OperationsSectionNav />

      {monthEndQuery.error ? (
        <QueryErrorAlert
          title="월 마감 요약을 불러오지 못했습니다."
          error={monthEndQuery.error}
        />
      ) : null}

      <Alert
        severity={monthEnd?.closeReadiness === 'READY' ? 'success' : 'warning'}
        variant="outlined"
      >
        {monthEnd?.closeReadinessLabel ?? '월 마감 상태를 계산하는 중입니다.'}
      </Alert>

      <SectionCard
        title="현재 마감 기준"
        description="요약 카드보다 먼저, 지금 월 마감 판단에 직접 영향을 주는 기준을 한 번에 봅니다."
      >
        <Stack spacing={appLayout.cardGap}>
          <Grid container spacing={appLayout.fieldGap}>
            <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
              <MonthEndInfoItem
                label="운영 월"
                value={monthEnd?.period?.monthLabel ?? '운영 기간 없음'}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
              <MonthEndInfoItem
                label="마감 상태"
                value={readOperationsStatusLabel(
                  monthEnd?.closeReadiness ?? 'INFO'
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
              <MonthEndInfoItem
                label="미확정 거래"
                value={`${formatNumber(monthEnd?.unresolvedTransactionCount ?? 0, 0)}건`}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
              <MonthEndInfoItem
                label="업로드 실패 행"
                value={`${formatNumber(monthEnd?.failedImportRowCount ?? 0, 0)}건`}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
              <MonthEndInfoItem
                label="남은 계획"
                value={`${formatNumber(monthEnd?.remainingPlanItemCount ?? 0, 0)}건`}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
              <MonthEndInfoItem
                label="남은 계획 지출"
                value={formatWon(monthEnd?.remainingPlannedExpenseWon ?? 0)}
              />
            </Grid>
          </Grid>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip
              label={`재무제표 ${formatNumber(monthEnd?.financialStatementSnapshotCount ?? 0, 0)}개`}
              color={readOperationsStatusColor(
                (monthEnd?.financialStatementSnapshotCount ?? 0) > 0
                  ? 'READY'
                  : 'INFO'
              )}
            />
            <Chip
              label={
                monthEnd?.carryForwardCreated
                  ? '차기 이월 생성됨'
                  : '차기 이월 확인 필요'
              }
              color={monthEnd?.carryForwardCreated ? 'success' : 'info'}
            />
          </Stack>
        </Stack>
      </SectionCard>

      <SectionCard
        title="마감 차단 사유"
        description="마감 전에 반드시 처리해야 할 항목입니다."
      >
        <Stack spacing={1.25}>
          {(monthEnd?.blockers ?? []).length === 0 ? (
            <Alert severity="success" variant="outlined">
              현재 마감 차단 사유가 없습니다.
            </Alert>
          ) : null}
          {(monthEnd?.blockers ?? []).map((blocker) => (
            <Alert key={blocker} severity="error" variant="outlined">
              {blocker}
            </Alert>
          ))}
          <Button component={Link} href="/operations/exceptions" variant="outlined">
            예외 처리함 보기
          </Button>
        </Stack>
      </SectionCard>

      <SectionCard
        title="마감 전 경고"
        description="차단은 아니지만 운영자가 확인해야 할 항목입니다."
      >
        <Stack spacing={1.25}>
          {(monthEnd?.warnings ?? []).length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              현재 추가 경고가 없습니다.
            </Typography>
          ) : null}
          {(monthEnd?.warnings ?? []).map((warning) => (
            <Alert key={warning} severity="warning" variant="outlined">
              {warning}
            </Alert>
          ))}
        </Stack>
      </SectionCard>
    </Stack>
  );
}

function MonthEndInfoItem({ label, value }: { label: string; value: string }) {
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

