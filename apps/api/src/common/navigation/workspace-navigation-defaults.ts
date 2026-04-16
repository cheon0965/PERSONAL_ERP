import {
  Prisma,
  PrismaClient,
  TenantMembershipRole,
  WorkspaceNavigationMenuItemType,
  WorkspaceNavigationMenuMatchMode
} from '@prisma/client';

const ALL_ROLES = [
  TenantMembershipRole.OWNER,
  TenantMembershipRole.MANAGER,
  TenantMembershipRole.EDITOR,
  TenantMembershipRole.VIEWER
] as const;

const OPERATORS = [
  TenantMembershipRole.OWNER,
  TenantMembershipRole.MANAGER
] as const;
const OPERATORS_AND_EDITORS = [
  TenantMembershipRole.OWNER,
  TenantMembershipRole.MANAGER,
  TenantMembershipRole.EDITOR
] as const;

type WorkspaceNavigationSeedPrisma = Prisma.TransactionClient | PrismaClient;

type DefaultNavigationItem = {
  key: string;
  label: string;
  description?: string;
  href?: string;
  iconKey?: string;
  itemType?: WorkspaceNavigationMenuItemType;
  matchMode?: WorkspaceNavigationMenuMatchMode;
  allowedRoles: readonly TenantMembershipRole[];
  children?: readonly DefaultNavigationItem[];
};

type FlattenedDefaultNavigationItem = Omit<
  DefaultNavigationItem,
  'children'
> & {
  parentKey: string | null;
  sortOrder: number;
};

const defaultNavigationInheritanceSources: Partial<
  Record<string, readonly string[]>
> = {
  'settings-account-password': ['settings-account', 'settings-hub'],
  'settings-account-sessions': ['settings-account', 'settings-hub'],
  'settings-account-events': ['settings-account', 'settings-hub'],
  'reference-data-categories': ['reference-data-manage', 'reference-data-hub'],
  'reference-data-lookups': ['reference-data-manage', 'reference-data-hub'],
  'plan-items-generate': ['plan-items']
} as const;

