'use client';

import * as React from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Checkbox,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  TextField
} from '@mui/material';
import type {
  CreateVehicleFuelLogRequest,
  UpdateVehicleFuelLogRequest,
  VehicleFuelLogItem,
  VehicleItem,
  VehicleMaintenanceLogItem,
  VehicleOperatingSummaryView
} from '@personal-erp/contracts';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  categoriesManagementQueryKey,
  categoriesQueryKey,
  fundingAccountsManagementQueryKey,
  fundingAccountsQueryKey,
  getCategories,
  getFundingAccounts
} from '@/features/reference-data/reference-data.api';
import { canEditCollectedTransaction } from '@/features/transactions/transaction-workflow';
import { webRuntime } from '@/shared/config/env';
import { createNonNegativeMoneyWonSchema } from '@/shared/lib/money';
import { useAppNotification } from '@/shared/providers/notification-provider';
import { FeedbackAlert } from '@/shared/ui/feedback-alert';
import { resolveStatusLabel } from '@/shared/ui/status-chip';
import { appLayout } from '@/shared/ui/layout-metrics';
import {
  buildVehicleFuelLogFallbackItem,
  createVehicleFuelLog,
  mergeVehicleFuelLogItem,
  updateVehicleFuelLog,
  vehicleFuelLogsQueryKey,
  vehicleMaintenanceLogsQueryKey,
  vehicleOperatingSummaryQueryKey,
  vehiclesQueryKey
} from './vehicles.api';
import {
  calculateFuelPricingAdjustment,
  recordFuelPricingFieldEdit,
  type FuelPricingField
} from './vehicle-fuel-pricing';
import { buildVehicleOperatingSummaryView } from './vehicles.summary';

const vehicleFuelLogFormSchema = z.object({
  vehicleId: z.string().trim().min(1, '차량을 선택해 주세요.'),
  filledOn: z.string().trim().min(1, '주유일을 입력해 주세요.'),
  odometerKm: z.coerce
    .number()
    .int()
    .min(0, '주유 시점 주행거리는 0 이상이어야 합니다.'),
  liters: z.coerce.number().positive('주유량은 0보다 커야 합니다.'),
  amountWon: createNonNegativeMoneyWonSchema(
    '주유 금액은 0 이상이어야 합니다.'
  ),
  unitPriceWon: createNonNegativeMoneyWonSchema(
    '리터당 단가는 0 이상이어야 합니다.'
  ),
  isFullTank: z.boolean(),
  accountingEnabled: z.boolean(),
  fundingAccountId: z.string().trim(),
  categoryId: z.string().trim()
});

type VehicleFuelLogFormInput = z.infer<typeof vehicleFuelLogFormSchema>;
type VehicleFuelLogFormMode = 'create' | 'edit';

type SubmitFeedback = {
  severity: 'success' | 'error';
  message: string;
} | null;

type SaveVehicleFuelLogMutationInput = {
  mode: VehicleFuelLogFormMode;
  fuelLogId?: string;
  payload: UpdateVehicleFuelLogRequest;
  fallback: VehicleFuelLogItem;
  vehicleId: string;
};

type VehicleFuelLogFormProps = {
  vehicles: VehicleItem[];
  mode?: VehicleFuelLogFormMode;
  initialFuelLog?: VehicleFuelLogItem | null;
  initialVehicleId?: string | null;
  onCompleted?: (
    fuelLog: VehicleFuelLogItem,
    mode: VehicleFuelLogFormMode
  ) => void;
};

