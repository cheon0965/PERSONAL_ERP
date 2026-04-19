'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Stack } from '@mui/material';
import type {
  VehicleFuelLogItem,
  VehicleItem,
  VehicleMaintenanceLogItem
} from '@personal-erp/contracts';
import { subtractMoneyWon } from '@personal-erp/money';
import { formatWon } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import {
  getVehicleFuelLogs,
  getVehicleMaintenanceLogs,
  getVehicleOperatingSummary,
  getVehicles,
  vehicleFuelLogsQueryKey,
  vehicleMaintenanceLogsQueryKey,
  vehicleOperatingSummaryQueryKey,
  vehiclesQueryKey
} from './vehicles.api';
import {
  buildFuelLogColumns,
  buildMaintenanceLogColumns,
  buildVehicleColumns
} from './vehicles-page.columns';
import {
  VehiclesFleetSection,
  VehiclesFormDrawers,
  VehiclesFuelSection,
  VehiclesMaintenanceSection,
  VehiclesOverviewSection
} from './vehicles-page.sections';
import {
  VehiclesSectionNav,
  type VehicleWorkspaceSection
} from './vehicles-section-nav';
import { buildVehicleOperatingSummaryView } from './vehicles.summary';

type SubmitFeedback = {
  severity: 'success' | 'error';
  message: string;
} | null;

type VehicleDrawerState =
  | { mode: 'create' }
  | { mode: 'edit'; vehicle: VehicleItem }
  | null;

type VehicleMaintenanceDrawerState =
  | { mode: 'create'; vehicleId?: string | null }
  | { mode: 'edit'; maintenanceLog: VehicleMaintenanceLogItem }
  | null;

type VehicleFuelDrawerState =
  | { mode: 'create'; vehicleId?: string | null }
  | { mode: 'edit'; fuelLog: VehicleFuelLogItem }
  | null;

