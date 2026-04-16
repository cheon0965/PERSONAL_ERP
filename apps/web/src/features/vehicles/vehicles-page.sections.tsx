'use client';

import { Button, Chip, Grid, Stack, Typography } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import { BarChart } from '@mui/x-charts/BarChart';
import type {
  VehicleFuelLogItem,
  VehicleItem,
  VehicleMaintenanceLogItem
} from '@personal-erp/contracts';
import { ChartCard } from '@/shared/ui/chart-card';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { FormDrawer } from '@/shared/ui/form-drawer';
import { appLayout } from '@/shared/ui/layout-metrics';
import { SectionCard } from '@/shared/ui/section-card';
import { SummaryCard } from '@/shared/ui/summary-card';
import { formatNumber, formatWon } from '@/shared/lib/format';
import { VehicleFuelLogForm } from './vehicle-fuel-log-form';
import { VehicleMaintenanceForm } from './vehicle-maintenance-form';
import { VehicleForm } from './vehicle-form';
import { buildVehicleOperatingSummaryView } from './vehicles.summary';

type VehicleOperatingSummaryView = ReturnType<
  typeof buildVehicleOperatingSummaryView
>;
type VehicleOperatingSummaryItem = VehicleOperatingSummaryView['items'][number];

export function VehiclesOverviewSection({
  manufacturers,
  latestFuelLog,
  latestMaintenanceLog,
  mostExpensiveVehicle,
  operatingSummary
}: {
  manufacturers: string[];
  latestFuelLog: VehicleFuelLogItem | null;
  latestMaintenanceLog: VehicleMaintenanceLogItem | null;
  mostExpensiveVehicle: VehicleOperatingSummaryItem | null;
  operatingSummary: VehicleOperatingSummaryView;
}) {
  return (
    <Stack spacing={appLayout.sectionGap}>
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
            title="관리 차량 수"
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

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, xl: 7 }}>
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
        <Grid size={{ xs: 12, xl: 5 }}>
          <SectionCard
            title="운영 포인트"
            description="차량 프로필과 운영 기록을 분리해 보고, 비용 판단은 항상 수집 거래와 전표 흐름까지 함께 확인합니다."
          >
            <Stack spacing={1.5}>
              <VehicleInfoRow
                label="기록 운영비 최대 차량"
                value={
                  mostExpensiveVehicle
                    ? `${mostExpensiveVehicle.vehicleName} · ${formatWon(
                        mostExpensiveVehicle.recordedOperatingExpenseWon
                      )}`
                    : '기록이 아직 없습니다.'
                }
              />
              <VehicleInfoRow
                label="최근 연료 기록"
                value={
                  latestFuelLog
                    ? `${latestFuelLog.filledOn.slice(0, 10)} · ${latestFuelLog.vehicleName}`
                    : '연료 기록이 없습니다.'
                }
              />
              <VehicleInfoRow
                label="최근 정비 기록"
                value={
                  latestMaintenanceLog
                    ? `${latestMaintenanceLog.performedOn.slice(0, 10)} · ${latestMaintenanceLog.vehicleName}`
                    : '정비 기록이 없습니다.'
                }
              />
              <Typography variant="body2" color="text.secondary">
                차량 기본 정보, 연료 이력, 정비 이력은 각각 분리해 저장하고,
                운영비와 연비 요약은 `operating-summary` projection으로 따로
                읽습니다.
              </Typography>
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>
    </Stack>
  );
}

export function VehiclesFleetSection({
  manufacturers,
  vehicles,
  vehicleColumns,
  onCreateVehicle
}: {
  manufacturers: string[];
  vehicles: VehicleItem[];
  vehicleColumns: GridColDef<VehicleItem>[];
  onCreateVehicle: () => void;
}) {
  return (
    <DataTableCard
      title="차량 기본 정보"
      description="차량 프로필은 이 탭에서만 관리하고, 연료와 정비 이력은 각각 전용 탭에서 누적합니다."
      toolbar={
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
        >
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip
              label={`관리 차량 ${vehicles.length}대`}
              size="small"
              color="primary"
              variant="outlined"
            />
            <Chip
              label={
                manufacturers.length > 0
                  ? `제조사 ${manufacturers.join(' / ')}`
                  : '제조사 정보 없음'
              }
              size="small"
              variant="outlined"
            />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            각 차량 행에서 연료 기록과 정비 기록을 바로 추가할 수 있습니다.
          </Typography>
        </Stack>
      }
      rows={vehicles}
      columns={vehicleColumns}
      actions={
        <Button variant="contained" onClick={onCreateVehicle}>
          차량 등록
        </Button>
      }
    />
  );
}

export function VehiclesFuelSection({
  fuelLogRows,
  fuelTableColumns,
  latestFuelLog,
  operatingSummary,
  vehicles,
  onCreateFuelLog
}: {
  fuelLogRows: VehicleFuelLogItem[];
  fuelTableColumns: GridColDef<VehicleFuelLogItem>[];
  latestFuelLog: VehicleFuelLogItem | null;
  operatingSummary: VehicleOperatingSummaryView;
  vehicles: VehicleItem[];
  onCreateFuelLog: (vehicleId?: string | null) => void;
}) {
  return (
    <DataTableCard
      title="주유 / 충전 기록"
      description="연료 사용과 충전 이력은 이 탭에서만 관리해 차량비 검토 흐름을 단순화합니다."
      toolbar={
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
        >
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip
              label={`누적 비용 ${formatWon(operatingSummary.totals.fuelExpenseWon)}`}
              size="small"
              color="primary"
              variant="outlined"
            />
            <Chip
              label={`기록 ${fuelLogRows.length}건`}
              size="small"
              variant="outlined"
            />
            <Chip
              label={
                latestFuelLog
                  ? `최근 ${latestFuelLog.filledOn.slice(0, 10)} · ${latestFuelLog.vehicleName}`
                  : '최근 기록 없음'
              }
              size="small"
              variant="outlined"
            />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            연료 기록은 이 표에서 먼저 보고, 추가와 수정은 드로어에서 이어서
            처리합니다.
          </Typography>
        </Stack>
      }
      rows={fuelLogRows}
      columns={fuelTableColumns}
      actions={
        <Button
          variant="contained"
          onClick={() => {
            onCreateFuelLog(vehicles[0]?.id ?? null);
          }}
          disabled={vehicles.length === 0}
        >
          연료 기록 추가
        </Button>
      }
      height={360}
    />
  );
}