export const defaultWorkspaceNavigationTree = [
  {
    key: 'workflow-setup',
    label: '운영 준비',
    description:
      '사업장 문맥, 관리자, 기준 데이터와 운영 지원을 먼저 정리합니다.',
    iconKey: 'settings',
    itemType: WorkspaceNavigationMenuItemType.GROUP,
    allowedRoles: ALL_ROLES,
    children: [
      {
        key: 'settings-hub',
        label: '작업 문맥',
        description: '현재 사업장과 기본 장부 문맥을 확인합니다.',
        href: '/settings',
        iconKey: 'settings',
        allowedRoles: ALL_ROLES,
        children: [
          {
            key: 'settings-workspace',
            label: '사업장 설정',
            description:
              '사업장명, 슬러그, 상태와 기본 장부 정보를 관리합니다.',
            href: '/settings/workspace',
            allowedRoles: OPERATORS
          },
          {
            key: 'settings-account',
            label: '기본 정보',
            description: '본인 계정 이름과 개인 기준값을 관리합니다.',
            href: '/settings/account/profile',
            allowedRoles: ALL_ROLES
          },
          {
            key: 'settings-account-password',
            label: '비밀번호',
            description: '비밀번호를 변경합니다.',
            href: '/settings/account/password',
            allowedRoles: ALL_ROLES
          },
          {
            key: 'settings-account-sessions',
            label: '세션',
            description: '활성 세션을 확인하고 종료합니다.',
            href: '/settings/account/sessions',
            allowedRoles: ALL_ROLES
          },
          {
            key: 'settings-account-events',
            label: '보안 이벤트',
            description: '최근 계정 보안 이벤트를 확인합니다.',
            href: '/settings/account/events',
            allowedRoles: ALL_ROLES
          }
        ]
      },
      {
        key: 'admin-hub',
        label: '관리자',
        description: '멤버, 메뉴 권한, 감사 로그와 정책을 운영합니다.',
        href: '/admin',
        iconKey: 'admin',
        allowedRoles: OPERATORS,
        children: [
          {
            key: 'admin-members',
            label: '회원 관리',
            description: '멤버 초대, 역할 변경, 상태 조정을 처리합니다.',
            href: '/admin/members',
            allowedRoles: OPERATORS
          },
          {
            key: 'admin-navigation',
            label: '메뉴 / 권한',
            description:
              'DB에 저장된 메뉴 트리와 메뉴별 허용 역할을 관리합니다.',
            href: '/admin/navigation',
            allowedRoles: OPERATORS
          },
          {
            key: 'admin-logs',
            label: '감사 로그',
            description: '관리자 작업과 요청 추적 기록을 확인합니다.',
            href: '/admin/logs',
            allowedRoles: [TenantMembershipRole.OWNER]
          },
          {
            key: 'admin-policy',
            label: '권한 정책',
            description: '메뉴와 주요 운영 화면의 역할 기준을 검토합니다.',
            href: '/admin/policy',
            allowedRoles: OPERATORS
          }
        ]
      },
      {
        key: 'operations-hub',
        label: '운영 지원',
        description:
          '예외, 알림, 메모, 내보내기 등 운영 보조 흐름을 확인합니다.',
        href: '/operations',
        iconKey: 'operations',
        allowedRoles: ALL_ROLES,
        children: [
          {
            key: 'operations-checklist',
            label: '체크리스트',
            description: '오늘 처리할 운영 체크포인트를 확인합니다.',
            href: '/operations/checklist',
            allowedRoles: ALL_ROLES
          },
          {
            key: 'operations-exceptions',
            label: '예외 처리함',
            description: '확인이 필요한 운영 예외를 모아 봅니다.',
            href: '/operations/exceptions',
            allowedRoles: ALL_ROLES
          },
          {
            key: 'operations-month-end',
            label: '월 마감 지원',
            description: '마감 전 확인해야 할 이슈와 준비 상태를 점검합니다.',
            href: '/operations/month-end',
            allowedRoles: ALL_ROLES
          },
          {
            key: 'operations-imports',
            label: '업로드 현황',
            description: '업로드 배치와 수집 상태를 운영 관점에서 확인합니다.',
            href: '/operations/imports',
            allowedRoles: ALL_ROLES
          },
          {
            key: 'operations-status',
            label: '시스템 상태',
            description: '연동, 백업, 데이터 상태를 확인합니다.',
            href: '/operations/status',
            allowedRoles: ALL_ROLES
          },
          {
            key: 'operations-alerts',
            label: '알림 센터',
            description: '처리 지연, 예외, 마감 리스크 알림을 확인합니다.',
            href: '/operations/alerts',
            allowedRoles: ALL_ROLES
          },
          {
            key: 'operations-exports',
            label: '백업 / 내보내기',
            description: '운영 데이터 내보내기와 백업 흐름을 확인합니다.',
            href: '/operations/exports',
            allowedRoles: ALL_ROLES
          },
          {
            key: 'operations-notes',
            label: '운영 메모',
            description: '인수인계와 월말 참고 메모를 남깁니다.',
            href: '/operations/notes',
            allowedRoles: ALL_ROLES
          }
        ]
      },
      {
        key: 'reference-data-hub',
        label: '기준 데이터',
        description: '자금수단, 카테고리, 계정과목 준비 상태를 확인합니다.',
        href: '/reference-data',
        iconKey: 'referenceData',
        allowedRoles: ALL_ROLES,
        children: [
          {
            key: 'reference-data-manage',
            label: '자금수단',
            description: '자금수단을 관리합니다.',
            href: '/reference-data/funding-accounts',
            allowedRoles: OPERATORS
          },
          {
            key: 'reference-data-categories',
            label: '카테고리',
            description: '카테고리를 관리합니다.',
            href: '/reference-data/categories',
            allowedRoles: OPERATORS
          },
          {
            key: 'reference-data-lookups',
            label: '공식 참조값',
            description: '계정과목과 거래유형을 확인합니다.',
            href: '/reference-data/lookups',
            allowedRoles: ALL_ROLES
          }
        ]
      }
    ]
  },
  {
    key: 'workflow-monthly',
    label: '월 실행',
    description:
      '월 시작부터 계획, 업로드, 거래 확정, 전표 조회까지 이어집니다.',
    iconKey: 'calendar',
    itemType: WorkspaceNavigationMenuItemType.GROUP,
    allowedRoles: ALL_ROLES,
    children: [
      {
        key: 'periods-hub',
        label: '월 운영',
        description: '현재 운영 기간과 마감 상태를 확인합니다.',
        href: '/periods',
        iconKey: 'calendar',
        allowedRoles: OPERATORS,
        children: [
          {
            key: 'periods-open',
            label: '월 운영 시작',
            description: '새 운영 기간을 열고 시작 잔액을 준비합니다.',
            href: '/periods/open',
            allowedRoles: OPERATORS
          },
          {
            key: 'periods-close',
            label: '월 마감 / 재오픈',
            description: '월 마감, 잠금, 재오픈 판단을 처리합니다.',
            href: '/periods/close',
            allowedRoles: [TenantMembershipRole.OWNER]
          },
          {
            key: 'periods-history',
            label: '기간 이력',
            description: '운영 기간 상태 변화와 이력을 확인합니다.',
            href: '/periods/history',
            allowedRoles: OPERATORS
          }
        ]
      },
      {
        key: 'recurring-rules',
        label: '반복 규칙',
        description: '정기 지출과 수입 규칙을 관리합니다.',
        href: '/recurring',
        iconKey: 'recurring',
        allowedRoles: OPERATORS
      },
      {
        key: 'plan-items',
        label: '계획 항목',
        description: '월별 예정 거래를 생성하고 확정 흐름으로 넘깁니다.',
        href: '/plan-items',
        iconKey: 'planItems',
        allowedRoles: OPERATORS,
        children: [
          {
            key: 'plan-items-generate',
            label: '계획 생성',
            description: '선택한 운영 월의 계획 항목을 생성합니다.',
            href: '/plan-items/generate',
            allowedRoles: OPERATORS
          }
        ]
      },
      {
        key: 'imports',
        label: '업로드 배치',
        description: '카드/은행 파일 업로드와 수집 전환을 처리합니다.',
        href: '/imports',
        iconKey: 'upload',
        allowedRoles: OPERATORS_AND_EDITORS
      },
      {
        key: 'transactions',
        label: '수집 거래',
        description: '수집 거래를 검토, 보정, 확정합니다.',
        href: '/transactions',
        iconKey: 'transactions',
        allowedRoles: OPERATORS_AND_EDITORS
      },
      {
        key: 'journal-entries',
        label: '전표 조회',
        description: '확정된 전표와 조정 이력을 조회합니다.',
        href: '/journal-entries',
        iconKey: 'journal',
        allowedRoles: OPERATORS_AND_EDITORS
      }
    ]
  },
  {
    key: 'workflow-assets',
    label: '운영 자산',
    description: '보험과 차량처럼 월 운영에 영향을 주는 고정 운영 기준입니다.',
    iconKey: 'assets',
    itemType: WorkspaceNavigationMenuItemType.GROUP,
    allowedRoles: ALL_ROLES,
    children: [
      {
        key: 'insurance-policies',
        label: '보험 계약',
        description: '보험 계약, 납입주기, 연동 반복규칙을 관리합니다.',
        href: '/insurances',
        iconKey: 'insurance',
        allowedRoles: OPERATORS
      },
      {
        key: 'vehicles-hub',
        label: '차량 운영',
        description: '차량 기준과 비용 기록을 관리합니다.',
        href: '/vehicles',
        iconKey: 'vehicles',
        allowedRoles: OPERATORS,
        children: [
          {
            key: 'vehicles-fleet',
            label: '차량 목록',
            description: '운영 차량 기준 정보를 관리합니다.',
            href: '/vehicles/fleet',
            allowedRoles: OPERATORS
          },
          {
            key: 'vehicles-fuel',
            label: '연료 기록',
            description: '주유 이력과 연비 흐름을 기록합니다.',
            href: '/vehicles/fuel',
            iconKey: 'fuel',
            allowedRoles: OPERATORS
          },
          {
            key: 'vehicles-maintenance',
            label: '정비 이력',
            description: '정비, 수리, 점검 이력을 기록합니다.',
            href: '/vehicles/maintenance',
            iconKey: 'maintenance',
            allowedRoles: OPERATORS
          }
        ]
      }
    ]
  },
  {
    key: 'workflow-insights',
    label: '보고 / 판단',
    description: '월말 산출물과 경영 판단 화면을 분리해서 확인합니다.',
    iconKey: 'reports',
    itemType: WorkspaceNavigationMenuItemType.GROUP,
    allowedRoles: ALL_ROLES,
    children: [
      {
        key: 'financial-statements',
        label: '재무제표 생성 / 선택',
        description: '기간별 공식 재무제표를 생성하고 조회합니다.',
        href: '/financial-statements',
        iconKey: 'financialStatements',
        allowedRoles: OPERATORS
      },
      {
        key: 'carry-forwards',
        label: '차기 이월 생성 / 선택',
        description: '마감 잔액을 다음 기간으로 이월합니다.',
        href: '/carry-forwards',
        iconKey: 'carryForward',
        allowedRoles: OPERATORS
      },
      {
        key: 'forecast',
        label: '기간 전망',
        description: '월중 현금 흐름과 예비금 상태를 전망합니다.',
        href: '/forecast',
        iconKey: 'forecast',
        allowedRoles: ALL_ROLES
      },
      {
        key: 'dashboard',
        label: '대시보드',
        description: '현재 사업장 상태와 핵심 지표를 요약합니다.',
        href: '/dashboard',
        iconKey: 'dashboard',
        allowedRoles: ALL_ROLES
      }
    ]
  }
] as const satisfies readonly DefaultNavigationItem[];

