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
  getOperationsAlerts,
  operationsAlertsQueryKey
} from './operations.api';
import {
  readOperationsAlertKindLabel,
  readOperationsSeverityColor,
  readOperationsSeverityLabel
} from './operations-labels';
import { OperationsSectionNav } from './operations-section-nav';

export function OperationsAlertsPage() {
  const alertsQuery = useQuery({
    queryKey: operationsAlertsQueryKey,
    queryFn: getOperationsAlerts
  });
  const alerts = alertsQuery.data;

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="운영 지원"
        title="알림 / 이벤트 센터"
        description="마감 차단, 업로드 오류, 기준 데이터 부족, 보안/권한 이벤트를 별도 큐 없이 파생 알림으로 모아봅니다."
      />

      <OperationsSectionNav />

      {alertsQuery.error ? (
        <QueryErrorAlert
          title="운영 알림을 불러오지 못했습니다."
          error={alertsQuery.error}
        />
      ) : null}

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <SummaryCard
            title="전체 알림"
            value={formatNumber(alerts?.totalCount ?? 0, 0)}
            tone="warning"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <SummaryCard
            title="긴급"
            value={formatNumber(alerts?.criticalCount ?? 0, 0)}
            tone="warning"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <SummaryCard
            title="경고"
            value={formatNumber(alerts?.warningCount ?? 0, 0)}
            tone="neutral"
          />
        </Grid>
      </Grid>

      <SectionCard
        title="파생 알림"
        description="읽음/확인 처리는 다음 단계로 미루고, 1차에서는 근거 화면으로 이동하는 데 집중합니다."
      >
        <Stack spacing={1.5}>
          {(alerts?.items ?? []).length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              현재 표시할 운영 알림이 없습니다.
            </Typography>
          ) : null}
          {(alerts?.items ?? []).map((alert) => (
            <Box
              key={alert.id}
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
                  justifyContent="space-between"
                  alignItems={{ md: 'center' }}
                  spacing={1}
                >
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Chip
                      label={readOperationsSeverityLabel(alert.severity)}
                      color={readOperationsSeverityColor(alert.severity)}
                      size="small"
                    />
                    <Chip
                      label={readOperationsAlertKindLabel(alert.kind)}
                      variant="outlined"
                      size="small"
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {formatDateTime(alert.createdAt)}
                  </Typography>
                </Stack>
                <Typography variant="subtitle2">{alert.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {alert.description}
                </Typography>
                {alert.requestId ? (
                  <Typography variant="caption" color="text.secondary">
                    Request ID: {alert.requestId}
                  </Typography>
                ) : null}
                <Button
                  component={Link}
                  href={alert.href}
                  variant="outlined"
                  sx={{ alignSelf: 'flex-start' }}
                >
                  {alert.actionLabel}
                </Button>
              </Stack>
            </Box>
          ))}
        </Stack>
      </SectionCard>
    </Stack>
  );
}
