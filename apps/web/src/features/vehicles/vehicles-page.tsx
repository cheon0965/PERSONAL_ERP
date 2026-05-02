'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack } from '@mui/material';
import type {
  VehicleFuelLogItem,
  VehicleItem,
  VehicleMaintenanceLogItem,
  VehicleOperatingSummaryView
} from '@personal-erp/contracts';
import { subtractMoneyWon } from '@personal-erp/money';
import { buildErrorFeedback } from '@/shared/api/fetch-json';
import { formatWon } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { useAppNotification } from '@/shared/providers/notification-provider';
import { ConfirmActionDialog } from '@/shared/ui/confirm-action-dialog';
import {
  FeedbackAlert,
  type FeedbackAlertValue
} from '@/shared/ui/feedback-alert';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import {
  deleteVehicleFuelLog,
  deleteVehicleMaintenanceLog,
  getVehicleFuelLogs,
  getVehicleMaintenanceLogs,
  getVehicleOperatingSummary,
  getVehicles,
  removeVehicleFuelLogItem,
  removeVehicleMaintenanceLogItem,
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
  VehiclesOverviewSection,
  type VehicleFleetFilters,
  type VehicleFuelLogFilters,
  type VehicleMaintenanceLogFilters
} from './vehicles-page.sections';
import {
  VehiclesSectionNav,
  type VehicleWorkspaceSection
} from './vehicles-section-nav';
import { buildVehicleOperatingSummaryView } from './vehicles.summary';

type SubmitFeedback = FeedbackAlertValue;

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

type VehicleLogDeleteTarget =
  | { kind: 'fuel'; fuelLog: VehicleFuelLogItem }
  | { kind: 'maintenance'; maintenanceLog: VehicleMaintenanceLogItem }
  | null;

