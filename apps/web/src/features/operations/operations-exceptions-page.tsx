'use client';

import Link from 'next/link';
import { Box, Button, Chip, Grid, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { formatDateTime, formatNumber } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import {
  getOperationsExceptions,
  operationsExceptionsQueryKey
} from './operations.api';
import {
  readOperationsExceptionKindLabel,
  readOperationsSeverityColor,
  readOperationsSeverityLabel
} from './operations-labels';
import { OperationsSectionNav } from './operations-section-nav';

export function OperationsExceptionsPage() {
  const exceptionsQuery = useQuery({
    queryKey: operationsExceptionsQueryKey,
    queryFn: getOperationsExceptions
  });
  const exceptions = exceptionsQuery.data;

  useDomainHelp({
    title: '예외 처리함 가이드',
    description:
      '예외 처리함은 미확정 거래, 업로드 문제, 마감 차단 사유를 우선순위대로 모아 보는 화면입니다.',
    primaryEntity: '운영 예외',
    relatedEntities: ['수집 거래', '업로드 배치', '운영 기간'],
    truthSource:
      '예외 항목은 현재 운영 상태에서 즉시 조치가 필요한 항목을 모은 운영 요약입니다.',
    supplementarySections: [
      {
        title: '기본 순서',
        items: [
          '긴급/경고 수량을 먼저 확인하고 긴급 예외부터 처리합니다.',
          '예외 종류가 미확정 거래, 업로드, 기준 데이터, 마감 중 어디에 속하는지 확인합니다.',
          '각 예외의 해결 화면 버튼으로 이동해 원인을 처리합니다.',
          '처리 후 예외 처리함으로 돌아와 같은 항목이 사라졌는지 확인합니다.'
        ]
      },
      {
        title: '이어지는 화면',
        links: [
          {
            title: '월 마감',
            description: '마감 차단 사유와 현재 월 준비 상태를 다시 확인합니다.',
            href: '/operations/month-end',
            actionLabel: '월 마감 보기'
          },
          {
            title: '업로드 운영 현황',
            description: '미수집 행과 실패 배치 기준으로 업로드 관련 예외를 점검합니다.',
            href: '/operations/imports',
            actionLabel: '업로드 현황 보기'
          }
        ]
      }
    ]
  });

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="운영 지원"
        title="예외 처리함"
        description="기준 데이터 부족, 미확정 거래, 업로드 미수집 행, 마감 차단 사유를 처리 우선순위 기준으로 모아봅니다."
        badges={[
          {
            label:
              (exceptions?.criticalCount ?? 0) > 0
                ? '긴급 예외 있음'
                : '긴급 예외 없음',
            color: (exceptions?.criticalCount ?? 0) > 0 ? 'warning' : 'success'
          },
          {
            label: `${formatNumber(exceptions?.totalCount ?? 0, 0)}건`,
            color: (exceptions?.totalCount ?? 0) > 0 ? 'primary' : 'default'
          }
        ]}
        metadata={[
          {
            label: '전체 예외',
            value: `${formatNumber(exceptions?.totalCount ?? 0, 0)}건`
          },
          {
            label: '긴급',
            value: `${formatNumber(exceptions?.criticalCount ?? 0, 0)}건`
          },
          {
            label: '경고',
            value: `${formatNumber(exceptions?.warningCount ?? 0, 0)}건`
          }
        ]}
        primaryActionLabel="월 마감 보기"
        primaryActionHref="/operations/month-end"
        secondaryActionLabel="업로드 현황"
        secondaryActionHref="/operations/imports"
      />

      <OperationsSectionNav />

      {exceptionsQuery.error ? (
        <QueryErrorAlert
          title="예외 처리함을 불러오지 못했습니다."
          error={exceptionsQuery.error}
        />
      ) : null}

      <SectionCard
        title="지금 우선 처리"
        description="운영자가 먼저 확인해야 할 예외 우선순위를 상단에서 바로 읽습니다."
      >
        <Grid container spacing={appLayout.fieldGap}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <ExceptionInfoItem
              label="전체 예외"
              value={`${formatNumber(exceptions?.totalCount ?? 0, 0)}건`}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <ExceptionInfoItem
              label="긴급"
              value={`${formatNumber(exceptions?.criticalCount ?? 0, 0)}건`}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <ExceptionInfoItem
              label="경고"
              value={`${formatNumber(exceptions?.warningCount ?? 0, 0)}건`}
            />
          </Grid>
        </Grid>
      </SectionCard>

      <SectionCard
        title="바로 처리할 작업"
        description="각 예외는 실제 해결 화면으로 이동하는 바로가기 링크를 제공합니다."
      >
        <Stack spacing={1.5}>
          {(exceptions?.items ?? []).length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              현재 처리할 운영 예외가 없습니다.
            </Typography>
          ) : null}
          {(exceptions?.items ?? []).map((item) => (
            <Box
              key={item.id}
              sx={{
                p: 2,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 3
              }}
            >
              <Stack spacing={1.25}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  alignItems={{ md: 'center' }}
                  justifyContent="space-between"
                  spacing={1}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      label={readOperationsSeverityLabel(item.severity)}
                      color={readOperationsSeverityColor(item.severity)}
                      size="small"
                    />
                    <Chip
                      label={readOperationsExceptionKindLabel(item.kind)}
                      variant="outlined"
                      size="small"
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    최근 발생: {formatDateTime(item.lastOccurredAt)}
                  </Typography>
                </Stack>
                <Typography variant="subtitle2">{item.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {item.description}
                </Typography>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  alignItems={{ sm: 'center' }}
                  justifyContent="space-between"
                >
                  <Typography variant="body2">
                    영향 건수: {formatNumber(item.count, 0)}
                  </Typography>
                  <Button component={Link} href={item.href} variant="outlined">
                    {item.primaryActionLabel}
                  </Button>
                </Stack>
              </Stack>
            </Box>
          ))}
        </Stack>
      </SectionCard>
    </Stack>
  );
}

function ExceptionInfoItem({ label, value }: { label: string; value: string }) {
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