export function VehiclesPage({
  section = 'overview'
}: {
  section?: VehicleWorkspaceSection;
}) {
  const [feedback, setFeedback] = React.useState<SubmitFeedback>(null);
  const [drawerState, setDrawerState] =
    React.useState<VehicleDrawerState>(null);
  const [fuelDrawerState, setFuelDrawerState] =
    React.useState<VehicleFuelDrawerState>(null);
  const [maintenanceDrawerState, setMaintenanceDrawerState] =
    React.useState<VehicleMaintenanceDrawerState>(null);
  const { data: vehicles = [], error: vehiclesError } = useQuery({
    queryKey: vehiclesQueryKey,
    queryFn: getVehicles
  });
  const { data: fuelLogs = [], error: fuelLogsError } = useQuery({
    queryKey: vehicleFuelLogsQueryKey,
    queryFn: getVehicleFuelLogs
  });
  const { data: maintenanceLogs = [], error: maintenanceLogsError } = useQuery({
    queryKey: vehicleMaintenanceLogsQueryKey,
    queryFn: getVehicleMaintenanceLogs
  });
  const { data: vehicleOperatingSummary } = useQuery({
    queryKey: vehicleOperatingSummaryQueryKey,
    queryFn: getVehicleOperatingSummary
  });
  const operatingSummary =
    vehicleOperatingSummary ??
    buildVehicleOperatingSummaryView({
      vehicles,
      fuelLogs,
      maintenanceLogs
    });
  const manufacturers = Array.from(
    new Set(
      vehicles
        .map((vehicle) => vehicle.manufacturer)
        .filter((manufacturer): manufacturer is string => Boolean(manufacturer))
    )
  );
  const operatingSummaryByVehicleId = new Map(
    operatingSummary.items.map((item) => [item.vehicleId, item])
  );
  const latestFuelLog =
    fuelLogs.length > 0
      ? ([...fuelLogs]
          .sort((left, right) => left.filledOn.localeCompare(right.filledOn))
          .at(-1) ?? null)
      : null;
  const latestMaintenanceLog =
    maintenanceLogs.length > 0
      ? ([...maintenanceLogs]
          .sort((left, right) =>
            left.performedOn.localeCompare(right.performedOn)
          )
          .at(-1) ?? null)
      : null;
  const mostExpensiveVehicle =
    operatingSummary.items.length > 0
      ? ([...operatingSummary.items].sort((left, right) =>
          subtractMoneyWon(
            right.recordedOperatingExpenseWon,
            left.recordedOperatingExpenseWon
          )
        )[0] ?? null)
      : null;
  const activeSectionLabel =
    section === 'overview'
      ? '개요'
      : section === 'fleet'
        ? '차량 목록'
        : section === 'fuel'
          ? '연료 기록'
          : '정비 이력';
  const pageTitle =
    section === 'overview'
      ? '차량 운영'
      : section === 'fleet'
        ? '차량 목록'
        : section === 'fuel'
          ? '연료 기록'
          : '정비 이력';
  const pageDescription =
    section === 'overview'
      ? '차량 프로필, 연료 기록, 정비 이력을 분리해 관리하고 차량별 운영비를 점검하는 화면입니다.'
      : section === 'fleet'
        ? '차량 프로필만 집중해서 관리하고, 연료/정비 이력은 각각의 전용 화면으로 분리해 읽기 쉽게 정리했습니다.'
        : section === 'fuel'
          ? '주유와 충전 이력만 모아 보고, 차량비 검토에 필요한 흐름을 표 중심으로 빠르게 확인합니다.'
          : '정비 이력만 모아 보고, 정비 비용과 최근 작업 기록을 별도 화면에서 집중해서 관리합니다.';

  const handleCreateOpen = () => {
    setFeedback(null);
    setDrawerState({ mode: 'create' });
  };

  const handleEditOpen = (vehicle: VehicleItem) => {
    setFeedback(null);
    setDrawerState({ mode: 'edit', vehicle });
  };

  const handleFuelCreateOpen = (vehicleId?: string | null) => {
    setFeedback(null);
    setFuelDrawerState({ mode: 'create', vehicleId });
  };

  const handleFuelEditOpen = (fuelLog: VehicleFuelLogItem) => {
    setFeedback(null);
    setFuelDrawerState({ mode: 'edit', fuelLog });
  };

  const handleMaintenanceCreateOpen = (vehicleId?: string | null) => {
    setFeedback(null);
    setMaintenanceDrawerState({ mode: 'create', vehicleId });
  };

  const handleMaintenanceEditOpen = (
    maintenanceLog: VehicleMaintenanceLogItem
  ) => {
    setFeedback(null);
    setMaintenanceDrawerState({ mode: 'edit', maintenanceLog });
  };

  const handleFormCompleted = (
    vehicle: VehicleItem,
    mode: 'create' | 'edit'
  ) => {
    setDrawerState(null);
    setFeedback({
      severity: 'success',
      message:
        mode === 'edit'
          ? `${vehicle.name} 차량 정보를 수정했습니다.`
          : `${vehicle.name} 차량을 등록했습니다.`
    });
  };

  const handleFuelCompleted = (
    fuelLog: VehicleFuelLogItem,
    mode: 'create' | 'edit'
  ) => {
    setFuelDrawerState(null);
    setFeedback({
      severity: 'success',
      message:
        mode === 'edit'
          ? `${fuelLog.vehicleName} 연료 기록을 수정했습니다.`
          : `${fuelLog.vehicleName} 연료 기록을 추가했습니다.`
    });
  };

  const handleMaintenanceCompleted = (
    maintenanceLog: VehicleMaintenanceLogItem,
    mode: 'create' | 'edit'
  ) => {
    setMaintenanceDrawerState(null);
    setFeedback({
      severity: 'success',
      message:
        mode === 'edit'
          ? `${maintenanceLog.vehicleName} 정비 기록을 수정했습니다.`
          : `${maintenanceLog.vehicleName} 정비 기록을 추가했습니다.`
    });
  };

  const primaryAction =
    section === 'fuel'
      ? {
          label: '연료 기록 추가',
          onClick: () => {
            handleFuelCreateOpen(vehicles[0]?.id ?? null);
          },
          disabled: vehicles.length === 0
        }
      : section === 'maintenance'
        ? {
            label: '정비 기록 추가',
            onClick: () => {
              handleMaintenanceCreateOpen(vehicles[0]?.id ?? null);
            },
            disabled: vehicles.length === 0
          }
        : {
            label: '차량 등록',
            onClick: handleCreateOpen,
            disabled: false
          };
  const secondaryAction: {
    label: string;
    href: '/vehicles/fleet' | '/vehicles/fuel';
  } =
    section === 'overview'
      ? {
          label: '차량 목록 보기',
          href: '/vehicles/fleet'
        }
      : section === 'fleet'
        ? {
            label: '연료 기록 보기',
            href: '/vehicles/fuel'
          }
        : {
            label: '차량 목록 보기',
            href: '/vehicles/fleet'
          };

  const vehicleColumns = buildVehicleColumns({
    operatingSummaryByVehicleId,
    onEditVehicle: handleEditOpen,
    onCreateFuelLog: handleFuelCreateOpen,
    onCreateMaintenanceLog: handleMaintenanceCreateOpen
  });
  const fuelTableColumns = buildFuelLogColumns({
    onEditFuelLog: handleFuelEditOpen
  });
  const maintenanceTableColumns = buildMaintenanceLogColumns({
    onEditMaintenanceLog: handleMaintenanceEditOpen
  });

  useDomainHelp(buildVehiclesHelpContext(section));

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="보조 운영 영역"
        title={pageTitle}
        description={pageDescription}
        badges={[
          {
            label: `현재 화면 · ${activeSectionLabel}`,
            color: 'primary'
          },
          {
            label: `연료 ${fuelLogs.length}건`
          },
          {
            label: `정비 ${maintenanceLogs.length}건`
          }
        ]}
        metadata={[
          {
            label: '관리 차량',
            value: `${operatingSummary.totals.vehicleCount}대`
          },
          {
            label: '기록 운영비',
            value: formatWon(
              operatingSummary.totals.recordedOperatingExpenseWon
            )
          },
          {
            label: '최근 연료',
            value: latestFuelLog
              ? `${latestFuelLog.filledOn.slice(0, 10)} · ${latestFuelLog.vehicleName}`
              : '-'
          },
          {
            label: '최근 정비',
            value: latestMaintenanceLog
              ? `${latestMaintenanceLog.performedOn.slice(0, 10)} · ${latestMaintenanceLog.vehicleName}`
              : '-'
          }
        ]}
        primaryActionLabel={primaryAction.label}
        primaryActionOnClick={primaryAction.onClick}
        primaryActionDisabled={primaryAction.disabled}
        secondaryActionLabel={secondaryAction.label}
        secondaryActionHref={secondaryAction.href}
      />

      <VehiclesSectionNav />

      {feedback ? (
        <Alert severity={feedback.severity} variant="outlined">
          {feedback.message}
        </Alert>
      ) : null}
      {vehiclesError ? (
        <QueryErrorAlert
          title="차량 정보 조회에 실패했습니다."
          error={vehiclesError}
        />
      ) : null}
      {fuelLogsError ? (
        <QueryErrorAlert
          title="차량 연료 이력 조회에 실패했습니다."
          error={fuelLogsError}
        />
      ) : null}
      {maintenanceLogsError ? (
        <QueryErrorAlert
          title="차량 정비 이력 조회에 실패했습니다."
          error={maintenanceLogsError}
        />
      ) : null}

      {section === 'overview' ? (
        <VehiclesOverviewSection
          manufacturers={manufacturers}
          latestFuelLog={latestFuelLog}
          latestMaintenanceLog={latestMaintenanceLog}
          mostExpensiveVehicle={mostExpensiveVehicle}
          operatingSummary={operatingSummary}
        />
      ) : null}

      {section === 'fleet' ? (
        <VehiclesFleetSection
          manufacturers={manufacturers}
          vehicles={vehicles}
          vehicleColumns={vehicleColumns}
          onCreateVehicle={handleCreateOpen}
        />
      ) : null}

      {section === 'fuel' ? (
        <VehiclesFuelSection
          fuelLogRows={fuelLogs}
          fuelTableColumns={fuelTableColumns}
          latestFuelLog={latestFuelLog}
          operatingSummary={operatingSummary}
          vehicles={vehicles}
          onCreateFuelLog={handleFuelCreateOpen}
        />
      ) : null}

      {section === 'maintenance' ? (
        <VehiclesMaintenanceSection
          latestMaintenanceLog={latestMaintenanceLog}
          maintenanceLogRows={maintenanceLogs}
          maintenanceTableColumns={maintenanceTableColumns}
          operatingSummary={operatingSummary}
          vehicles={vehicles}
          onCreateMaintenanceLog={handleMaintenanceCreateOpen}
        />
      ) : null}

      <VehiclesFormDrawers
        drawerState={drawerState}
        fuelDrawerState={fuelDrawerState}
        maintenanceDrawerState={maintenanceDrawerState}
        vehicles={vehicles}
        onCloseVehicleDrawer={() => setDrawerState(null)}
        onCloseFuelDrawer={() => setFuelDrawerState(null)}
        onCloseMaintenanceDrawer={() => setMaintenanceDrawerState(null)}
        onVehicleCompleted={handleFormCompleted}
        onFuelCompleted={handleFuelCompleted}
        onMaintenanceCompleted={handleMaintenanceCompleted}
      />
    </Stack>
  );
}

