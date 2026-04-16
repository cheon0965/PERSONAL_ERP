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
  const workspaceLabel = currentWorkspace
    ? `${currentWorkspace.tenant.name} (${currentWorkspace.tenant.slug})`
    : '-';
  const ledgerLabel = currentWorkspace?.ledger?.name ?? '-';

  useDomainHelp({
    title: '기준 데이터 준비 상태 사용 가이드',
    description:
      '이 화면은 월 운영을 시작하기 전에 자금수단, 카테고리, 계정과목, 거래유형이 운영 가능한 상태인지 한 번에 점검하는 곳입니다. 막히는 화면이 있으면 먼저 readiness 부족 항목을 확인합니다.',
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
        title: '바로 쓰는 순서',
        description:
          '준비 상태 탭에서는 부족한 기준을 먼저 찾고, 필요한 경우 관리 탭으로 넘어가 보완합니다.',
        items: [
          '준비 상태 요약에서 월 운영, 거래 입력, 업로드 승격에 영향을 주는 부족 항목을 확인합니다.',
          '자금수단이나 카테고리가 부족하면 기준 데이터 관리 탭에서 추가합니다.',
          '계정과목과 거래유형은 system-managed 항목이므로 존재 여부와 활성 상태를 확인합니다.',
          'readiness가 준비되면 월 운영 화면에서 운영 기간을 엽니다.'
        ]
      }
    ],
    readModelNote:
      '이 화면은 운영 전 점검용 개요 탭입니다. 실제 자금수단/카테고리 편집과 참조 기준값 확인은 같은 영역의 관리 탭에서 수행합니다.'
  });

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="기준 데이터"
        title="기준 데이터 준비 상태"
        description="월 운영 전 준비 상태를 먼저 점검하고, 직접 관리가 필요한 항목만 다음 탭에서 정리합니다."
        badges={[
          {
            label: canManageReferenceData ? '관리 가능' : '조회 전용',
            color: canManageReferenceData ? 'primary' : 'default'
          }
        ]}
        metadata={[
          { label: '사업장', value: workspaceLabel },
          { label: '장부', value: ledgerLabel },
          { label: '권한', value: membershipRole ?? '-' }
        ]}
        primaryActionLabel="자금수단"
        primaryActionHref="/reference-data/funding-accounts"
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
