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
  const [drawerState, setDrawerState] = React.useState<VehicleDrawerState>(null);
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
      ? [...fuelLogs]
          .sort((left, right) => left.filledOn.localeCompare(right.filledOn))
          .at(-1) ?? null
      : null;
  const latestMaintenanceLog =
    maintenanceLogs.length > 0
      ? [...maintenanceLogs]
          .sort((left, right) => left.performedOn.localeCompare(right.performedOn))
          .at(-1) ?? null
      : null;
  const mostExpensiveVehicle =
    operatingSummary.items.length > 0
      ? [...operatingSummary.items].sort((left, right) =>
          subtractMoneyWon(
            right.recordedOperatingExpenseWon,
            left.recordedOperatingExpenseWon
          )
        )[0] ?? null
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

  const handleFormCompleted = (vehicle: VehicleItem, mode: 'create' | 'edit') => {
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

  useDomainHelp({
    title: '차량 운영 사용 가이드',
    description:
      '이 화면은 차량 기본 정보, 주유/충전 기록, 정비 이력을 나눠 관리해 차량비 판단과 거래 분류를 돕는 운영 화면입니다.',
    primaryEntity: '차량 운영 보조 데이터',
    relatedEntities: [
      '수집 거래',
      '거래 분류',
      '입출금 계정',
      '전표',
      '연료 이력',
      '정비 이력'
    ],
    truthSource:
      '차량과 운영 이력 자체는 회계 확정 데이터가 아니며, 실제 비용 확정은 수집 거래 분류와 전표 반영에서 이뤄집니다.',
    supplementarySections: [
      {
        title: '바로 쓰는 순서',
        items: [
          '차량 등록으로 차량명, 연료 종류, 초기 주행거리 같은 기본 프로필을 먼저 만듭니다.',
          '주유 또는 충전이 발생하면 연료 기록 추가로 날짜, 주행거리, 리터, 금액을 남깁니다.',
          '정비가 발생하면 정비 기록 추가로 정비일, 주행거리, 분류, 금액을 남깁니다.',
          '상단 요약과 차량별 기록 운영비 차트로 차량별 누적 비용과 연비를 확인합니다.',
          '실제 카드/계좌 지출은 수집 거래 또는 업로드 배치에서 별도로 전표 확정합니다.'
        ]
      },
      {
        title: '화면 경계',
        items: [
          '차량 기본 정보는 차량 프로필만 관리합니다.',
          '연료 기록과 정비 이력은 별도 운영 기록으로 누적합니다.',
          '운영 요약은 기록을 읽어 계산한 projection이며 원장 숫자를 대체하지 않습니다.'
        ]
      }
    ],
    readModelNote:
      '차량 운영비 카드가 보여도 공식 회계 숫자는 아닙니다. 월 보고에 반영하려면 해당 지출을 수집 거래에서 전표로 확정해야 합니다.'
  });

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
            value: formatWon(operatingSummary.totals.recordedOperatingExpenseWon)
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
        <QueryErrorAlert title="차량 정보 조회에 실패했습니다." error={vehiclesError} />
      ) : null}
      {fuelLogsError ? (
        <QueryErrorAlert title="차량 연료 이력 조회에 실패했습니다." error={fuelLogsError} />
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