export async function ensureDefaultWorkspaceNavigation(
  prisma: WorkspaceNavigationSeedPrisma,
  tenantId: string
): Promise<void> {
  const defaults = flattenDefaultNavigation(defaultWorkspaceNavigationTree);
  const existingItems = await prisma.workspaceNavigationMenuItem.findMany({
    where: { tenantId },
    include: {
      roles: {
        select: {
          role: true
        }
      }
    }
  });
  const existingByKey = new Map(existingItems.map((item) => [item.key, item]));
  const itemIdByKey = new Map(existingItems.map((item) => [item.key, item.id]));

  for (const item of defaults) {
    const parentId = item.parentKey ? itemIdByKey.get(item.parentKey) : null;
    const existing = existingByKey.get(item.key);
    const inheritedSource = readNavigationInheritanceSource(
      item.key,
      existingByKey
    );
    const seededRoles = existing?.roles.length
      ? null
      : inheritedSource?.roles.length
        ? inheritedSource.roles.map((roleRecord) => roleRecord.role)
        : [...item.allowedRoles];
    const saved = await prisma.workspaceNavigationMenuItem.upsert({
      where: {
        tenantId_key: {
          tenantId,
          key: item.key
        }
      },
      update: {
        parentId,
        itemType: item.itemType ?? WorkspaceNavigationMenuItemType.PAGE,
        label: item.label,
        description: null,
        href: item.href ?? null,
        iconKey: item.iconKey ?? null,
        matchMode: item.matchMode ?? WorkspaceNavigationMenuMatchMode.PREFIX,
        sortOrder: item.sortOrder
      },
      create: {
        tenantId,
        parentId,
        key: item.key,
        itemType: item.itemType ?? WorkspaceNavigationMenuItemType.PAGE,
        label: item.label,
        description: null,
        href: item.href ?? null,
        iconKey: item.iconKey ?? null,
        matchMode: item.matchMode ?? WorkspaceNavigationMenuMatchMode.PREFIX,
        sortOrder: item.sortOrder,
        isVisible: inheritedSource?.isVisible ?? true
      }
    });

    itemIdByKey.set(item.key, saved.id);

    if (!seededRoles) {
      continue;
    }

    await prisma.workspaceNavigationMenuRole.createMany({
      data: seededRoles.map((role) => ({
        menuItemId: saved.id,
        role
      })),
      skipDuplicates: true
    });
  }
}

function flattenDefaultNavigation(
  items: readonly DefaultNavigationItem[],
  parentKey: string | null = null
): FlattenedDefaultNavigationItem[] {
  return items.flatMap((item, index) => {
    const { children, ...rest } = item;
    const current: FlattenedDefaultNavigationItem = {
      ...rest,
      parentKey,
      sortOrder: (index + 1) * 10
    };

    return [current, ...flattenDefaultNavigation(children ?? [], item.key)];
  });
}

function readNavigationInheritanceSource(
  key: string,
  existingByKey: Map<
    string,
    {
      isVisible: boolean;
      roles: Array<{ role: TenantMembershipRole }>;
    }
  >
) {
  const sourceKeys = defaultNavigationInheritanceSources[key];

  if (!sourceKeys) {
    return null;
  }

  for (const sourceKey of sourceKeys) {
    const source = existingByKey.get(sourceKey);

    if (source) {
      return source;
    }
  }

  return null;
}
