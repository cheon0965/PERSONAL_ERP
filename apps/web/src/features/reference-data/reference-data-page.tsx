'use client';

import { Stack } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
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
        title: '탭 분리 원칙',
        description:
          '같은 기준 데이터 영역 안에서 준비 상태 점검과 실제 기준 데이터 관리를 탭으로 나눠, 운영 판단과 편집 작업의 문맥을 구분합니다.',
        items: [
          '이 탭에서는 readiness, ownership, 운영 영향 범위만 점검합니다.',
          '자금수단/카테고리 생성·수정과 참조 기준값 확인은 관리 탭에서 수행합니다.',
          '탭 전환만으로 문맥을 바꿀 수 있으므로 별도 강한 이동 CTA는 최소화합니다.'
        ]
      }
    ],
    readModelNote:
      '이 화면은 운영 전 점검용 개요 탭이며, 실제 기준 데이터 편집과 참조 입력 확인은 같은 영역의 관리 탭에서 수행합니다.'
  });

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="기준 데이터"
        title="기준 데이터 준비 상태와 관리 범위"
        description="현재 사업 장부에서 기준 데이터 준비가 충분한지, 그리고 어떤 항목을 앱 안에서 직접 관리할 수 있는지 먼저 점검하는 화면입니다."
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
    </Stack>
  );
}
