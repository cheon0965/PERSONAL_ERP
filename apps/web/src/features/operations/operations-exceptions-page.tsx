'use client';

import Link from 'next/link';
import { Box, Button, Chip, Grid, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { formatDateTime, formatNumber } from '@/shared/lib/format';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import { SummaryCard } from '@/shared/ui/summary-card';
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

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="운영 지원"
        title="예외 처리함"
        description="기준 데이터 부족, 미확정 거래, 업로드 미수집 행, 마감 차단 사유, 실패 이벤트를 처리 우선순위 중심으로 모아봅니다."
      />

      <OperationsSectionNav />

      {exceptionsQuery.error ? (
        <QueryErrorAlert
          title="예외 처리함을 불러오지 못했습니다."
          error={exceptionsQuery.error}
        />
      ) : null}

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <SummaryCard
            title="전체 예외"
            value={formatNumber(exceptions?.totalCount ?? 0, 0)}
            tone="warning"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <SummaryCard
            title="긴급"
            value={formatNumber(exceptions?.criticalCount ?? 0, 0)}
            tone="warning"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <SummaryCard
            title="경고"
            value={formatNumber(exceptions?.warningCount ?? 0, 0)}
            tone="neutral"
          />
        </Grid>
      </Grid>

      <SectionCard
        title="바로 처리할 작업"
        description="각 예외는 실제 해결 화면으로 이동하는 deep link를 제공합니다."
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
