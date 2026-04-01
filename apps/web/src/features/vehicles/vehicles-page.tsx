'use client';

import { useQuery } from '@tanstack/react-query';
import { Grid, Stack, Typography } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import { BarChart } from '@mui/x-charts/BarChart';
import type { FuelLogItem } from '@personal-erp/contracts';
import { formatDate, formatNumber, formatWon } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { ChartCard } from '@/shared/ui/chart-card';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SummaryCard } from '@/shared/ui/summary-card';
import { getVehicles } from './vehicles.api';

type VehicleFuelLogRow = FuelLogItem & {
  vehicleName: string;
};

const fuelTypeLabelMap: Record<string, string> = {
  GASOLINE: '가솔린',
  DIESEL: '디젤',
  HYBRID: '하이브리드',
  ELECTRIC: '전기',
  LPG: 'LPG'
};

const fuelColumns: GridColDef<VehicleFuelLogRow>[] = [
  {
    field: 'vehicleName',
    headerName: '차량',
    flex: 1
  },
  {
    field: 'filledOn',
    headerName: '주유일',
    flex: 1,
    valueFormatter: (value) => formatDate(String(value))
  },
  {
    field: 'odometerKm',
    headerName: '주행거리',
    flex: 1,
    valueFormatter: (value) => `${formatNumber(Number(value))} km`
  },
  {
    field: 'liters',
    headerName: '주유량',
    flex: 0.8,
    valueFormatter: (value) => `${formatNumber(Number(value), 3)} L`
  },
  {
    field: 'unitPriceWon',
    headerName: '리터당 단가',
    flex: 1,
    valueFormatter: (value) => `${formatNumber(Number(value))}원/L`
  },
  {
    field: 'amountWon',
    headerName: '금액',
    flex: 1,
    valueFormatter: (value) => formatWon(Number(value))
  }
];

export function VehiclesPage() {
  const { data = [], error } = useQuery({
    queryKey: ['vehicles'],
    queryFn: getVehicles
  });
  const totalMonthlyExpenseWon = data.reduce(
    (total, vehicle) => total + vehicle.monthlyExpenseWon,
    0
  );
  const vehiclesWithEfficiency = data.filter(
    (vehicle) => vehicle.estimatedFuelEfficiencyKmPerLiter != null
  );
  const averageFuelEfficiencyKmPerLiter =
    vehiclesWithEfficiency.length > 0
      ? vehiclesWithEfficiency.reduce(
          (total, vehicle) =>
            total + Number(vehicle.estimatedFuelEfficiencyKmPerLiter),
          0
        ) / vehiclesWithEfficiency.length
      : null;
  const fuelLogRows: VehicleFuelLogRow[] = data
    .flatMap((vehicle) =>
      (vehicle.fuelLogs ?? []).map((fuelLog) => ({
        ...fuelLog,
        id: `${vehicle.id}-${fuelLog.id}`,
        vehicleName: vehicle.name
      }))
    )
    .sort((left, right) => right.filledOn.localeCompare(left.filledOn));

  useDomainHelp({
    title: '차량 운영 개요',
    description:
      '차량 화면은 운영 판단과 분류를 돕는 보조 영역입니다. 공식 회계 확정은 수집 거래와 전표에서 이뤄집니다.',
    primaryEntity: '차량 운영 보조 데이터',
    relatedEntities: [
      '수집 거래 (CollectedTransaction)',
      '카테고리 (Category)',
      '자금수단 (FundingAccount)',
      '전표 (JournalEntry)'
    ],
    truthSource:
      '차량과 주유 기록 자체는 회계 저장이 아니며 실제 확정은 수집 거래 분류와 전표 반영에서 이뤄집니다.',
    readModelNote: '주유비와 연비는 비용 판단을 돕는 운영 지표입니다.'
  });

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="보조 운영 영역"
        title="차량 운영"
        description="차량과 주유 기록은 코어 회계 엔티티가 아니라 차량비를 더 정확하게 분류하고 검토하기 위한 운영 보조 데이터입니다."
      />

      {error ? (
        <QueryErrorAlert title="차량 정보 조회에 실패했습니다." error={error} />
      ) : null}
      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, md: 4 }}>
          <SummaryCard
            title="월 차량 운영비"
            value={formatWon(totalMonthlyExpenseWon)}
            subtitle="주유, 정비, 보험 등 차량 관련 운영비를 합친 월 기준 금액입니다."
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <SummaryCard
            title="평균 연비"
            value={
              averageFuelEfficiencyKmPerLiter
                ? `${formatNumber(averageFuelEfficiencyKmPerLiter)} km/L`
                : '-'
            }
            subtitle="연비가 있는 차량만 기준으로 계산한 평균 운영 지표입니다."
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <SummaryCard
            title="차량 수"
            value={`${data.length}대`}
            subtitle={
              data.length > 0
                ? data
                    .map(
                      (vehicle) =>
                        fuelTypeLabelMap[vehicle.fuelType] ?? vehicle.fuelType
                    )
                    .join(' / ')
                : '등록된 차량이 없습니다.'
            }
          />
        </Grid>
      </Grid>

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, xl: 5 }}>
          <ChartCard
            title="차량별 월 운영비"
            description="차량 운영비를 수집 거래로 분류하기 전에 비용 흐름을 빠르게 읽을 수 있도록 정리했습니다."
            chart={
              <BarChart
                height={320}
                xAxis={[
                  {
                    scaleType: 'band',
                    data: data.map((vehicle) => vehicle.name)
                  }
                ]}
                series={[
                  {
                    data: data.map((vehicle) => vehicle.monthlyExpenseWon)
                  }
                ]}
              />
            }
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 7 }}>
          <DataTableCard
            title="주유 / 충전 기록"
            description="원천 비용 판단과 수집 거래 분류 시 참고할 수 있도록 최근 기록을 차량별로 정리했습니다."
            rows={fuelLogRows}
            columns={fuelColumns}
            height={320}
          />
        </Grid>
      </Grid>

      {data.length > 0 ? (
        <Typography variant="body2" color="text.secondary">
          차량 데이터가 쌓이면 정비 이력과 수집 거래 분류 규칙까지 함께 연결하는
          확장으로 자연스럽게 이어갈 수 있습니다.
        </Typography>
      ) : null}
    </Stack>
  );
}
