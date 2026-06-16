import type {
  VehicleFuelLogItem,
  VehicleMaintenanceLogItem
} from '@personal-erp/contracts';
import type { GridColDef } from '@mui/x-data-grid';
import { formatDate, formatNumber, formatWon } from '@/shared/lib/format';

export const fuelTypeLabelMap: Record<string, string> = {
  GASOLINE: '가솔린',
  DIESEL: '디젤',
  HYBRID: '하이브리드',
  ELECTRIC: '전기',
  LPG: 'LPG'
};

export const maintenanceCategoryLabelMap: Record<string, string> = {
  INSPECTION: '점검',
  REPAIR: '수리',
  CONSUMABLE: '소모품',
  TIRE: '타이어',
  ACCIDENT: '사고',
  OTHER: '기타'
};

export const fuelColumns: GridColDef<VehicleFuelLogItem>[] = [
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
  },
  {
    field: 'isFullTank',
    headerName: '가득 주유',
    flex: 0.8,
    valueFormatter: (value) => (value ? '예' : '아니오')
  }
];

export const maintenanceColumns: GridColDef<VehicleMaintenanceLogItem>[] = [
  {
    field: 'vehicleName',
    headerName: '차량',
    flex: 1
  },
  {
    field: 'performedOn',
    headerName: '정비일',
    flex: 0.9,
    valueFormatter: (value) => formatDate(String(value))
  },
  {
    field: 'category',
    headerName: '구분',
    flex: 0.8,
    valueFormatter: (value) =>
      maintenanceCategoryLabelMap[String(value)] ?? String(value)
  },
  {
    field: 'description',
    headerName: '정비 내용',
    flex: 1.4
  },
  {
    field: 'odometerKm',
    headerName: '주행거리',
    flex: 0.9,
    valueFormatter: (value) => `${formatNumber(Number(value))} km`
  },
  {
    field: 'amountWon',
    headerName: '비용',
    flex: 0.9,
    valueFormatter: (value) => formatWon(Number(value))
  }
];