export function VehicleFuelLogForm({
  vehicles,
  mode = 'create',
  initialFuelLog = null,
  initialVehicleId = null,
  onCompleted
}: VehicleFuelLogFormProps) {
  const queryClient = useQueryClient();
  const { notifySuccess } = useAppNotification();
  const [feedback, setFeedback] = React.useState<SubmitFeedback>(null);
  const fuelPricingEditOrderRef = React.useRef<FuelPricingField[]>([]);
  const form = useForm<VehicleFuelLogFormInput>({
    resolver: zodResolver(vehicleFuelLogFormSchema),
    defaultValues: buildDefaultValues(vehicles, initialVehicleId)
  });
  const accountingEnabled = form.watch('accountingEnabled');
  const selectedVehicleId = form.watch('vehicleId');
  const selectedFundingAccountId = form.watch('fundingAccountId');
  const selectedCategoryId = form.watch('categoryId');
  const [watchedLiters, watchedAmountWon, watchedUnitPriceWon] = form.watch([
    'liters',
    'amountWon',
    'unitPriceWon'
  ]);
  const linkedCollectedTransaction = initialFuelLog?.linkedCollectedTransaction;
  const isAccountingLocked =
    mode === 'edit' && linkedCollectedTransaction
      ? !canEditCollectedTransaction({
          postingStatus: linkedCollectedTransaction.postingStatus,
          postedJournalEntryId: linkedCollectedTransaction.postedJournalEntryId
        })
      : false;
  const includeInactiveFundingAccounts =
    mode === 'edit' &&
    Boolean(initialFuelLog?.linkedCollectedTransaction?.fundingAccountId);
  const includeInactiveCategories =
    mode === 'edit' &&
    Boolean(initialFuelLog?.linkedCollectedTransaction?.categoryId);
  const fundingAccountsQuery = useQuery({
    queryKey: includeInactiveFundingAccounts
      ? fundingAccountsManagementQueryKey
      : fundingAccountsQueryKey,
    queryFn: () =>
      getFundingAccounts({ includeInactive: includeInactiveFundingAccounts }),
    enabled: accountingEnabled
  });
  const categoriesQuery = useQuery({
    queryKey: includeInactiveCategories
      ? categoriesManagementQueryKey
      : categoriesQueryKey,
    queryFn: () =>
      getCategories({ includeInactive: includeInactiveCategories }),
    enabled: accountingEnabled
  });
  const fundingAccounts = fundingAccountsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const availableFundingAccounts = React.useMemo(
    () =>
      fundingAccounts.filter(
        (fundingAccount) =>
          fundingAccount.status === 'ACTIVE' ||
          fundingAccount.id === selectedFundingAccountId
      ),
    [fundingAccounts, selectedFundingAccountId]
  );
  const expenseCategories = React.useMemo(
    () =>
      categories.filter(
        (category) =>
          category.kind === 'EXPENSE' &&
          (category.isActive || category.id === selectedCategoryId)
      ),
    [categories, selectedCategoryId]
  );
  const referenceError =
    accountingEnabled && !isAccountingLocked
      ? (fundingAccountsQuery.error ?? categoriesQuery.error ?? null)
      : null;

  const mutation = useMutation({
    mutationFn: ({
      mode: nextMode,
      fuelLogId,
      payload,
      fallback,
      vehicleId
    }: SaveVehicleFuelLogMutationInput) => {
      if (nextMode === 'edit' && fuelLogId) {
        return updateVehicleFuelLog(vehicleId, fuelLogId, payload, fallback);
      }

      return createVehicleFuelLog(vehicleId, payload, fallback);
    },
    onSuccess: async (saved) => {
      queryClient.setQueryData<VehicleFuelLogItem[]>(
        vehicleFuelLogsQueryKey,
        (current) => mergeVehicleFuelLogItem(current, saved)
      );
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

      if (!webRuntime.demoFallbackEnabled) {
        await queryClient.invalidateQueries({
          queryKey: vehicleFuelLogsQueryKey
        });
        await queryClient.invalidateQueries({
          queryKey: vehicleOperatingSummaryQueryKey
        });
      }
    }
  });

  React.useEffect(() => {
    fuelPricingEditOrderRef.current = [];
    setFeedback(null);

    if (mode === 'edit' && initialFuelLog) {
      form.reset(mapFuelLogToFormInput(initialFuelLog));
      return;
    }

    form.reset(buildDefaultValues(vehicles, initialVehicleId));
  }, [form, initialFuelLog, initialVehicleId, mode, vehicles]);

  React.useEffect(() => {
    const adjustment = calculateFuelPricingAdjustment({
      values: {
        liters: watchedLiters,
        amountWon: watchedAmountWon,
        unitPriceWon: watchedUnitPriceWon
      },
      editOrder: fuelPricingEditOrderRef.current
    });

    if (!adjustment) {
      return;
    }

    form.setValue(adjustment.field, adjustment.value, {
      shouldDirty: true,
      shouldValidate: true
    });
  }, [form, watchedAmountWon, watchedLiters, watchedUnitPriceWon]);

  React.useEffect(() => {
    if (!accountingEnabled) {
      return;
    }

    const firstFundingAccount = availableFundingAccounts[0];
    if (!form.getValues('fundingAccountId') && firstFundingAccount) {
      form.setValue('fundingAccountId', firstFundingAccount.id, {
        shouldValidate: true
      });
    }
  }, [accountingEnabled, availableFundingAccounts, form]);

  React.useEffect(() => {
    if (mode !== 'create') {
      return;
    }

    const selectedVehicle =
      vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null;
    const defaultFundingAccountId =
      selectedVehicle?.defaultFundingAccountId ?? '';

    form.setValue('accountingEnabled', Boolean(defaultFundingAccountId));
    form.setValue('fundingAccountId', defaultFundingAccountId);
    form.setValue('categoryId', selectedVehicle?.defaultFuelCategoryId ?? '');
  }, [form, mode, selectedVehicleId, vehicles]);

  React.useEffect(() => {
    if (!accountingEnabled) {
      return;
    }

    const currentCategoryId = form.getValues('categoryId');
    if (
      currentCategoryId &&
      !expenseCategories.some((category) => category.id === currentCategoryId)
    ) {
      form.setValue('categoryId', '');
    }
  }, [accountingEnabled, expenseCategories, form]);

  const isBusy =
    mutation.isPending ||
    form.formState.isSubmitting ||
    (accountingEnabled &&
      (fundingAccountsQuery.isLoading || categoriesQuery.isLoading));
  const submitLabel = mode === 'edit' ? '연료 기록 수정' : '연료 기록 저장';

  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        setFeedback(null);

        if (isAccountingLocked) {
          setFeedback({
            severity: 'error',
            message:
              '이미 확정된 회계 연동이 있어 연료 기록을 수정할 수 없습니다. 연결 전표 상세에서 반전 또는 정정으로 조정해 주세요.'
          });
          return;
        }

        const selectedVehicle =
          vehicles.find((vehicle) => vehicle.id === values.vehicleId) ?? null;

        if (!selectedVehicle) {
          setFeedback({
            severity: 'error',
            message: '연료 기록을 연결할 차량을 먼저 선택해 주세요.'
          });
          return;
        }

        if (values.accountingEnabled) {
          const selectedFundingAccount = availableFundingAccounts.find(
            (fundingAccount) => fundingAccount.id === values.fundingAccountId
          );

          if (!selectedFundingAccount) {
            setFeedback({
              severity: 'error',
              message: '회계 연동 자금수단을 선택해 주세요.'
            });
            return;
          }

          if (values.amountWon <= 0) {
            setFeedback({
              severity: 'error',
              message: '회계 연동을 켠 연료 기록은 금액이 0보다 커야 합니다.'
            });
            return;
          }
        }

        const payload: CreateVehicleFuelLogRequest = {
          filledOn: values.filledOn,
          odometerKm: values.odometerKm,
          liters: values.liters,
          amountWon: values.amountWon,
          unitPriceWon: values.unitPriceWon,
          isFullTank: values.isFullTank,
          accountingLink: values.accountingEnabled
            ? {
                fundingAccountId: values.fundingAccountId,
                categoryId: values.categoryId || null
              }
            : null
        };

        try {
          const saved = await mutation.mutateAsync({
            mode,
            fuelLogId: initialFuelLog?.id,
            payload,
            vehicleId: values.vehicleId,
            fallback: buildVehicleFuelLogFallbackItem(payload, {
              id: initialFuelLog?.id,
              vehicleId: values.vehicleId,
              vehicleName: selectedVehicle.name
            })
          });

          if (onCompleted) {
            onCompleted(saved, mode);
            return;
          }

          if (mode === 'create') {
            fuelPricingEditOrderRef.current = [];
            form.reset({
              ...buildDefaultValues(vehicles, values.vehicleId),
              accountingEnabled: values.accountingEnabled,
              fundingAccountId: values.fundingAccountId,
              categoryId: values.categoryId
            });
          }

          notifySuccess(
            mode === 'edit'
              ? '연료 기록을 수정했고 회계 연동 상태까지 함께 반영했습니다.'
              : '연료 기록을 저장했고 회계 연동 상태까지 함께 반영했습니다.'
          );
        } catch (error) {
          setFeedback({
            severity: 'error',
            message:
              error instanceof Error
                ? error.message
                : mode === 'edit'
                  ? '연료 기록을 수정하지 못했습니다.'
                  : '연료 기록을 저장하지 못했습니다.'
          });
        }
      })}
    >
      <Stack spacing={appLayout.cardGap}>
        <Alert severity="info" variant="outlined">
          연료 이력은 차량 운영 판단용 기록입니다. 회계 연동을 켜면 이 저장과
          함께 수집거래를 만들고, 이후 전표 확정까지 기존 회계 흐름으로
          이어집니다.
        </Alert>
        {linkedCollectedTransaction ? (
          <Alert
            severity={isAccountingLocked ? 'warning' : 'info'}
            variant="outlined"
          >
            연결된 수집거래 상태는{' '}
            {resolveStatusLabel(linkedCollectedTransaction.postingStatus)}
            입니다.
            {linkedCollectedTransaction.postedJournalEntryNumber
              ? ` 전표번호 ${linkedCollectedTransaction.postedJournalEntryNumber}와 연결되어 있습니다.`
              : ''}
            {isAccountingLocked
              ? ' 확정 이후에는 차량 기록을 과거 사실로 유지하고 회계 조정은 전표 반전 또는 정정으로 관리합니다.'
              : ' 아직 미확정 상태라면 이 화면에서 연동 정보까지 함께 갱신할 수 있습니다.'}
            {isAccountingLocked &&
            linkedCollectedTransaction.postedJournalEntryId ? (
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button
                  size="small"
                  component={Link}
                  href={
                    `/journal-entries/${linkedCollectedTransaction.postedJournalEntryId}` as Route
                  }
                  variant="outlined"
                >
                  전표 상세 / 반전 / 정정
                </Button>
              </Stack>
            ) : null}
          </Alert>
        ) : null}
        {referenceError ? (
          <Alert severity="error" variant="outlined">
            {referenceError instanceof Error
              ? referenceError.message
              : '회계 연동 기준 데이터를 불러오지 못했습니다.'}
          </Alert>
        ) : null}

        <Grid container spacing={appLayout.fieldGap}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Controller
              control={form.control}
              name="vehicleId"
              render={({ field }) => (
                <TextField
                  select
                  label="차량"
                  error={Boolean(form.formState.errors.vehicleId)}
                  helperText={form.formState.errors.vehicleId?.message}
                  name={field.name}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                  inputRef={field.ref}
                  disabled={mode === 'edit' || isAccountingLocked}
                >
                  {vehicles.map((vehicle) => (
                    <MenuItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="주유일"
              type="date"
              InputLabelProps={{ shrink: true }}
              error={Boolean(form.formState.errors.filledOn)}
              helperText={form.formState.errors.filledOn?.message}
              disabled={isAccountingLocked}
              {...form.register('filledOn')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="주유 시점 주행거리 (km)"
              type="number"
              error={Boolean(form.formState.errors.odometerKm)}
              helperText={form.formState.errors.odometerKm?.message}
              disabled={isAccountingLocked}
              {...form.register('odometerKm')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="주유량 (L)"
              type="number"
              inputProps={{ step: 'any' }}
              error={Boolean(form.formState.errors.liters)}
              helperText={form.formState.errors.liters?.message}
              disabled={isAccountingLocked}
              {...form.register('liters', {
                onChange: () => {
                  fuelPricingEditOrderRef.current = recordFuelPricingFieldEdit(
                    fuelPricingEditOrderRef.current,
                    'liters'
                  );
                }
              })}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="주유 금액 (원)"
              type="number"
              error={Boolean(form.formState.errors.amountWon)}
              helperText={form.formState.errors.amountWon?.message}
              disabled={isAccountingLocked}
              {...form.register('amountWon', {
                onChange: () => {
                  fuelPricingEditOrderRef.current = recordFuelPricingFieldEdit(
                    fuelPricingEditOrderRef.current,
                    'amountWon'
                  );
                }
              })}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="리터당 단가 (원)"
              type="number"
              error={Boolean(form.formState.errors.unitPriceWon)}
              helperText={form.formState.errors.unitPriceWon?.message}
              disabled={isAccountingLocked}
              {...form.register('unitPriceWon', {
                onChange: () => {
                  fuelPricingEditOrderRef.current = recordFuelPricingFieldEdit(
                    fuelPricingEditOrderRef.current,
                    'unitPriceWon'
                  );
                }
              })}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Controller
              control={form.control}
              name="isFullTank"
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={field.value}
                      disabled={isAccountingLocked}
                      onChange={(event) => {
                        field.onChange(event.target.checked);
                      }}
                    />
                  }
                  label="가득 주유 / 완충 기록"
                />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Controller
              control={form.control}
              name="accountingEnabled"
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={field.value}
                      disabled={isAccountingLocked}
                      onChange={(event) => {
                        field.onChange(event.target.checked);
                      }}
                    />
                  }
                  label="이 기록을 수집거래와 연결"
                />
              )}
            />
          </Grid>
          {accountingEnabled ? (
            <>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  control={form.control}
                  name="fundingAccountId"
                  render={({ field }) => (
                    <TextField
                      select
                      label="자금수단"
                      helperText="회계 연동을 켠 기록은 지출 자금수단을 같이 저장합니다."
                      name={field.name}
                      value={field.value}
                      onBlur={field.onBlur}
                      onChange={field.onChange}
                      inputRef={field.ref}
                      disabled={isAccountingLocked || isBusy}
                    >
                      {availableFundingAccounts.map((fundingAccount) => (
                        <MenuItem
                          key={fundingAccount.id}
                          value={fundingAccount.id}
                        >
                          {fundingAccount.name}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <TextField
                      select
                      label="지출 카테고리"
                      helperText="비워두면 검토됨 상태로 저장되고, 나중에 이 화면에서 보완할 수 있습니다."
                      name={field.name}
                      value={field.value}
                      onBlur={field.onBlur}
                      onChange={field.onChange}
                      inputRef={field.ref}
                      disabled={isAccountingLocked || isBusy}
                    >
                      <MenuItem value="">미지정</MenuItem>
                      {expenseCategories.map((category) => (
                        <MenuItem key={category.id} value={category.id}>
                          {category.name}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>
            </>
          ) : null}
        </Grid>

        <FeedbackAlert feedback={feedback} />
        <Button
          type="submit"
          variant="contained"
          disabled={
            isBusy ||
            vehicles.length === 0 ||
            isAccountingLocked ||
            Boolean(referenceError)
          }
          sx={{ alignSelf: 'flex-start' }}
        >
          {mutation.isPending ? '저장 중...' : submitLabel}
        </Button>
      </Stack>
    </form>
  );
}

function buildDefaultValues(
  vehicles: VehicleItem[],
  initialVehicleId?: string | null
): VehicleFuelLogFormInput {
  const selectedVehicle =
    vehicles.find((vehicle) => vehicle.id === initialVehicleId) ??
    vehicles[0] ??
    null;
  const defaultFundingAccountId =
    selectedVehicle?.defaultFundingAccountId ?? '';

  return {
    vehicleId: selectedVehicle?.id ?? '',
    filledOn: new Date().toISOString().slice(0, 10),
    odometerKm: 0,
    liters: 0,
    amountWon: 0,
    unitPriceWon: 0,
    isFullTank: true,
    accountingEnabled: Boolean(defaultFundingAccountId),
    fundingAccountId: defaultFundingAccountId,
    categoryId: selectedVehicle?.defaultFuelCategoryId ?? ''
  };
}

function mapFuelLogToFormInput(
  fuelLog: VehicleFuelLogItem
): VehicleFuelLogFormInput {
  return {
    vehicleId: fuelLog.vehicleId,
    filledOn: fuelLog.filledOn,
    odometerKm: fuelLog.odometerKm,
    liters: fuelLog.liters,
    amountWon: fuelLog.amountWon,
    unitPriceWon: fuelLog.unitPriceWon,
    isFullTank: fuelLog.isFullTank,
    accountingEnabled: Boolean(fuelLog.linkedCollectedTransaction),
    fundingAccountId:
      fuelLog.linkedCollectedTransaction?.fundingAccountId ?? '',
    categoryId: fuelLog.linkedCollectedTransaction?.categoryId ?? ''
  };
}
