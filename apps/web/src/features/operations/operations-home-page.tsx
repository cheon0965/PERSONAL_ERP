'use client';

import Link from 'next/link';
import { Button, Chip, Grid, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { formatNumber } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { brandTokens } from '@/shared/theme/tokens';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
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
  const monthEndStatusLabel = readOperationsStatusLabel(
    summary?.monthEnd.closeReadiness ?? 'INFO'
  );
  const priorityCards = [
    {
      eyebrow: '오늘 처리',
      title: '운영 체크리스트',
      value: `${formatNumber(summary?.checklist.totals.actionRequired ?? 0, 0)}건`,
      detail: '일일 점검과 월 마감 전 확인이 필요한 항목입니다.',
      actionLabel: '체크리스트 보기',
      href: '/operations/checklist',
      tone:
        (summary?.checklist.totals.actionRequired ?? 0) > 0
          ? 'warning'
          : 'success'
    },
    {
      eyebrow: '예외 처리',
      title: '예외 처리함',
      value: `${formatNumber(summary?.exceptions.totalCount ?? 0, 0)}건`,
      detail: '미확정 거래와 마감 차단 사유를 우선 정리합니다.',
      actionLabel: '예외 처리',
      href: '/operations/exceptions',
      tone: (summary?.exceptions.totalCount ?? 0) > 0 ? 'warning' : 'success'
    },
    {
      eyebrow: '월 마감',
      title: '마감 준비 상태',
      value: monthEndStatusLabel,
      detail:
        summary?.monthEnd.closeReadiness === 'READY'
          ? '현재 운영 월이 마감 준비 상태입니다.'
          : `미확정 거래 ${formatNumber(summary?.monthEnd.unresolvedTransactionCount ?? 0, 0)}건, 남은 계획 ${formatNumber(summary?.monthEnd.remainingPlanItemCount ?? 0, 0)}건`,
      actionLabel: '마감 점검',
      href: '/operations/month-end',
      tone: summary?.monthEnd.closeReadiness === 'READY' ? 'success' : 'warning'
    }
  ] as const;
  const groupedLinks = [
    {
      title: '월 마감 준비',
      description:
        '월 마감과 공식 보고 자료 생성 흐름을 같은 묶음으로 확인합니다.',
      items: [
        {
          title: '월 마감 대시보드',
          description: `현재 상태 ${monthEndStatusLabel}. 재무제표 ${formatNumber(summary?.monthEnd.financialStatementSnapshotCount ?? 0, 0)}개, 차기 이월 ${summary?.monthEnd.carryForwardCreated ? '생성됨' : '확인 필요'}`,
          href: '/operations/month-end',
          actionLabel: '월 마감 보기'
        },
        {
          title: '재무제표',
          description:
            '잠금된 월의 공식 보고 스냅샷을 생성하고 전기 비교를 확인합니다.',
          href: '/financial-statements',
          actionLabel: '공식 보고 보기'
        },
        {
          title: '차기 이월',
          description:
            '잠금된 월의 마감 결과를 다음 월 기초 잔액 기준으로 연결합니다.',
          href: '/carry-forwards',
          actionLabel: '이월 기준 보기'
        }
      ]
    },
    {
      title: '운영 도구',
      description: '수집, 반출, 메모 같은 운영 실행 도구를 묶어 둡니다.',
      items: [
        {
          title: '업로드 운영 현황',
          description: `미수집 ${formatNumber(summary?.imports.uncollectedRowCount ?? 0, 0)}건, 실패 ${formatNumber(summary?.monthEnd.failedImportRowCount ?? 0, 0)}건을 중심으로 점검합니다.`,
          href: '/operations/imports',
          actionLabel: '업로드 현황'
        },
        {
          title: '백업 / 내보내기',
          description:
            '기준 데이터와 거래, 전표, 보고 스냅샷을 CSV로 반출합니다.',
          href: '/operations/exports',
          actionLabel: '반출하기'
        },
        {
          title: '운영 메모 / 인수인계',
          description:
            '월 마감, 예외 처리, 후속 조치 메모를 남겨 다음 흐름을 연결합니다.',
          href: '/operations/notes',
          actionLabel: '메모 보기'
        }
      ]
    },
    {
      title: '시스템 / 감사',
      description: '서비스 상태와 운영 알림을 별도 묶음으로 분리해 봅니다.',
      items: [
        {
          title: '시스템 상태',
          description:
            '서비스, 데이터베이스, 메일 발송과 최근 운영 활동 상태를 확인합니다.',
          href: '/operations/status',
          actionLabel: '상태 점검'
        },
        {
          title: '알림 / 이벤트 센터',
          description:
            '마감 차단, 업로드 오류, 보안 경고를 파생 알림으로 모아봅니다.',
          href: '/operations/alerts',
          actionLabel: '알림 보기'
        }
      ]
    }
  ] as const;

  useDomainHelp({
    title: '운영 허브 화면 도움말',
    description:
      '운영 허브는 오늘 처리할 운영 항목과 월 마감 준비 상태를 빠르게 나누어 보는 화면입니다.',
    primaryEntity: '운영 메모 / 운영 기간',
    relatedEntities: [
      '수집 거래',
      '업로드 배치',
      '재무제표 스냅샷',
      '차기 이월 기록'
    ],
    truthSource:
      '운영 허브의 수치는 체크리스트, 예외, 업로드, 마감 준비 데이터를 요약한 운영 판단용 값입니다.',
    supplementarySections: [
      {
        title: '확인 순서',
        items: [
          '오늘 우선 확인 카드에서 처리 필요 항목, 예외, 미수집 행을 먼저 봅니다.',
          '월 마감 준비 상태가 경고면 월 마감 또는 예외 처리함으로 먼저 이동합니다.',
          '업로드나 시스템 이슈가 보이면 해당 작업군 카드의 버튼으로 바로 이동합니다.',
          '작업 후 이 화면으로 돌아와 숫자가 줄었는지 다시 확인합니다.'
        ]
      },
      ...groupedLinks.map((group) => ({
        title: group.title,
        description: group.description,
        links: group.items
      }))
    ]
  });

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="운영 지원"
        title="운영 허브"
        description="오늘 바로 처리해야 할 운영 리스크와 월 마감 준비 상태를 한곳에서 빠르게 확인합니다."
        badges={[
          {
            label: summary?.monthEnd.period?.monthLabel ?? '운영 기간 없음',
            color: summary?.monthEnd.period ? 'primary' : 'default'
          },
          {
            label: monthEndStatusLabel,
            color:
              summary?.monthEnd.closeReadiness === 'READY'
                ? 'success'
                : 'warning'
          }
        ]}
        metadata={[
          {
            label: '처리 필요 항목',
            value: `${formatNumber(summary?.checklist.totals.actionRequired ?? 0, 0)}건`
          },
          {
            label: '전체 예외',
            value: `${formatNumber(summary?.exceptions.totalCount ?? 0, 0)}건`
          },
          {
            label: '미수집 행',
            value: `${formatNumber(summary?.imports.uncollectedRowCount ?? 0, 0)}건`
          }
        ]}
        primaryActionLabel="예외 처리함 보기"
        primaryActionHref="/operations/exceptions"
        secondaryActionLabel="월 마감 보기"
        secondaryActionHref="/operations/month-end"
      />

      <OperationsSectionNav />

      {summaryQuery.error ? (
        <QueryErrorAlert
          title="운영 허브 요약을 불러오지 못했습니다."
          error={summaryQuery.error}
        />
      ) : null}

      <SectionCard
        title="오늘 우선 확인"
        description="링크 모음보다 먼저, 지금 처리해야 할 운영 작업을 세 칸으로 압축해 보여줍니다."
      >
        <Grid container spacing={appLayout.sectionGap}>
          {priorityCards.map((item) => (
            <Grid key={item.title} size={{ xs: 12, md: 4 }}>
              <PriorityCard {...item} />
            </Grid>
          ))}
        </Grid>
      </SectionCard>
    </Stack>
  );
}

