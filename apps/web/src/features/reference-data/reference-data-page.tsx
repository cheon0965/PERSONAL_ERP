'use client';

import Link from 'next/link';
import { Button, Grid, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import {
  getReferenceDataReadiness,
  referenceDataReadinessQueryKey
} from './reference-data.api';
import { ReferenceDataReadinessSection } from './reference-data-readiness-section';
import { ReferenceDataSectionNav } from './reference-data-section-nav';

export function ReferenceDataPage() {
  const { user } = useAuthSession();
  const readinessQuery = useQuery({
    queryKey: referenceDataReadinessQueryKey,
    queryFn: getReferenceDataReadiness
  });

  const currentWorkspace = user?.currentWorkspace ?? null;
  const membershipRole = currentWorkspace?.membership.role ?? null;
  const canManageReferenceData =
    membershipRole === 'OWNER' || membershipRole === 'MANAGER';

  useDomainHelp({
    title: '기준 데이터 준비 상태와 관리 범위',
    description:
      '이 화면은 현재 사업 장부의 기준 데이터 readiness와 ownership를 먼저 점검해, 다음 운영 단계로 넘어가도 되는지 판단하게 돕습니다.',
    primaryEntity: '기준 데이터 준비 상태',
    relatedEntities: ['자금수단', '거래 분류', '계정과목', '거래 유형'],
    truthSource:
      '준비 상태의 단일 판정 원천은 서버가 계산한 reference-data readiness 요약입니다.',
    supplementarySections: [
      {
        title: '현재 작업 문맥',
        description:
          '기준 데이터 readiness는 로그인한 사용자의 현재 사업 장부 문맥 안에서만 판정됩니다.',
        facts: [
          {
            label: '사업장',
            value: currentWorkspace
              ? `${currentWorkspace.tenant.name} (${currentWorkspace.tenant.slug})`
              : '-'
          },
          {
            label: '장부',
            value: currentWorkspace?.ledger?.name ?? '-'
          },
          {
            label: '권한',
            value: currentWorkspace?.membership.role ?? '-'
          }
        ]
      },
      {
        title: '화면 분리 원칙',
        description:
          '준비 상태와 관리 범위를 확인하는 화면과, 실제 기준 데이터를 조회·수정하는 화면을 분리해 운영 판단과 편집 작업의 문맥을 나눴습니다.',
        items: [
          '이 화면에서는 readiness, ownership, 운영 영향 범위만 점검합니다.',
          '실제 자금수단/카테고리 생성·수정과 참조 기준값 확인은 기준 데이터 관리 화면에서 수행합니다.',
          '읽기 전용 기준값인 계정과목/거래유형도 관리 화면에서 별도로 확인합니다.'
        ]
      }
    ],
    readModelNote:
      '이 화면은 운영 전 점검용 개요 화면이며, 실제 기준 데이터 편집과 참조 입력 확인은 분리된 관리 화면으로 이동해 수행합니다.'
  });

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="기준 데이터"
        title="기준 데이터 준비 상태와 관리 범위"
        description="현재 사업 장부에서 기준 데이터 준비가 충분한지, 그리고 어떤 항목을 앱 안에서 직접 관리할 수 있는지 먼저 점검하는 화면입니다."
        primaryActionLabel="기준 데이터 관리 열기"
        primaryActionHref="/reference-data/manage"
      />

      <ReferenceDataSectionNav />

      {readinessQuery.error ? (
        <QueryErrorAlert
          title="기준 데이터 준비 상태를 불러오지 못했습니다."
          error={readinessQuery.error}
        />
      ) : null}

      <ReferenceDataReadinessSection
        readiness={readinessQuery.data}
        canManageReferenceData={canManageReferenceData}
      />

      <SectionCard
        title="분리된 화면 역할"
        description="준비 상태 확인과 실제 기준 데이터 편집을 나눠서, 운영 판단과 편집 작업이 서로 섞이지 않도록 구성했습니다."
      >
        <Grid container spacing={appLayout.sectionGap}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack spacing={1.25}>
              <Typography variant="subtitle2">
                이 화면에서 확인하는 항목
              </Typography>
              <Typography variant="body2" color="text.secondary">
                readiness 판정, ownership 범위, 책임 역할, 운영 영향 같은 준비
                상태 정보를 먼저 확인합니다.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                현재 역할이 직접 정비 가능한 범위인지도 여기서 함께 확인합니다.
              </Typography>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack spacing={1.25}>
              <Typography variant="subtitle2">
                관리 화면에서 수행하는 작업
              </Typography>
              <Typography variant="body2" color="text.secondary">
                자금수단과 카테고리 생성·수정·상태 변경, 계정과목/거래유형
                조회를 별도 화면에서 수행합니다.
              </Typography>
              <div>
                <Button
                  component={Link}
                  href="/reference-data/manage"
                  variant="contained"
                  size="small"
                >
                  기준 데이터 관리로 이동
                </Button>
              </div>
            </Stack>
          </Grid>
        </Grid>
      </SectionCard>
    </Stack>
  );
}