function buildVehiclesHelpContext(section: VehicleWorkspaceSection) {
  const currentHref =
    section === 'overview'
      ? '/vehicles'
      : section === 'fleet'
        ? '/vehicles/fleet'
        : section === 'fuel'
          ? '/vehicles/fuel'
          : '/vehicles/maintenance';
  const commonLinks = [
    {
      title: '차량 운영',
      description: '차량 전체 운영 요약과 다음 작업 방향을 먼저 확인합니다.',
      href: '/vehicles',
      actionLabel: '차량 운영 보기'
    },
    {
      title: '차량 목록',
      description: '차량 프로필과 기본 정보를 등록하거나 수정합니다.',
      href: '/vehicles/fleet',
      actionLabel: '차량 목록 보기'
    },
    {
      title: '연료 기록',
      description: '주유·충전 기록과 차량별 연료 흐름을 집중해서 확인합니다.',
      href: '/vehicles/fuel',
      actionLabel: '연료 기록 보기'
    },
    {
      title: '정비 이력',
      description: '정비 작업과 차량별 정비비 누적 흐름을 확인합니다.',
      href: '/vehicles/maintenance',
      actionLabel: '정비 이력 보기'
    }
  ].filter((link) => link.href !== currentHref);

  switch (section) {
    case 'fleet':
      return {
        title: '차량 목록 도움말',
        description:
          '이 탭은 차량 프로필과 기본 운영 기준을 관리하는 화면입니다. 연료나 정비 기록보다 먼저 차량 식별 정보와 기본 속성을 정리합니다.',
        primaryEntity: '차량 프로필',
        relatedEntities: ['연료 기록', '정비 이력', '수집 거래', '전표'],
        truthSource:
          '차량 프로필은 운영 분류 기준이고, 실제 비용 확정은 수집 거래와 전표에서 이뤄집니다.',
        supplementarySections: [
          {
            title: '이 탭에서 하는 일',
            items: [
              '차량명, 제조사, 연료 종류, 초기 주행거리 같은 기본 프로필을 등록합니다.',
              '운영 중 더 이상 쓰지 않는 차량이라도 이력 추적이 필요하면 목록에 유지합니다.',
              '차량을 등록한 뒤 실제 주유·정비 이력은 각각의 전용 탭에서 누적합니다.'
            ]
          },
          {
            title: '이어지는 화면',
            links: commonLinks
          }
        ],
        readModelNote:
          '차량 목록은 기준 데이터에 가깝습니다. 비용 보고에 반영하려면 연료·정비 기록과 연결된 실제 지출을 수집 거래에서 전표로 확정해야 합니다.'
      };
    case 'fuel':
      return {
        title: '연료 기록 도움말',
        description:
          '이 탭은 차량별 주유·충전 이력과 연료비 흐름을 검토하는 화면입니다. 차량 프로필보다 실제 사용 기록에 집중합니다.',
        primaryEntity: '연료 기록',
        relatedEntities: ['차량 프로필', '정비 이력', '수집 거래', '전표'],
        truthSource:
          '연료 기록은 운영 추적용 이력이고, 공식 비용 확정은 연결된 지출 거래와 전표가 기준입니다.',
        supplementarySections: [
          {
            title: '이 탭에서 하는 일',
            items: [
              '주유일 또는 충전일, 주행거리, 수량, 금액을 남겨 차량별 연료 이력을 누적합니다.',
              '최근 연료 기록과 차량별 누적 운영비를 함께 보며 이상치가 없는지 점검합니다.',
              '연료 지출이 회계 숫자에 반영됐는지는 수집 거래 또는 전표 화면에서 이어서 확인합니다.'
            ]
          },
          {
            title: '이어지는 화면',
            links: commonLinks
          }
        ],
        readModelNote:
          '연비나 누적 연료비는 운영 참고 수치입니다. 공식 손익과 자금 흐름은 전표 기준으로 확인해야 합니다.'
      };
    case 'maintenance':
      return {
        title: '정비 이력 도움말',
        description:
          '이 탭은 차량 정비 작업과 정비비 누적 흐름을 검토하는 화면입니다. 수리 종류와 최근 정비 내역을 따로 관리합니다.',
        primaryEntity: '정비 이력',
        relatedEntities: ['차량 프로필', '연료 기록', '수집 거래', '전표'],
        truthSource:
          '정비 이력은 운영 추적용 기록이고, 공식 비용 확정은 연결된 지출 거래와 전표가 기준입니다.',
        supplementarySections: [
          {
            title: '이 탭에서 하는 일',
            items: [
              '정비일, 정비 분류, 주행거리, 금액을 남겨 차량별 정비 이력을 누적합니다.',
              '최근 정비 기록과 차량별 누적 운영비를 비교해 반복 정비나 큰 지출이 있었는지 확인합니다.',
              '정비 지출이 실제 회계 숫자로 이어졌는지는 수집 거래 또는 전표 화면에서 최종 확인합니다.'
            ]
          },
          {
            title: '이어지는 화면',
            links: commonLinks
          }
        ],
        readModelNote:
          '정비 이력은 차량 운영 판단용입니다. 공식 회계 수치는 정비비와 연결된 수집 거래 및 전표에서 확정됩니다.'
      };
    case 'overview':
    default:
      return {
        title: '차량 운영 도움말',
        description:
          '이 화면은 차량 기본 정보, 주유·충전 기록, 정비 이력을 나눠 관리해 차량비 판단과 거래 분류를 돕는 운영 허브입니다.',
        primaryEntity: '차량 운영 보조 데이터',
        relatedEntities: [
          '수집 거래',
          '거래 분류',
          '입출금 계정',
          '전표',
          '연료 기록',
          '정비 이력'
        ],
        truthSource:
          '차량과 운영 이력 자체는 회계 확정 데이터가 아니며, 실제 비용 확정은 수집 거래 분류와 전표 반영에서 이뤄집니다.',
        supplementarySections: [
          {
            title: '이 탭에서 먼저 볼 것',
            items: [
              '상단 요약과 차량별 운영비 흐름으로 전체 차량 운영 상태를 먼저 봅니다.',
              '최근 연료 기록, 최근 정비 기록, 비용이 큰 차량을 확인해 어떤 탭으로 내려갈지 결정합니다.',
              '세부 등록과 수정은 차량 목록, 연료 기록, 정비 이력 탭으로 나눠 진행합니다.'
            ]
          },
          {
            title: '이어지는 화면',
            links: commonLinks
          }
        ],
        readModelNote:
          '차량 운영비 카드가 보여도 공식 회계 숫자는 아닙니다. 월 보고에 반영하려면 해당 지출을 수집 거래에서 전표로 확정해야 합니다.'
      };
  }
}
