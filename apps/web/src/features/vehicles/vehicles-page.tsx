'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Grid, Stack, Typography } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import { BarChart } from '@mui/x-charts/BarChart';
import type {
  VehicleFuelLogItem,
  VehicleItem,
  VehicleMaintenanceLogItem
} from '@personal-erp/contracts';
import { formatNumber, formatWon } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { ChartCard } from '@/shared/ui/chart-card';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { FormDrawer } from '@/shared/ui/form-drawer';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SummaryCard } from '@/shared/ui/summary-card';
import { VehicleFuelLogForm } from './vehicle-fuel-log-form';
import { VehicleMaintenanceForm } from './vehicle-maintenance-form';
import { VehicleForm } from './vehicle-form';
import {
  fuelColumns,
  fuelTypeLabelMap,
  maintenanceColumns
} from './vehicles.columns';
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

export function VehiclesPage() {
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
  const fuelLogRows = fuelLogs;
  const maintenanceLogRows = maintenanceLogs;
  const manufacturers = Array.from(
    new Set(vehicles.map((vehicle) => vehicle.manufacturer).filter(Boolean))
  );
  const operatingSummaryByVehicleId = new Map(
    operatingSummary.items.map((item) => [item.vehicleId, item])
  );

  const handleCreateOpen = () => {
    setFeedback(null);
    setDrawerState({ mode: 'create' });
  };

  const handleEditOpen = (vehicle: VehicleItem) => {
    setFeedback(null);
    setDrawerState({ mode: 'edit', vehicle });
  };

  const handleDrawerClose = () => {
    setDrawerState(null);
  };

  const handleFuelCreateOpen = (vehicleId?: string | null) => {
    setFeedback(null);
    setFuelDrawerState({ mode: 'create', vehicleId });
  };

  const handleFuelEditOpen = (fuelLog: VehicleFuelLogItem) => {
    setFeedback(null);
    setFuelDrawerState({ mode: 'edit', fuelLog });
  };

  const handleFuelDrawerClose = () => {
    setFuelDrawerState(null);
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

  const handleMaintenanceDrawerClose = () => {
    setMaintenanceDrawerState(null);
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

  const vehicleColumns: GridColDef<VehicleItem>[] = [
    {
      field: 'name',
      headerName: '차량명',
      flex: 1.2
    },
    {
      field: 'manufacturer',
      headerName: '제조사',
      flex: 1,
      valueFormatter: (value) => (value ? String(value) : '-')
    },
    {
      field: 'fuelType',
      headerName: '연료 종류',
      flex: 0.9,
      valueFormatter: (value) =>
        fuelTypeLabelMap[String(value)] ?? String(value)
    },
    {
      field: 'initialOdometerKm',
      headerName: '초기 주행거리',
      flex: 1,
      valueFormatter: (value) => `${formatNumber(Number(value))} km`
    },
    {
      field: 'recordedOperatingExpenseWon',
      headerName: '기록 운영비',
      flex: 1,
      valueGetter: (_value, row) =>
        operatingSummaryByVehicleId.get(row.id)?.recordedOperatingExpenseWon ??
        0,
      valueFormatter: (value) => formatWon(Number(value))
    },
    {
      field: 'estimatedFuelEfficiencyKmPerLiter',
      headerName: '입력 기준 연비',
      flex: 0.9,
      valueFormatter: (value) =>
        value == null ? '-' : `${formatNumber(Number(value), 2)} km/L`
    },
    {
      field: 'recordedFuelEfficiencyKmPerLiter',
      headerName: '기록 연비',
      flex: 0.9,
      valueGetter: (_value, row) =>
        operatingSummaryByVehicleId.get(row.id)
          ?.recordedFuelEfficiencyKmPerLiter ?? null,
      valueFormatter: (value) =>
        value == null ? '-' : `${formatNumber(Number(value), 2)} km/L`
    },
    {
      field: 'actions',
      headerName: '동작',
      flex: 0.9,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              handleEditOpen(params.row);
            }}
          >
            수정
          </Button>
          <Button
            size="small"
            variant="text"
            onClick={() => {
              handleFuelCreateOpen(params.row.id);
            }}
          >
            연료 기록
          </Button>
          <Button
            size="small"
            variant="text"
            onClick={() => {
              handleMaintenanceCreateOpen(params.row.id);
            }}
          >
            정비 기록
          </Button>
        </Stack>
      )
    }
  ];

  const fuelTableColumns: GridColDef<VehicleFuelLogItem>[] = [
    ...fuelColumns,
    {
      field: 'actions',
      headerName: '동작',
      flex: 0.8,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Button
          size="small"
          variant="outlined"
          onClick={() => {
            handleFuelEditOpen(params.row);
          }}
        >
          수정
        </Button>
      )
    }
  ];

  const maintenanceTableColumns: GridColDef<VehicleMaintenanceLogItem>[] = [
    ...maintenanceColumns,
    {
      field: 'actions',
      headerName: '동작',
      flex: 0.8,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Button
          size="small"
          variant="outlined"
          onClick={() => {
            handleMaintenanceEditOpen(params.row);
          }}
        >
          수정
        </Button>
      )
    }
  ];

  useDomainHelp({
    title: '차량 운영 개요',
    description:
      '차량 화면은 운영 판단과 분류를 돕는 보조 영역입니다. 공식 회계 확정은 수집 거래와 전표에서 이뤄집니다.',
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
      '차량과 주유 기록 자체는 회계 저장이 아니며 실제 확정은 수집 거래 분류와 전표 반영에서 이뤄집니다.',
    readModelNote:
      '주유비, 연비, 정비 이력은 차량비 판단과 운영 계획을 돕는 보조 지표입니다.'
  });

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="보조 운영 영역"
        title="차량 운영"
        description="차량과 주유 기록은 핵심 회계 데이터가 아니라 차량비를 더 정확하게 분류하고 검토하기 위한 운영 보조 데이터입니다."
        primaryActionLabel="차량 등록"
        primaryActionOnClick={handleCreateOpen}
      />

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
      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, md: 3 }}>
          <SummaryCard
            title="기록 운영비"
            value={formatWon(
              operatingSummary.totals.recordedOperatingExpenseWon
            )}
            subtitle={`연료 ${formatWon(operatingSummary.totals.fuelExpenseWon)} 및 정비 ${formatWon(
              operatingSummary.totals.maintenanceExpenseWon
            )} 누적 합계입니다.`}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <SummaryCard
            title="연료 / 충전 비용"
            value={formatWon(operatingSummary.totals.fuelExpenseWon)}
            subtitle="주유 / 충전 기록에서 집계한 누적 비용입니다."
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <SummaryCard
            title="정비 비용"
            value={formatWon(operatingSummary.totals.maintenanceExpenseWon)}
            subtitle="정비 이력에서 집계한 누적 비용입니다."
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <SummaryCard
            title="관리 중 차량 수"
            value={`${operatingSummary.totals.vehicleCount}대`}
            subtitle={
              manufacturers.length > 0
                ? manufacturers.join(' / ')
                : '등록된 차량이 없습니다.'
            }
          />
        </Grid>
      </Grid>

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, md: 6 }}>
          <SummaryCard
            title="평균 입력 연비"
            value={
              operatingSummary.totals.averageEstimatedFuelEfficiencyKmPerLiter
                ? `${formatNumber(
                    operatingSummary.totals
                      .averageEstimatedFuelEfficiencyKmPerLiter
                  )} km/L`
                : '-'
            }
            subtitle="차량 프로필에 입력된 기준 연비의 평균값입니다."
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <SummaryCard
            title="평균 기록 연비"
            value={
              operatingSummary.totals.averageRecordedFuelEfficiencyKmPerLiter
                ? `${formatNumber(
                    operatingSummary.totals
                      .averageRecordedFuelEfficiencyKmPerLiter
                  )} km/L`
                : '-'
            }
            subtitle="주유 기록 누적 거리와 연료량으로 계산한 평균값입니다."
          />
        </Grid>
      </Grid>

      <DataTableCard
        title="차량 기본 정보"
        description="차량 프로필은 기본 정보만 관리하고, 운영비와 연비 보조 지표는 별도 운영 요약 projection으로 함께 읽습니다."
        rows={vehicles}
        columns={vehicleColumns}
      />

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, xl: 5 }}>
          <ChartCard
            title="차량별 기록 운영비"
            description="차량별 연료비와 정비비 누적 합계를 운영 요약 projection으로 비교합니다."
            chart={
              <BarChart
                height={320}
                xAxis={[
                  {
                    scaleType: 'band',
                    data: operatingSummary.items.map((item) => item.vehicleName)
                  }
                ]}
                series={[
                  {
                    data: operatingSummary.items.map(
                      (item) => item.recordedOperatingExpenseWon
                    )
                  }
                ]}
              />
            }
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 7 }}>
          <DataTableCard
            title="주유 / 충전 기록"
            description="차량 기본 정보와 분리된 별도 운영 기록으로 최근 주유 / 충전 이력을 관리합니다."
            rows={fuelLogRows}
            columns={fuelTableColumns}
            actions={
              <Button
                variant="outlined"
                onClick={() => {
                  handleFuelCreateOpen(vehicles[0]?.id ?? null);
                }}
                disabled={vehicles.length === 0}
              >
                연료 기록 추가
              </Button>
            }
            height={320}
          />
        </Grid>
      </Grid>

      <DataTableCard
        title="정비 이력"
        description="차량별 정비 내용을 누적 기록해 향후 수집 거래 분류와 운영 계획 판단에 참고합니다."
        rows={maintenanceLogRows}
        columns={maintenanceTableColumns}
        actions={
          <Button
            variant="outlined"
            onClick={() => {
              handleMaintenanceCreateOpen(vehicles[0]?.id ?? null);
            }}
            disabled={vehicles.length === 0}
          >
            정비 기록 추가
          </Button>
        }
        height={360}
      />

      {vehicles.length > 0 ? (
        <Typography variant="body2" color="text.secondary">
          차량 기본 정보, 연료 이력, 정비 이력은 각각 분리해 저장하고,
          운영비/연비 요약은 `operating-summary` projection으로 기록 기준에 맞춰
          따로 읽습니다.
        </Typography>
      ) : null}

      <FormDrawer
        open={drawerState !== null}
        onClose={handleDrawerClose}
        title={drawerState?.mode === 'edit' ? '차량 수정' : '차량 등록'}
        description={
          drawerState?.mode === 'edit'
            ? '차량 기본 정보를 조정해 운영 보조 데이터와 비용 판단 흐름을 맞춥니다.'
            : '차량 기본 정보를 추가해 차량비 관련 운영 데이터의 기준선을 만듭니다.'
        }
      >
        {drawerState?.mode === 'edit' ? (
          <VehicleForm
            mode="edit"
            initialVehicle={drawerState.vehicle}
            onCompleted={handleFormCompleted}
          />
        ) : (
          <VehicleForm mode="create" onCompleted={handleFormCompleted} />
        )}
      </FormDrawer>

      <FormDrawer
        open={fuelDrawerState !== null}
        onClose={handleFuelDrawerClose}
        title={
          fuelDrawerState?.mode === 'edit' ? '연료 기록 수정' : '연료 기록 추가'
        }
        description={
          fuelDrawerState?.mode === 'edit'
            ? '차량 연료 이력을 조정해 운영 판단과 비용 검토 기준을 맞춥니다.'
            : '차량 연료 이력을 추가해 운영 보조 데이터와 비용 판단 흐름을 보강합니다.'
        }
      >
        {fuelDrawerState?.mode === 'edit' ? (
          <VehicleFuelLogForm
            vehicles={vehicles}
            mode="edit"
            initialFuelLog={fuelDrawerState.fuelLog}
            onCompleted={handleFuelCompleted}
          />
        ) : (
          <VehicleFuelLogForm
            vehicles={vehicles}
            initialVehicleId={fuelDrawerState?.vehicleId ?? null}
            onCompleted={handleFuelCompleted}
          />
        )}
      </FormDrawer>

      <FormDrawer
        open={maintenanceDrawerState !== null}
        onClose={handleMaintenanceDrawerClose}
        title={
          maintenanceDrawerState?.mode === 'edit'
            ? '정비 기록 수정'
            : '정비 기록 추가'
        }
        description={
          maintenanceDrawerState?.mode === 'edit'
            ? '차량 정비 이력을 조정해 운영 판단과 비용 검토 기준을 맞춥니다.'
            : '차량 정비 이력을 추가해 운영 보조 데이터와 비용 판단 흐름을 보강합니다.'
        }
      >
        {maintenanceDrawerState?.mode === 'edit' ? (
          <VehicleMaintenanceForm
            vehicles={vehicles}
            mode="edit"
            initialMaintenanceLog={maintenanceDrawerState.maintenanceLog}
            onCompleted={handleMaintenanceCompleted}
          />
        ) : (
          <VehicleMaintenanceForm
            vehicles={vehicles}
            initialVehicleId={maintenanceDrawerState?.vehicleId ?? null}
            onCompleted={handleMaintenanceCompleted}
          />
        )}
      </FormDrawer>
    </Stack>
  );
}
