'use client';

import Link from 'next/link';
import { Alert, Button, Grid, Stack, Typography } from '@mui/material';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { SectionCard } from '@/shared/ui/section-card';
import { AdminSectionNav } from './admin-section-nav';
import { readMembershipRoleLabel } from './admin-labels';

export function AdminHomePage() {
  const { user } = useAuthSession();
  const role = user?.currentWorkspace?.membership.role ?? null;
  const canReadMembers = role === 'OWNER' || role === 'MANAGER';
  const canReadLogs = role === 'OWNER';

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="관리자"
        title="관리자 작업"
        description="현재 사업장 문맥 안에서 멤버와 감사 로그를 확인합니다."
      />

      <AdminSectionNav />

      {!canReadMembers ? (
        <Alert severity="warning" variant="outlined">
          관리자 영역은 소유자 또는 관리자 권한에서 사용할 수 있습니다. 현재
          권한은 {readMembershipRoleLabel(role)} 입니다.
        </Alert>
      ) : null}

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, md: 6 }}>
          <SectionCard
            title="회원관리"
            description="현재 사업장 멤버의 역할과 상태를 확인하고 초대 흐름을 시작합니다."
          >
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                멤버 목록은 소유자와 관리자가 볼 수 있고, 역할과 상태 변경은
                소유자만 실행합니다.
              </Typography>
              <Button
                component={Link}
                href="/admin/members"
                variant="contained"
                disabled={!canReadMembers}
              >
                회원관리 열기
              </Button>
            </Stack>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <SectionCard
            title="로그관리"
            description="회원관리 명령과 감사 이벤트를 requestId 기준으로 추적합니다."
          >
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                1차 범위의 감사 로그 조회는 소유자 권한에서만 열립니다.
              </Typography>
              <Button
                component={Link}
                href="/admin/logs"
                variant="contained"
                disabled={!canReadLogs}
              >
                로그관리 열기
              </Button>
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>
    </Stack>
  );
}
