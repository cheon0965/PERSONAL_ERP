'use client';

import Link from 'next/link';
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  Stack,
  Typography
} from '@mui/material';
import type {
  ReferenceDataReadinessCheckItem,
  ReferenceDataReadinessSummary
} from '@personal-erp/contracts';
import { membershipRoleLabelMap } from '@/shared/auth/auth-labels';
import { appLayout } from '@/shared/ui/layout-metrics';
import { SectionCard } from '@/shared/ui/section-card';

export type ReferenceDataReadinessContext =
  | 'monthly-operation'
  | 'transaction-entry'
  | 'import-collection';

export function ReferenceDataReadinessSummarySection({
  readiness
}: {
  readiness: ReferenceDataReadinessSummary;
}) {
  return (
    <SectionCard
      title="준비 상태와 관리 범위"
      description="기준 데이터 준비 상태와 관리 범위를 기준으로, 다음 운영 단계가 자연스럽게 이어질 수 있는지 확인합니다."
    >
      <Alert
        severity={readiness.status === 'READY' ? 'success' : 'warning'}
        variant="outlined"
      >
        {readiness.status === 'READY'
          ? '현재 사업장과 장부의 기준 데이터 준비가 완료되어 월 운영, 수집 거래, 업로드 행 등록, 반복 규칙 흐름을 이어갈 수 있습니다.'
          : `기준 데이터 준비가 아직 완전하지 않습니다. 현재 부족한 항목: ${formatMissingRequirements(readiness)}.`}
      </Alert>

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, md: 3 }}>
          <ReadinessCapabilityBox
            label="월 운영 시작"
            ready={readiness.isReadyForMonthlyOperation}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <ReadinessCapabilityBox
            label="수집 거래 입력"
            ready={readiness.isReadyForTransactionEntry}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <ReadinessCapabilityBox
            label="업로드 행 등록"
            ready={readiness.isReadyForImportCollection}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <ReadinessCapabilityBox
            label="반복 규칙 준비"
            ready={readiness.isReadyForRecurringRuleSetup}
          />
        </Grid>
      </Grid>

      <Stack spacing={1.5}>
        {readiness.checks.map((check) => (
          <ReferenceDataCheckCard key={check.key} check={check} />
        ))}
      </Stack>
    </SectionCard>
  );
}

export function ReferenceDataReadinessAlert({
  readiness,
  context
}: {
  readiness: ReferenceDataReadinessSummary | null;
  context: ReferenceDataReadinessContext;
}) {
  if (!readiness || isContextReady(readiness, context)) {
    return null;
  }

  const canCurrentRoleOwnPreparation =
    readiness.currentRole === 'OWNER' || readiness.currentRole === 'MANAGER';
  const missingChecks = readiness.checks.filter((check) => !check.ready);
  const hasDirectEditAvailable = missingChecks.some(
    (check) => check.inProductEditEnabled
  );
  const allMissingChecksDirectEditable =
    missingChecks.length > 0 &&
    missingChecks.every((check) => check.inProductEditEnabled);

  return (
    <Alert
      severity="warning"
      variant="outlined"
      action={
        <Button component={Link} href="/reference-data" size="small">
          기준 데이터 확인
        </Button>
      }
    >
      <Stack spacing={0.4}>
        <Typography variant="body2" fontWeight={600}>
          {readContextHeadline(context)}
        </Typography>
        <Typography variant="body2">
          현재 부족한 항목: {formatMissingRequirements(readiness)}.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {readAlertGuidanceMessage({
            canCurrentRoleOwnPreparation,
            hasDirectEditAvailable,
            allMissingChecksDirectEditable
          })}
        </Typography>
      </Stack>
    </Alert>
  );
}

function ReadinessCapabilityBox({
  label,
  ready
}: {
  label: string;
  ready: boolean;
}) {
  return (
    <Box
      sx={{
        p: appLayout.cardPadding,
        borderRadius: 2,
        border: (theme) => `1px solid ${theme.palette.divider}`,
        bgcolor: 'background.default',
        height: '100%'
      }}
    >
      <Stack spacing={0.8}>
        <Typography variant="subtitle2">{label}</Typography>
        <Chip
          label={ready ? '준비됨' : '조치 필요'}
          size="small"
          color={ready ? 'success' : 'warning'}
          sx={{ alignSelf: 'flex-start' }}
        />
      </Stack>
    </Box>
  );
}

