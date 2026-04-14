'use client';

import Link from 'next/link';
import { Box, Button, Chip, Grid, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { formatNumber } from '@/shared/lib/format';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import { SummaryCard } from '@/shared/ui/summary-card';
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

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="운영 지원"
        title="운영 체크리스트"
        description="월 시작 전, 일일 점검, 월 마감 전, 배포/운영 점검 순서로 현재 처리 상태와 이동 CTA를 확인합니다."
      />

      <OperationsSectionNav />

      {checklistQuery.error ? (
        <QueryErrorAlert
          title="운영 체크리스트를 불러오지 못했습니다."
          error={checklistQuery.error}
        />
      ) : null}

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <SummaryCard
            title="준비됨"
            value={formatNumber(checklist?.totals.ready ?? 0, 0)}
            tone="success"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <SummaryCard
            title="처리 필요"
            value={formatNumber(checklist?.totals.actionRequired ?? 0, 0)}
            tone="warning"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <SummaryCard
            title="차단"
            value={formatNumber(checklist?.totals.blocked ?? 0, 0)}
            tone="warning"
          />
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
                        <Typography variant="subtitle2">{item.title}</Typography>
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