export function VehiclesMaintenanceSection({
  latestMaintenanceLog,
  maintenanceLogRows,
  maintenanceTableColumns,
  operatingSummary,
  vehicles,
  onCreateMaintenanceLog
}: {
  latestMaintenanceLog: VehicleMaintenanceLogItem | null;
  maintenanceLogRows: VehicleMaintenanceLogItem[];
  maintenanceTableColumns: GridColDef<VehicleMaintenanceLogItem>[];
  operatingSummary: VehicleOperatingSummaryView;
  vehicles: VehicleItem[];
  onCreateMaintenanceLog: (vehicleId?: string | null) => void;
}) {
  return (
    <DataTableCard
      title="정비 이력"
      description="정비 항목과 금액은 이 탭에서만 누적해 향후 비용 분류와 계획 판단 기준으로 사용합니다."
      toolbar={
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
        >
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip
              label={`누적 정비 비용 ${formatWon(operatingSummary.totals.maintenanceExpenseWon)}`}
              size="small"
              color="primary"
              variant="outlined"
            />
            <Chip
              label={`기록 ${maintenanceLogRows.length}건`}
              size="small"
              variant="outlined"
            />
            <Chip
              label={
                latestMaintenanceLog
                  ? `최근 ${latestMaintenanceLog.performedOn.slice(0, 10)} · ${latestMaintenanceLog.vehicleName}`
                  : '최근 기록 없음'
              }
              size="small"
              variant="outlined"
            />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            정비 기록은 이 표를 기준으로 확인하고, 추가와 수정은 드로어에서
            이어서 처리합니다.
          </Typography>
        </Stack>
      }
      rows={maintenanceLogRows}
      columns={maintenanceTableColumns}
      actions={
        <Button
          variant="contained"
          onClick={() => {
            onCreateMaintenanceLog(vehicles[0]?.id ?? null);
          }}
          disabled={vehicles.length === 0}
        >
          정비 기록 추가
        </Button>
      }
      height={360}
    />
  );
}

export function VehiclesFormDrawers({
  drawerState,
  fuelDrawerState,
  maintenanceDrawerState,
  vehicles,
  onCloseVehicleDrawer,
  onCloseFuelDrawer,
  onCloseMaintenanceDrawer,
  onVehicleCompleted,
  onFuelCompleted,
  onMaintenanceCompleted
}: {
  drawerState:
    | { mode: 'create' }
    | { mode: 'edit'; vehicle: VehicleItem }
    | null;
  fuelDrawerState:
    | { mode: 'create'; vehicleId?: string | null }
    | { mode: 'edit'; fuelLog: VehicleFuelLogItem }
    | null;
  maintenanceDrawerState:
    | { mode: 'create'; vehicleId?: string | null }
    | { mode: 'edit'; maintenanceLog: VehicleMaintenanceLogItem }
    | null;
  vehicles: VehicleItem[];
  onCloseVehicleDrawer: () => void;
  onCloseFuelDrawer: () => void;
  onCloseMaintenanceDrawer: () => void;
  onVehicleCompleted: (vehicle: VehicleItem, mode: 'create' | 'edit') => void;
  onFuelCompleted: (
    fuelLog: VehicleFuelLogItem,
    mode: 'create' | 'edit'
  ) => void;
  onMaintenanceCompleted: (
    maintenanceLog: VehicleMaintenanceLogItem,
    mode: 'create' | 'edit'
  ) => void;
}) {
  return (
    <>
      <FormDrawer
        open={drawerState !== null}
        onClose={onCloseVehicleDrawer}
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
            onCompleted={onVehicleCompleted}
          />
        ) : (
          <VehicleForm mode="create" onCompleted={onVehicleCompleted} />
        )}
      </FormDrawer>

      <FormDrawer
        open={fuelDrawerState !== null}
        onClose={onCloseFuelDrawer}
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
            onCompleted={onFuelCompleted}
          />
        ) : (
          <VehicleFuelLogForm
            vehicles={vehicles}
            initialVehicleId={fuelDrawerState?.vehicleId ?? null}
            onCompleted={onFuelCompleted}
          />
        )}
      </FormDrawer>

      <FormDrawer
        open={maintenanceDrawerState !== null}
        onClose={onCloseMaintenanceDrawer}
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
            onCompleted={onMaintenanceCompleted}
          />
        ) : (
          <VehicleMaintenanceForm
            vehicles={vehicles}
            initialVehicleId={maintenanceDrawerState?.vehicleId ?? null}
            onCompleted={onMaintenanceCompleted}
          />
        )}
      </FormDrawer>
    </>
  );
}

function VehicleInfoRow({
  label,
  value
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Stack>
  );
}