function ReferenceDataCheckCard({
  check
}: {
  check: ReferenceDataReadinessCheckItem;
}) {
  return (
    <Box
      sx={{
        p: appLayout.cardPadding,
        borderRadius: 2,
        border: (theme) => `1px solid ${theme.palette.divider}`,
        bgcolor: 'background.default'
      }}
    >
      <Stack spacing={1}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1}
          justifyContent="space-between"
        >
          <Stack spacing={0.5}>
            <Typography variant="subtitle2">{check.label}</Typography>
            <Typography variant="body2" color="text.secondary">
              {check.description}
            </Typography>
          </Stack>
          <Chip
            label={check.ready ? '준비됨' : '조치 필요'}
            size="small"
            color={check.ready ? 'success' : 'warning'}
            sx={{ alignSelf: { xs: 'flex-start', md: 'center' } }}
          />
        </Stack>

        <Grid container spacing={appLayout.fieldGap}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Typography variant="caption" color="text.secondary">
              현재 수량 / 최소 기준
            </Typography>
            <Typography variant="body2">
              {check.count}개 / {check.minimumRequiredCount}개
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Typography variant="caption" color="text.secondary">
              관리 범위
            </Typography>
            <Typography variant="body2">
              {check.ownershipScope === 'USER_MANAGED'
                ? '사용자가 관리'
                : '시스템 관리'}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Typography variant="caption" color="text.secondary">
              관리 가능 역할 / 화면에서 수정
            </Typography>
            <Typography variant="body2">
              {formatResponsibleRoles(check)} /{' '}
              {check.inProductEditEnabled ? '지원' : '미지원'}
            </Typography>
          </Grid>
        </Grid>

        <Typography variant="body2">{check.operatingImpact}</Typography>
        <Typography variant="body2" color="text.secondary">
          {check.managementNote}
        </Typography>
      </Stack>
    </Box>
  );
}

function isContextReady(
  readiness: ReferenceDataReadinessSummary,
  context: ReferenceDataReadinessContext
) {
  switch (context) {
    case 'monthly-operation':
      return readiness.isReadyForMonthlyOperation;
    case 'transaction-entry':
      return readiness.isReadyForTransactionEntry;
    case 'import-collection':
      return readiness.isReadyForImportCollection;
    default:
      return true;
  }
}

function readContextHeadline(context: ReferenceDataReadinessContext) {
  switch (context) {
    case 'monthly-operation':
      return '월 운영은 열 수 있지만, 기준 데이터가 미완료라 이후 수집/전표 흐름이 막힐 수 있습니다.';
    case 'transaction-entry':
      return '수집 거래 입력 전에 기준 데이터 준비를 먼저 점검해야 합니다.';
    case 'import-collection':
      return '업로드 행 등록 전에 기준 데이터 준비를 먼저 점검해야 합니다.';
    default:
      return '기준 데이터 준비 상태를 확인해 주세요.';
  }
}

function formatMissingRequirements(readiness: ReferenceDataReadinessSummary) {
  return readiness.missingRequirements.join(', ');
}

function formatResponsibleRoles(check: ReferenceDataReadinessCheckItem) {
  if (check.responsibleRoles.length === 0) {
    return '시스템 기본값';
  }

  return check.responsibleRoles
    .map((role) => membershipRoleLabelMap[role] ?? role)
    .join(', ');
}

function readAlertGuidanceMessage(input: {
  canCurrentRoleOwnPreparation: boolean;
  hasDirectEditAvailable: boolean;
  allMissingChecksDirectEditable: boolean;
}) {
  if (!input.canCurrentRoleOwnPreparation) {
    return '현재 역할은 직접 준비를 결정하는 범위가 아니므로, 기준 데이터 화면을 확인한 뒤 소유자 또는 관리자와 준비 상태를 정리해 주세요.';
  }

  if (input.allMissingChecksDirectEditable) {
    return '현재 역할은 이 부족 항목을 앱 안에서 직접 정비할 수 있습니다. 기준 데이터 화면에서 자금수단/카테고리를 추가하거나 다시 활성화해 주세요.';
  }

  if (input.hasDirectEditAvailable) {
    return '일부 부족 항목은 앱 안에서 직접 정비할 수 있지만, 계정과목/거래유형처럼 읽기 전용인 항목도 있습니다. 기준 데이터 화면에서 관리 범위와 운영 영향을 함께 확인해 주세요.';
  }

  return '현재 역할은 준비 상태를 점검할 책임 범위에 포함되지만, 아직 앱 안에서 직접 생성/수정 화면은 제공하지 않습니다. 기준 데이터 화면에서 관리 범위와 운영 영향을 먼저 확인해 주세요.';
}