function PriorityCard({
  eyebrow,
  title,
  value,
  detail,
  actionLabel,
  href,
  tone
}: {
  eyebrow: string;
  title: string;
  value: string;
  detail: string;
  actionLabel: string;
  href: string;
  tone: 'success' | 'warning';
}) {
  return (
    <Stack
      spacing={1.5}
      sx={{
        height: '100%',
        p: appLayout.cardPadding,
        borderRadius: 3,
        border: '1px solid',
        borderColor: tone === 'success' ? 'success.light' : 'warning.light',
        backgroundColor:
          tone === 'success'
            ? brandTokens.palette.successSoft
            : brandTokens.palette.warningSoft
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        spacing={1}
        alignItems="flex-start"
      >
        <Typography variant="overline" color="text.secondary">
          {eyebrow}
        </Typography>
        <Chip
          label={tone === 'success' ? '정상 흐름' : '우선 확인'}
          size="small"
          color={tone}
          variant="outlined"
        />
      </Stack>
      <Stack spacing={0.5}>
        <Typography variant="h6">{title}</Typography>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          {value}
        </Typography>
      </Stack>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', lineHeight: 1.7 }}
      >
        {detail}
      </Typography>
      <div>
        <Button component={Link} href={href} variant="contained" color={tone}>
          {actionLabel}
        </Button>
      </div>
    </Stack>
  );
}
