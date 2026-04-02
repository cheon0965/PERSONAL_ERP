import type { VehicleItem } from '@personal-erp/contracts';
import { fetchJson } from '@/shared/api/fetch-json';

export const mockVehicles: VehicleItem[] = [
  {
    id: 'veh-1',
    name: '포터2 배송차량',
    manufacturer: 'Hyundai',
    fuelType: 'DIESEL',
    initialOdometerKm: 128000,
    monthlyExpenseWon: 286000,
    estimatedFuelEfficiencyKmPerLiter: 10.8,
    fuelLogs: [
      {
        id: 'fuel-1',
        filledOn: '2026-03-03',
        odometerKm: 128240,
        liters: 52.3,
        amountWon: 84000,
        unitPriceWon: 1606,
        isFullTank: true
      },
      {
        id: 'fuel-2',
        filledOn: '2026-03-15',
        odometerKm: 128695,
        liters: 49.6,
        amountWon: 80100,
        unitPriceWon: 1615,
        isFullTank: true
      }
    ]
  }
];

export function getVehicles() {
  return fetchJson<VehicleItem[]>('/vehicles', mockVehicles);
}
