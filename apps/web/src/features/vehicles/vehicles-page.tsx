'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Grid, Stack, Tab, Tabs, Typography } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import type {
  VehicleFuelLogItem,
  VehicleItem,
  VehicleMaintenanceLogItem
} from '@personal-erp/contracts';
import { subtractMoneyWon } from '@personal-erp/money';
import { formatNumber, formatWon } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { ChartCard } from '@/shared/ui/chart-card';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { FormDrawer } from '@/shared/ui/form-drawer';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import { SummaryCard } from '@/shared/ui/summary-card';
import { VehicleFuelLogForm } from './vehicle-fuel-log-form';
import { VehicleMaintenanceForm } from './vehicle-maintenance-form';
import { VehicleForm } from './vehicle-form';
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

type VehicleWorkspaceTab = 'overview' | 'vehicles' | 'fuel' | 'maintenance';

export function VehiclesPage() {
  const [feedback, setFeedback] = React.useState<SubmitFeedback>(null);
  const [activeTab, setActiveTab] =
    React.useState<VehicleWorkspaceTab>('overview');
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
  const latestFuelLog =
    fuelLogRows.length > 0
      ? [...fuelLogRows].sort((left, right) => left.filledOn.localeCompare(right.filledOn)).at(-1) ?? null
      : null;
  const latestMaintenanceLog =
    maintenanceLogRows.length > 0
      ? [...maintenanceLogRows]
          .sort((left, right) => left.performedOn.localeCompare(right.performedOn))
          .at(-1) ?? null
      : null;
  const mostExpensiveVehicle =
    operatingSummary.items.length > 0
      ? [...operatingSummary.items].sort(
          (left, right) =>
            subtractMoneyWon(
              right.recordedOperatingExpenseWon,
              left.recordedOperatingExpenseWon
            )
        )[0]
      : null;
  const activeTabLabel =
    activeTab === 'overview'
      ? '개요'
      : activeTab === 'vehicles'
        ? '차량'
        : activeTab === 'fuel'
          ? '연료'
          : '정비';
  const contextualAction =
    activeTab === 'maintenance'
      ? {
          label: '정비 기록 추가',
          onClick: () => {
            handleMaintenanceCreateOpen(vehicles[0]?.id ?? null);
          }
        }
      : activeTab === 'vehicles'
        ? null
        : {
            label: '연료 기록 추가',
            onClick: () => {
              handleFuelCreateOpen(vehicles[0]?.id ?? null);
            }
          };

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
        title="차량 운영"
        description="차량 프로필, 연료 기록, 정비 이력을 분리해 관리하고 차량별 운영비를 점검하는 화면입니다."
        badges={[
          {
            label: `현재 보기 · ${activeTabLabel}`,
            color: 'primary'
          },
          {
            label: `연료 ${fuelLogRows.length}건`
          },
          {
            label: `정비 ${maintenanceLogRows.length}건`
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
        primaryActionLabel="차량 등록"
        primaryActionOnClick={handleCreateOpen}
        secondaryActionLabel={contextualAction?.label}
        secondaryActionOnClick={contextualAction?.onClick}
        secondaryActionDisabled={
          contextualAction ? vehicles.length === 0 : undefined
        }
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
      <Tabs
        value={activeTab}
        onChange={(_event, nextValue: VehicleWorkspaceTab) => {
          setActiveTab(nextValue);
        }}
        variant="scrollable"
        allowScrollButtonsMobile
      >
        <Tab value="overview" label="개요" />
        <Tab value="vehicles" label={`차량 ${vehicles.length}`} />
        <Tab value="fuel" label={`연료 ${fuelLogRows.length}`} />
        <Tab value="maintenance" label={`정비 ${maintenanceLogRows.length}`} />
      </Tabs>

      {activeTab === 'overview' ? (
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
      ) : null}

      {activeTab === 'vehicles' ? (
        <Stack spacing={appLayout.sectionGap}>
          <DataTableCard
            title="차량 기본 정보"
            description="차량 프로필은 이 탭에서만 관리하고, 연료와 정비 이력은 각각 전용 탭에서 누적합니다."
            rows={vehicles}
            columns={vehicleColumns}
            actions={
              <Button variant="contained" onClick={handleCreateOpen}>
                차량 등록
              </Button>
            }
          />
          <Typography variant="body2" color="text.secondary">
            각 차량 행에서 연료 기록과 정비 기록을 바로 추가할 수 있습니다.
          </Typography>
        </Stack>
      ) : null}

      {activeTab === 'fuel' ? (
        <Stack spacing={appLayout.sectionGap}>
          <Grid container spacing={appLayout.sectionGap}>
            <Grid size={{ xs: 12, md: 6 }}>
              <SummaryCard
                title="누적 연료 / 충전 비용"
                value={formatWon(operatingSummary.totals.fuelExpenseWon)}
                subtitle={`${fuelLogRows.length}건의 기록을 기준으로 집계했습니다.`}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <SummaryCard
                title="최근 연료 기록"
                value={
                  latestFuelLog ? latestFuelLog.filledOn.slice(0, 10) : '-'
                }
                subtitle={
                  latestFuelLog
                    ? `${latestFuelLog.vehicleName} · ${formatWon(latestFuelLog.amountWon)}`
                    : '등록된 연료 기록이 없습니다.'
                }
              />
            </Grid>
          </Grid>

          <DataTableCard
            title="주유 / 충전 기록"
            description="연료 사용과 충전 이력은 이 탭에서만 관리해 차량비 검토 흐름을 단순화합니다."
            rows={fuelLogRows}
            columns={fuelTableColumns}
            actions={
              <Button
                variant="contained"
                onClick={() => {
                  handleFuelCreateOpen(vehicles[0]?.id ?? null);
                }}
                disabled={vehicles.length === 0}
              >
                연료 기록 추가
              </Button>
            }
            height={360}
          />
        </Stack>
      ) : null}

      {activeTab === 'maintenance' ? (
        <Stack spacing={appLayout.sectionGap}>
          <Grid container spacing={appLayout.sectionGap}>
            <Grid size={{ xs: 12, md: 6 }}>
              <SummaryCard
                title="누적 정비 비용"
                value={formatWon(operatingSummary.totals.maintenanceExpenseWon)}
                subtitle={`${maintenanceLogRows.length}건의 기록을 기준으로 집계했습니다.`}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <SummaryCard
                title="최근 정비 기록"
                value={
                  latestMaintenanceLog
                    ? latestMaintenanceLog.performedOn.slice(0, 10)
                    : '-'
                }
                subtitle={
                  latestMaintenanceLog
                    ? `${latestMaintenanceLog.vehicleName} · ${formatWon(
                        latestMaintenanceLog.amountWon
                      )}`
                    : '등록된 정비 기록이 없습니다.'
                }
              />
            </Grid>
          </Grid>

          <DataTableCard
            title="정비 이력"
            description="정비 항목과 금액은 이 탭에서만 누적해 향후 비용 분류와 계획 판단 기준으로 사용합니다."
            rows={maintenanceLogRows}
            columns={maintenanceTableColumns}
            actions={
              <Button
                variant="contained"
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
        </Stack>
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
