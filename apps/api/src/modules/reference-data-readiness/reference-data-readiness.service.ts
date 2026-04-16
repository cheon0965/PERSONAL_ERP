import { Injectable } from '@nestjs/common';
import type {
  AuthenticatedUser,
  ReferenceDataReadinessCheckItem,
  ReferenceDataReadinessCheckKey,
  ReferenceDataReadinessSummary,
  TenantMembershipRole
} from '@personal-erp/contracts';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { PrismaService } from '../../common/prisma/prisma.service';

const USER_MANAGED_ROLES: TenantMembershipRole[] = ['OWNER', 'MANAGER'];

@Injectable()
export class ReferenceDataReadinessService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(
    user: AuthenticatedUser
  ): Promise<ReferenceDataReadinessSummary> {
    const workspace = requireCurrentWorkspace(user);
    const [
      fundingAccounts,
      incomeCategories,
      expenseCategories,
      accountSubjects,
      ledgerTransactionTypes
    ] = await Promise.all([
      this.prisma.account.findMany({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          status: 'ACTIVE'
        }
      }),
      this.prisma.category.findMany({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          kind: 'INCOME',
          isActive: true
        }
      }),
      this.prisma.category.findMany({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          kind: 'EXPENSE',
          isActive: true
        }
      }),
      this.prisma.accountSubject.findMany({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          isActive: true
        }
      }),
      this.prisma.ledgerTransactionType.findMany({
        where: {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          isActive: true
        }
      })
    ]);

    const checks: ReferenceDataReadinessCheckItem[] = [
      buildUserManagedCheck({
        key: 'funding-accounts',
        label: '자금수단',
        count: fundingAccounts.length,
        description:
          '수집 거래, 반복 규칙, 업로드 승격에서 실제 자금 흐름 계정으로 선택하는 기준 목록입니다.',
        operatingImpact:
          '없으면 수집 거래 등록과 업로드 행 승격에서 자금수단을 고를 수 없습니다.',
        currentRole: workspace.membershipRole,
        inProductEditEnabled: true
      }),
      buildUserManagedCheck({
        key: 'income-categories',
        label: '수입 카테고리',
        count: incomeCategories.length,
        description:
          '수입 거래를 계획 항목, 수집 거래, 업로드 자동 판정에서 분류할 때 쓰는 기준 목록입니다.',
        operatingImpact:
          '없으면 수입 흐름을 계획/수집 단계에서 안정적으로 분류하기 어렵습니다.',
        currentRole: workspace.membershipRole,
        inProductEditEnabled: true
      }),
      buildUserManagedCheck({
        key: 'expense-categories',
        label: '지출 카테고리',
        count: expenseCategories.length,
        description:
          '지출 거래를 계획 항목, 수집 거래, 업로드 자동 판정에서 분류할 때 쓰는 기준 목록입니다.',
        operatingImpact:
          '없으면 지출 흐름을 계획/수집 단계에서 안정적으로 분류하기 어렵습니다.',
        currentRole: workspace.membershipRole,
        inProductEditEnabled: true
      }),
      buildSystemManagedCheck({
        key: 'account-subjects',
        label: '계정과목',
        count: accountSubjects.length,
        description:
          '전표 라인, 월 마감, 재무제표 계산에 공통으로 쓰이는 공식 계정과목 목록입니다.',
        operatingImpact:
          '없으면 전표 확정과 마감 계산이 일관되게 이어질 수 없습니다.'
      }),
      buildSystemManagedCheck({
        key: 'ledger-transaction-types',
        label: '거래유형',
        count: ledgerTransactionTypes.length,
        description:
          '계획 항목과 수집 거래를 내부 전표 정책에 연결하는 공식 거래유형 목록입니다.',
        operatingImpact:
          '없으면 계획/수집 거래를 전표 정책에 안정적으로 연결할 수 없습니다.'
      })
    ];

    const missingRequirements = checks
      .filter((check) => !check.ready)
      .map((check) => check.label);
    const allChecksReady = missingRequirements.length === 0;

    return {
      status: allChecksReady ? 'READY' : 'ACTION_REQUIRED',
      currentRole: workspace.membershipRole,
      isReadyForMonthlyOperation: allChecksReady,
      isReadyForTransactionEntry: allChecksReady,
      isReadyForImportCollection: allChecksReady,
      isReadyForRecurringRuleSetup: allChecksReady,
      missingRequirements,
      checks
    };
  }
}

function buildUserManagedCheck(input: {
  key: ReferenceDataReadinessCheckKey;
  label: string;
  count: number;
  description: string;
  operatingImpact: string;
  currentRole: TenantMembershipRole;
  inProductEditEnabled: boolean;
}): ReferenceDataReadinessCheckItem {
  const currentRoleOwnsPreparation = USER_MANAGED_ROLES.includes(
    input.currentRole
  );

  return {
    key: input.key,
    label: input.label,
    description: input.description,
    ready: input.count >= 1,
    count: input.count,
    minimumRequiredCount: 1,
    ownershipScope: 'USER_MANAGED',
    responsibleRoles: USER_MANAGED_ROLES,
    inProductEditEnabled: input.inProductEditEnabled,
    operatingImpact: input.operatingImpact,
    managementNote: readUserManagedNote({
      currentRoleOwnsPreparation,
      inProductEditEnabled: input.inProductEditEnabled
    })
  };
}

function buildSystemManagedCheck(input: {
  key: ReferenceDataReadinessCheckKey;
  label: string;
  count: number;
  description: string;
  operatingImpact: string;
}): ReferenceDataReadinessCheckItem {
  return {
    key: input.key,
    label: input.label,
    description: input.description,
    ready: input.count >= 1,
    count: input.count,
    minimumRequiredCount: 1,
    ownershipScope: 'SYSTEM_MANAGED',
    responsibleRoles: [],
    inProductEditEnabled: false,
    operatingImpact: input.operatingImpact,
    managementNote:
      '초기 범위에서는 system-managed/seed-managed 데이터로 유지합니다. 운영자는 직접 편집하지 않고 존재 여부와 활성 상태만 확인합니다.'
  };
}

function readUserManagedNote(input: {
  currentRoleOwnsPreparation: boolean;
  inProductEditEnabled: boolean;
}) {
  if (input.inProductEditEnabled) {
    return input.currentRoleOwnsPreparation
      ? '사용자 관리 데이터이며, 현재 제품에서는 직접 생성/이름 수정/활성 상태 관리를 지원합니다.'
      : '사용자 관리 데이터이며, 소유자 또는 관리자가 앱 안에서 직접 생성/이름 수정/활성 상태 관리를 수행할 수 있습니다.';
  }

  return input.currentRoleOwnsPreparation
    ? '사용자 관리 데이터이지만, 현재 제품에서는 직접 생성/수정 UI를 아직 제공하지 않습니다. 준비 상태를 확인하고 운영 준비 절차에 따라 추가/정비 범위를 진행해야 합니다.'
    : '사용자 관리 데이터이며, 소유자 또는 관리자가 준비 상태를 책임집니다. 현재 제품에서는 직접 생성/수정 UI를 아직 제공하지 않습니다.';
}