export function VehiclesPage({
  section = 'overview'
}: {
  section?: VehicleWorkspaceSection;
}) {
  const queryClient = useQueryClient();
  const { notifySuccess } = useAppNotification();
  const [feedback, setFeedback] = React.useState<SubmitFeedback>(null);
  const [drawerState, setDrawerState] =
    React.useState<VehicleDrawerState>(null);
  const [fuelDrawerState, setFuelDrawerState] =
    React.useState<VehicleFuelDrawerState>(null);
  const [maintenanceDrawerState, setMaintenanceDrawerState] =
    React.useState<VehicleMaintenanceDrawerState>(null);
  const [deleteTarget, setDeleteTarget] =
    React.useState<VehicleLogDeleteTarget>(null);
  const [fleetFilters, setFleetFilters] = React.useState<VehicleFleetFilters>({
    keyword: '',
    manufacturer: '',
    fuelType: ''
  });
  const [fuelFilters, setFuelFilters] = React.useState<VehicleFuelLogFilters>({
    keyword: '',
    vehicleName: '',
    linkStatus: ''
  });
  const [maintenanceFilters, setMaintenanceFilters] =
    React.useState<VehicleMaintenanceLogFilters>({
      keyword: '',
      vehicleName: '',
      category: '',
      linkStatus: ''
    });
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
  const fuelTypeOptions = readUniqueSortedValues(
    vehicles.map((vehicle) => vehicle.fuelType)
  );
  const vehicleNameOptions = readUniqueSortedValues(
    vehicles.map((vehicle) => vehicle.name)
  );
  const maintenanceCategoryOptions = readUniqueSortedValues(
    maintenanceLogs.map((maintenanceLog) => maintenanceLog.category)
  );
  const filteredVehicles = React.useMemo(
    () => filterVehicles(vehicles, fleetFilters),
    [fleetFilters, vehicles]
  );
  const filteredFuelLogs = React.useMemo(
    () => filterVehicleFuelLogs(fuelLogs, fuelFilters),
    [fuelFilters, fuelLogs]
  );
  const filteredMaintenanceLogs = React.useMemo(
    () => filterVehicleMaintenanceLogs(maintenanceLogs, maintenanceFilters),
    [maintenanceFilters, maintenanceLogs]
  );
  const operatingSummaryByVehicleId = new Map(
    operatingSummary.items.map((item) => [item.vehicleId, item])
  );
  const latestFuelLog =
    fuelLogs.length > 0 ? readLatestFuelLog(fuelLogs) : null;
  const latestMaintenanceLog =
    maintenanceLogs.length > 0
      ? readLatestMaintenanceLog(maintenanceLogs)
      : null;
  const latestFilteredFuelLog = readLatestFuelLog(filteredFuelLogs);
  const latestFilteredMaintenanceLog = readLatestMaintenanceLog(
    filteredMaintenanceLogs
  );
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
      ? '차량 프로필, 연료 기록, 정비 이력을 분리해 관리하고 필요하면 회계 연동까지 이어서 차량별 운영비를 점검하는 화면입니다.'
      : section === 'fleet'
        ? '차량 프로필만 집중해서 관리하고, 연료/정비 이력은 각각의 전용 화면으로 분리해 읽기 쉽게 정리했습니다.'
        : section === 'fuel'
          ? '주유와 충전 이력을 모아 보고, 필요하면 수집거래 연동까지 함께 관리합니다.'
          : '정비 이력을 모아 보고, 필요하면 수집거래 연동까지 함께 관리합니다.';

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
  const deleteMutation = useMutation({
    mutationFn: async (target: Exclude<VehicleLogDeleteTarget, null>) => {
      if (target.kind === 'fuel') {
        await deleteVehicleFuelLog(target.fuelLog.vehicleId, target.fuelLog.id);
        return target;
      }

      await deleteVehicleMaintenanceLog(
        target.maintenanceLog.vehicleId,
        target.maintenanceLog.id
      );
      return target;
    },
    onSuccess: async (deletedTarget) => {
      if (deletedTarget.kind === 'fuel') {
        queryClient.setQueryData<VehicleFuelLogItem[]>(
          vehicleFuelLogsQueryKey,
          (current) =>
            removeVehicleFuelLogItem(current, deletedTarget.fuelLog.id)
        );
        notifySuccess(
          `${deletedTarget.fuelLog.vehicleName} 연료 기록을 삭제했습니다. 연결된 미확정 수집거래가 있으면 함께 정리했습니다.`
        );
      } else {
        queryClient.setQueryData<VehicleMaintenanceLogItem[]>(
          vehicleMaintenanceLogsQueryKey,
          (current) =>
            removeVehicleMaintenanceLogItem(
              current,
              deletedTarget.maintenanceLog.id
            )
        );
        notifySuccess(
          `${deletedTarget.maintenanceLog.vehicleName} 정비 기록을 삭제했습니다. 연결된 미확정 수집거래가 있으면 함께 정리했습니다.`
        );
      }

      queryClient.setQueryData<VehicleOperatingSummaryView>(
        vehicleOperatingSummaryQueryKey,
        buildVehicleOperatingSummaryView({
          vehicles:
            queryClient.getQueryData<VehicleItem[]>(vehiclesQueryKey) ?? [],
          fuelLogs:
            queryClient.getQueryData<VehicleFuelLogItem[]>(
              vehicleFuelLogsQueryKey
            ) ?? [],
          maintenanceLogs:
            queryClient.getQueryData<VehicleMaintenanceLogItem[]>(
              vehicleMaintenanceLogsQueryKey
            ) ?? []
        })
      );
      setDeleteTarget(null);

      await queryClient.invalidateQueries({
        queryKey:
          deletedTarget.kind === 'fuel'
            ? vehicleFuelLogsQueryKey
            : vehicleMaintenanceLogsQueryKey
      });
      await queryClient.invalidateQueries({
        queryKey: vehicleOperatingSummaryQueryKey
      });
    },
    onError: (error) => {
      setFeedback(
        buildErrorFeedback(error, '차량 기록을 삭제하지 못했습니다.')
      );
    }
  });

  const handleFormCompleted = (
    vehicle: VehicleItem,
    mode: 'create' | 'edit'
  ) => {
    setDrawerState(null);
    notifySuccess(
      mode === 'edit'
        ? `${vehicle.name} 차량 정보를 수정했습니다.`
        : `${vehicle.name} 차량을 등록했습니다.`
    );
  };

  const handleFuelCompleted = (
    fuelLog: VehicleFuelLogItem,
    mode: 'create' | 'edit'
  ) => {
    setFuelDrawerState(null);
    notifySuccess(
      mode === 'edit'
        ? `${fuelLog.vehicleName} 연료 기록을 수정했습니다.`
        : `${fuelLog.vehicleName} 연료 기록을 추가했습니다.`
    );
  };

  const handleMaintenanceCompleted = (
    maintenanceLog: VehicleMaintenanceLogItem,
    mode: 'create' | 'edit'
  ) => {
    setMaintenanceDrawerState(null);
    notifySuccess(
      mode === 'edit'
        ? `${maintenanceLog.vehicleName} 정비 기록을 수정했습니다.`
        : `${maintenanceLog.vehicleName} 정비 기록을 추가했습니다.`
    );
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
    onEditFuelLog: handleFuelEditOpen,
    onDeleteFuelLog: (fuelLog) => {
      setFeedback(null);
      setDeleteTarget({ kind: 'fuel', fuelLog });
    }
  });
  const maintenanceTableColumns = buildMaintenanceLogColumns({
    onEditMaintenanceLog: handleMaintenanceEditOpen,
    onDeleteMaintenanceLog: (maintenanceLog) => {
      setFeedback(null);
      setDeleteTarget({ kind: 'maintenance', maintenanceLog });
    }
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
        metadataSingleRow
        primaryActionLabel={primaryAction.label}
        primaryActionOnClick={primaryAction.onClick}
        primaryActionDisabled={primaryAction.disabled}
        secondaryActionLabel={secondaryAction.label}
        secondaryActionHref={secondaryAction.href}
      />

      <VehiclesSectionNav />

      <FeedbackAlert feedback={feedback} />
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
          filters={fleetFilters}
          fuelTypeOptions={fuelTypeOptions}
          manufacturers={manufacturers}
          vehicles={filteredVehicles}
          vehicleColumns={vehicleColumns}
          onFiltersChange={setFleetFilters}
          onCreateVehicle={handleCreateOpen}
        />
      ) : null}

      {section === 'fuel' ? (
        <VehiclesFuelSection
          filters={fuelFilters}
          fuelLogRows={filteredFuelLogs}
          fuelTableColumns={fuelTableColumns}
          latestFuelLog={latestFilteredFuelLog}
          operatingSummary={operatingSummary}
          vehicleOptions={vehicleNameOptions}
          vehicles={vehicles}
          onFiltersChange={setFuelFilters}
          onCreateFuelLog={handleFuelCreateOpen}
        />
      ) : null}

      {section === 'maintenance' ? (
        <VehiclesMaintenanceSection
          categoryOptions={maintenanceCategoryOptions}
          filters={maintenanceFilters}
          latestMaintenanceLog={latestFilteredMaintenanceLog}
          maintenanceLogRows={filteredMaintenanceLogs}
          maintenanceTableColumns={maintenanceTableColumns}
          operatingSummary={operatingSummary}
          vehicleOptions={vehicleNameOptions}
          vehicles={vehicles}
          onFiltersChange={setMaintenanceFilters}
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

      <ConfirmActionDialog
        open={deleteTarget !== null}
        title={
          deleteTarget?.kind === 'fuel' ? '연료 기록 삭제' : '정비 기록 삭제'
        }
        description={buildDeleteDialogDescription(deleteTarget)}
        confirmLabel="삭제"
        pendingLabel="삭제 중..."
        confirmColor="error"
        busy={deleteMutation.isPending}
        onClose={() => {
          if (!deleteMutation.isPending) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={() => {
          if (deleteTarget) {
            void deleteMutation.mutateAsync(deleteTarget);
          }
        }}
      />
    </Stack>
  );
}

function buildDeleteDialogDescription(target: VehicleLogDeleteTarget) {
  if (!target) {
    return '';
  }

  const link =
    target.kind === 'fuel'
      ? target.fuelLog.linkedCollectedTransaction
      : target.maintenanceLog.linkedCollectedTransaction;
  const vehicleName =
    target.kind === 'fuel'
      ? target.fuelLog.vehicleName
      : target.maintenanceLog.vehicleName;
  const logLabel = target.kind === 'fuel' ? '연료 기록' : '정비 기록';

  if (!link) {
    return `${vehicleName}의 ${logLabel}만 삭제합니다.`;
  }

  return `${vehicleName}의 ${logLabel}과 연결된 미확정 수집거래를 같은 작업에서 함께 삭제합니다. 이미 전표로 확정된 기록은 삭제할 수 없고 전표 상세에서 반전 또는 정정으로 조정합니다.`;
}

function filterVehicles(vehicles: VehicleItem[], filters: VehicleFleetFilters) {
  const keyword = normalizeFilterText(filters.keyword);

  return vehicles.filter((vehicle) => {
    if (filters.manufacturer && vehicle.manufacturer !== filters.manufacturer) {
      return false;
    }

    if (filters.fuelType && vehicle.fuelType !== filters.fuelType) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    const haystack = normalizeFilterText(
      [vehicle.name, vehicle.manufacturer, vehicle.fuelType]
        .filter(Boolean)
        .join(' ')
    );

    return haystack.includes(keyword);
  });
}

function filterVehicleFuelLogs(
  logs: VehicleFuelLogItem[],
  filters: VehicleFuelLogFilters
) {
  const keyword = normalizeFilterText(filters.keyword);

  return logs.filter((log) => {
    if (filters.vehicleName && log.vehicleName !== filters.vehicleName) {
      return false;
    }

    if (filters.linkStatus === 'LINKED' && !log.linkedCollectedTransaction) {
      return false;
    }

    if (filters.linkStatus === 'UNLINKED' && log.linkedCollectedTransaction) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    const link = log.linkedCollectedTransaction;
    const haystack = normalizeFilterText(
      [
        log.vehicleName,
        log.filledOn,
        String(log.odometerKm),
        String(log.liters),
        String(log.amountWon),
        link?.postingStatus,
        link?.postedJournalEntryNumber
      ]
        .filter(Boolean)
        .join(' ')
    );

    return haystack.includes(keyword);
  });
}

function filterVehicleMaintenanceLogs(
  logs: VehicleMaintenanceLogItem[],
  filters: VehicleMaintenanceLogFilters
) {
  const keyword = normalizeFilterText(filters.keyword);

  return logs.filter((log) => {
    if (filters.vehicleName && log.vehicleName !== filters.vehicleName) {
      return false;
    }

    if (filters.category && log.category !== filters.category) {
      return false;
    }

    if (filters.linkStatus === 'LINKED' && !log.linkedCollectedTransaction) {
      return false;
    }

    if (filters.linkStatus === 'UNLINKED' && log.linkedCollectedTransaction) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    const link = log.linkedCollectedTransaction;
    const haystack = normalizeFilterText(
      [
        log.vehicleName,
        log.performedOn,
        log.category,
        log.vendor,
        log.description,
        log.memo,
        String(log.amountWon),
        link?.postingStatus,
        link?.postedJournalEntryNumber
      ]
        .filter(Boolean)
        .join(' ')
    );

    return haystack.includes(keyword);
  });
}

function readLatestFuelLog(logs: VehicleFuelLogItem[]) {
  return (
    [...logs]
      .sort((left, right) => left.filledOn.localeCompare(right.filledOn))
      .at(-1) ?? null
  );
}

function readLatestMaintenanceLog(logs: VehicleMaintenanceLogItem[]) {
  return (
    [...logs]
      .sort((left, right) => left.performedOn.localeCompare(right.performedOn))
      .at(-1) ?? null
  );
}

function normalizeFilterText(value: string) {
  return value.trim().toLocaleLowerCase('ko-KR');
}

function readUniqueSortedValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value)))
  ).sort((left, right) => left.localeCompare(right, 'ko-KR'));
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
            title: '이 화면에서 진행할 일',
            items: [
              '차량명, 제조사, 연료 종류, 초기 주행거리 같은 기본 프로필을 등록합니다.',
              '목록에서 상태와 기본 정보를 확인한 뒤 필요한 차량만 수정합니다.',
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
          '연료 기록은 운영 이력이면서, 회계 연동을 켜면 연결된 지출 거래와 전표 흐름까지 이어집니다.',
        supplementarySections: [
          {
            title: '이 화면에서 진행할 일',
            items: [
              '차량 필터와 최근 기록을 보고 입력할 차량과 누락된 주유일을 먼저 확인합니다.',
              '주유일 또는 충전일, 주행거리, 수량, 금액을 남겨 차량별 연료 이력을 누적합니다.',
              '최근 연료 기록과 차량별 누적 운영비를 함께 보며 이상치가 없는지 점검합니다.',
              '필요하면 저장과 함께 수집 거래를 만들고, 이후 전표 확정 여부를 이어서 확인합니다.'
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
          '정비 이력은 운영 기록이면서, 회계 연동을 켜면 연결된 지출 거래와 전표 흐름까지 이어집니다.',
        supplementarySections: [
          {
            title: '이 화면에서 진행할 일',
            items: [
              '차량 필터와 최근 정비 내역을 보고 반복 정비 또는 누락된 정비 항목을 먼저 찾습니다.',
              '정비일, 정비 분류, 주행거리, 금액을 남겨 차량별 정비 이력을 누적합니다.',
              '최근 정비 기록과 차량별 누적 운영비를 비교해 반복 정비나 큰 지출이 있었는지 확인합니다.',
              '필요하면 저장과 함께 수집 거래를 만들고, 이후 전표 확정 여부를 최종 확인합니다.'
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
          '차량과 운영 이력은 기본적으로 운영 데이터이고, 회계 연동을 켜면 수집 거래와 전표 흐름까지 이어집니다.',
        supplementarySections: [
          {
            title: '이 화면에서 먼저 볼 것',
            items: [
              '상단 요약과 차량별 운영비 흐름으로 전체 차량 운영 상태를 먼저 봅니다.',
              '최근 연료 기록, 최근 정비 기록, 비용이 큰 차량을 확인해 어떤 탭으로 내려갈지 결정합니다.',
              '연료·정비 입력이 회계 지출까지 이어져야 한다면 저장 시 수집 거래 생성 옵션을 함께 확인합니다.',
              '세부 등록과 수정은 차량 목록, 연료 기록, 정비 이력 탭으로 나눠 진행합니다.'
            ]
          },
          {
            title: '이어지는 화면',
            links: commonLinks
          }
        ],
        readModelNote:
          '차량 운영비 카드 자체는 참고 수치입니다. 다만 연료/정비 저장 시 회계 연동을 켜고 수집거래를 확정하면 월 보고에도 자연스럽게 반영됩니다.'
      };
  }
}
