import { BadRequestException } from '@nestjs/common';
import type {
  CreateVehicleRequest,
  CreateVehicleFuelLogRequest,
  CreateVehicleMaintenanceLogRequest,
  UpdateVehicleFuelLogRequest,
  UpdateVehicleMaintenanceLogRequest,
  UpdateVehicleRequest
} from '@personal-erp/contracts';
import { requireNonNegativeMoneyWon } from '../../common/money/money-won';

export function normalizeVehicleInput(
  input: CreateVehicleRequest | UpdateVehicleRequest
) {
  return {
    name: normalizeRequiredText(input.name, '차량 이름을 입력해 주세요.'),
    manufacturer: normalizeOptionalText(input.manufacturer),
    fuelType: input.fuelType,
    initialOdometerKm: input.initialOdometerKm,
    monthlyExpenseWon: input.monthlyExpenseWon,
    estimatedFuelEfficiencyKmPerLiter: normalizeOptionalPositiveNumber(
      input.estimatedFuelEfficiencyKmPerLiter
    )
  };
}

function normalizeRequiredText(value: string, message: string) {
  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new BadRequestException(message);
  }

  return normalizedValue;
}

function normalizeOptionalText(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length === 0 ? null : normalizedValue;
}

function normalizeOptionalPositiveNumber(value?: number | null) {
  if (value === undefined || value === null) {
    return null;
  }

  if (!Number.isFinite(value) || value <= 0) {
    throw new BadRequestException('예상 연비는 0보다 커야 합니다.');
  }

  return value;
}

export function normalizeFuelLogInput(
  input: CreateVehicleFuelLogRequest | UpdateVehicleFuelLogRequest,
  vehicle: {
    initialOdometerKm: number;
  }
) {
  const filledOn = normalizeRequiredDateOnlyString(
    input.filledOn,
    '주유일을 입력해 주세요.'
  );

  if (input.odometerKm < vehicle.initialOdometerKm) {
    throw new BadRequestException(
      '주유 주행거리는 차량 초기 주행거리보다 작을 수 없습니다.'
    );
  }

  if (!Number.isFinite(input.liters) || input.liters <= 0) {
    throw new BadRequestException('주유량은 0보다 커야 합니다.');
  }

  return {
    filledOn,
    odometerKm: input.odometerKm,
    liters: input.liters,
    amountWon: requireNonNegativeMoneyWon(
      input.amountWon,
      '주유 금액은 0 이상인 안전한 정수여야 합니다.'
    ),
    unitPriceWon: requireNonNegativeMoneyWon(
      input.unitPriceWon,
      '리터당 단가는 0 이상인 안전한 정수여야 합니다.'
    ),
    isFullTank: input.isFullTank
  };
}

export function normalizeMaintenanceLogInput(
  input:
    | CreateVehicleMaintenanceLogRequest
    | UpdateVehicleMaintenanceLogRequest,
  vehicle: {
    initialOdometerKm: number;
  }
) {
  const performedOn = normalizeRequiredDateOnlyString(
    input.performedOn,
    '정비일을 입력해 주세요.'
  );
  const description = normalizeRequiredText(
    input.description,
    '정비 내용을 입력해 주세요.'
  );
  const vendor = normalizeOptionalText(input.vendor);
  const memo = normalizeOptionalText(input.memo);

  if (input.odometerKm < vehicle.initialOdometerKm) {
    throw new BadRequestException(
      '정비 주행거리는 차량 초기 주행거리보다 작을 수 없습니다.'
    );
  }

  return {
    performedOn,
    odometerKm: input.odometerKm,
    category: input.category,
    vendor,
    description,
    amountWon: requireNonNegativeMoneyWon(
      input.amountWon,
      '정비 금액은 0 이상인 안전한 정수여야 합니다.'
    ),
    memo
  };
}

function normalizeRequiredDateOnlyString(value: string, message: string) {
  const normalizedValue = value.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    throw new BadRequestException(message);
  }

  const parsed = new Date(`${normalizedValue}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(message);
  }

  return normalizedValue;
}
