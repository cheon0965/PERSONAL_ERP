import { Button, Stack } from '@mui/material';
import type {
  VehicleFuelLogItem,
  VehicleItem,
  VehicleMaintenanceLogItem,
  VehicleOperatingSummaryItem
} from '@personal-erp/contracts';
import type { GridColDef } from '@mui/x-data-grid';
import { formatNumber, formatWon } from '@/shared/lib/format';
import {
  fuelColumns,
  fuelTypeLabelMap,
  maintenanceColumns
} from './vehicles.columns';

type VehicleColumnsInput = {
  operatingSummaryByVehicleId: Map<string, VehicleOperatingSummaryItem>;
  onEditVehicle: (vehicle: VehicleItem) => void;
  onCreateFuelLog: (vehicleId?: string | null) => void;
  onCreateMaintenanceLog: (vehicleId?: string | null) => void;
};

export function buildVehicleColumns({
  operatingSummaryByVehicleId,
  onEditVehicle,
  onCreateFuelLog,
  onCreateMaintenanceLog
}: VehicleColumnsInput): GridColDef<VehicleItem>[] {
  return [
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
              onEditVehicle(params.row);
            }}
          >
            수정
          </Button>
          <Button
            size="small"
            variant="text"
            onClick={() => {
              onCreateFuelLog(params.row.id);
            }}
          >
            연료 기록
          </Button>
          <Button
            size="small"
            variant="text"
            onClick={() => {
              onCreateMaintenanceLog(params.row.id);
            }}
          >
            정비 기록
          </Button>
        </Stack>
      )
    }
  ];
}

export function buildFuelLogColumns({
  onEditFuelLog
}: {
  onEditFuelLog: (fuelLog: VehicleFuelLogItem) => void;
}): GridColDef<VehicleFuelLogItem>[] {
  return [
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
            onEditFuelLog(params.row);
          }}
        >
          수정
        </Button>
      )
    }
  ];
}

export function buildMaintenanceLogColumns({
  onEditMaintenanceLog
}: {
  onEditMaintenanceLog: (maintenanceLog: VehicleMaintenanceLogItem) => void;
}): GridColDef<VehicleMaintenanceLogItem>[] {
  return [
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
            onEditMaintenanceLog(params.row);
          }}
        >
          수정
        </Button>
      )
    }
  ];
}
