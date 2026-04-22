import type { RequestTestState } from './request-api.test-types';

export function createRequestAssetStateFixtures(): Pick<
  RequestTestState,
  'insurancePolicies' | 'vehicles' | 'vehicleMaintenanceLogs'
> {
  return {
    insurancePolicies: [
      {
        id: 'policy-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        provider: '삼성화재',
        productName: '업무용 차량 보험',
        monthlyPremiumWon: 42_000,
        paymentDay: 25,
        cycle: 'MONTHLY',
        accountId: 'acc-1',
        categoryId: 'cat-1c',
        recurringStartDate: new Date('2026-03-25T00:00:00.000Z'),
        linkedRecurringRuleId: null,
        renewalDate: new Date('2026-11-01T00:00:00.000Z'),
        maturityDate: null,
        isActive: true
      },
      {
        id: 'policy-2',
        userId: 'user-2',
        tenantId: 'tenant-2',
        ledgerId: 'ledger-2',
        provider: 'DB손해보험',
        productName: '사업장 화재 보험',
        monthlyPremiumWon: 250_000,
        paymentDay: 20,
        cycle: 'MONTHLY',
        accountId: 'acc-2',
        categoryId: 'cat-2',
        recurringStartDate: new Date('2026-03-20T00:00:00.000Z'),
        linkedRecurringRuleId: null,
        renewalDate: new Date('2026-10-15T00:00:00.000Z'),
        maturityDate: null,
        isActive: true
      }
    ],
    vehicles: [
      {
        id: 'vehicle-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        name: '배송 밴',
        manufacturer: 'Hyundai',
        fuelType: 'DIESEL',
        initialOdometerKm: 58_200,
        estimatedFuelEfficiencyKmPerLiter: 11.2,
        defaultFundingAccountId: null,
        defaultFuelCategoryId: null,
        defaultMaintenanceCategoryId: null,
        operatingExpensePlanOptIn: false,
        createdAt: new Date('2026-03-01T08:00:00.000Z'),
        fuelLogs: [
          {
            id: 'fuel-1',
            filledOn: new Date('2026-03-05T00:00:00.000Z'),
            odometerKm: 58_480,
            liters: 42.5,
            amountWon: 72_000,
            unitPriceWon: 1694,
            isFullTank: true
          }
        ]
      },
      {
        id: 'vehicle-2',
        userId: 'user-2',
        tenantId: 'tenant-2',
        ledgerId: 'ledger-2',
        name: '기타 차량',
        manufacturer: 'Kia',
        fuelType: 'GASOLINE',
        initialOdometerKm: 12_000,
        estimatedFuelEfficiencyKmPerLiter: 9.4,
        defaultFundingAccountId: null,
        defaultFuelCategoryId: null,
        defaultMaintenanceCategoryId: null,
        operatingExpensePlanOptIn: false,
        createdAt: new Date('2026-03-02T08:00:00.000Z'),
        fuelLogs: []
      }
    ],
    vehicleMaintenanceLogs: [
      {
        id: 'maintenance-1',
        vehicleId: 'vehicle-1',
        performedOn: new Date('2026-03-18T00:00:00.000Z'),
        odometerKm: 58_620,
        category: 'REPAIR',
        vendor: '현대 블루핸즈',
        description: '브레이크 패드 교체',
        amountWon: 185_000,
        memo: '전륜 패드 기준',
        createdAt: new Date('2026-03-18T10:00:00.000Z'),
        updatedAt: new Date('2026-03-18T10:00:00.000Z')
      }
    ]
  };
}
