'use client';

import Link from 'next/link';
import { Box, Button, Chip, Grid, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { formatNumber } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import {
  getOperationsChecklist,
  operationsChecklistQueryKey
} from './operations.api';
import {
  readOperationsStatusColor,
  readOperationsStatusLabel
} from './operations-labels';
import { OperationsSectionNav } from './operations-section-nav';

export function OperationsChecklistPage() {
  const checklistQuery = useQuery({
    queryKey: operationsChecklistQueryKey,
    queryFn: getOperationsChecklist
  });
  const checklist = checklistQuery.data;

  useDomainHelp({
    title: '운영 체크리스트 가이드',
    description:
      '운영 체크리스트는 월 시작, 일일 점검, 월 마감 준비 항목을 상태별로 읽는 화면입니다.',
    primaryEntity: 'OperationsChecklistItem',
    relatedEntities: [
      'AccountingPeriod',
      'CollectedTransaction',
      'ImportBatch'
    ],
    truthSource:
      '체크리스트 상태는 현재 운영 월과 관련 예외, 수집, 마감 read model을 기준으로 계산됩니다.',
    supplementarySections: [
      {
        title: '사용 방식',
        items: [
          '상단 합계와 현재 운영 월을 먼저 확인합니다.',
          '그룹별 항목에서 차단 사유와 이동 경로를 확인합니다.'
        ]
      }
    ]
  });

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="운영 지원"
        title="운영 체크리스트"
        description="월 시작, 일일 점검, 월 마감, 배포 점검 순서로 현재 처리 상태와 이동 경로를 확인합니다."
        badges={[
          {
            label: checklist?.currentPeriod?.monthLabel ?? '운영 기간 없음',
            color: checklist?.currentPeriod ? 'primary' : 'default'
          },
          {
            label:
              (checklist?.totals.actionRequired ?? 0) > 0
                ? '처리 필요 항목 있음'
                : '즉시 처리 항목 없음',
            color:
              (checklist?.totals.actionRequired ?? 0) > 0
                ? 'warning'
                : 'success'
          }
        ]}
        metadata={[
          {
            label: '준비됨',
            value: `${formatNumber(checklist?.totals.ready ?? 0, 0)}건`
          },
          {
            label: '처리 필요',
            value: `${formatNumber(checklist?.totals.actionRequired ?? 0, 0)}건`
          },
          {
            label: '차단',
            value: `${formatNumber(checklist?.totals.blocked ?? 0, 0)}건`
          }
        ]}
        primaryActionLabel="월 마감 보기"
        primaryActionHref="/operations/month-end"
        secondaryActionLabel="예외 처리함"
        secondaryActionHref="/operations/exceptions"
      />

      <OperationsSectionNav />

      {checklistQuery.error ? (
        <QueryErrorAlert
          title="운영 체크리스트를 불러오지 못했습니다."
          error={checklistQuery.error}
        />
      ) : null}

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <SectionCard
            title="지금 우선 확인"
            description="운영자가 먼저 확인해야 할 현재 월 기준과 점검 규모를 빠르게 보여줍니다."
          >
            <Grid container spacing={appLayout.fieldGap}>
              <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                <ChecklistInfoItem
                  label="운영 월"
                  value={
                    checklist?.currentPeriod?.monthLabel ?? '운영 기간 없음'
                  }
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                <ChecklistInfoItem
                  label="준비됨"
                  value={`${formatNumber(checklist?.totals.ready ?? 0, 0)}건`}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                <ChecklistInfoItem
                  label="처리 필요"
                  value={`${formatNumber(checklist?.totals.actionRequired ?? 0, 0)}건`}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                <ChecklistInfoItem
                  label="차단"
                  value={`${formatNumber(checklist?.totals.blocked ?? 0, 0)}건`}
                />
              </Grid>
            </Grid>
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <SectionCard
            title="자주 여는 후속 화면"
            description="체크리스트를 확인한 뒤 바로 이어서 처리하는 대표 운영 화면입니다."
          >
            <Stack spacing={1.25}>
              <OperationsNavCard
                title="월 마감"
                description="현재 월 마감 기준과 차단 사유를 다시 확인합니다."
                href="/operations/month-end"
                actionLabel="월 마감 보기"
              />
              <OperationsNavCard
                title="예외 처리함"
                description="처리 필요 또는 차단 항목이 실제로 어떤 예외에서 왔는지 추적합니다."
                href="/operations/exceptions"
                actionLabel="예외 처리 보기"
              />
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>

      <Grid container spacing={appLayout.sectionGap}>
        {(checklist?.groups ?? []).map((group) => (
          <Grid key={group.key} size={{ xs: 12, lg: 6 }}>
            <SectionCard title={group.title} description={group.description}>
              <Stack spacing={1.5}>
                {group.items.map((item) => (
                  <Box
                    key={item.id}
                    sx={{
                      p: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 3,
                      backgroundColor: 'grey.50'
                    }}
                  >
                    <Stack spacing={1.25}>
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        alignItems={{ sm: 'center' }}
                        justifyContent="space-between"
                        spacing={1}
                      >
                        <Typography variant="subtitle2">
                          {item.title}
                        </Typography>
                        <Chip
                          label={readOperationsStatusLabel(item.status)}
                          color={readOperationsStatusColor(item.status)}
                          size="small"
                        />
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {item.description}
                      </Typography>
                      <Typography variant="body2">{item.detail}</Typography>
                      {item.blockingReason ? (
                        <Typography variant="caption" color="error">
                          {item.blockingReason}
                        </Typography>
                      ) : null}
                      <Button
                        component={Link}
                        href={item.href}
                        variant="outlined"
                        size="small"
                        sx={{ alignSelf: 'flex-start' }}
                      >
                        {item.actionLabel}
                      </Button>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </SectionCard>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}

function ChecklistInfoItem({ label, value }: { label: string; value: string }) {
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

function OperationsNavCard({
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
    <Stack
      spacing={1}
      sx={{
        p: appLayout.cardPadding,
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.default'
      }}
    >
      <Typography variant="subtitle2">{title}</Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          display: '-webkit-box',
          overflow: 'hidden',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 2,
          lineHeight: 1.7
        }}
      >
        {description}
      </Typography>
      <div>
        <Button component={Link} href={href} variant="outlined">
          {actionLabel}
        </Button>
      </div>
    </Stack>
  );
}
