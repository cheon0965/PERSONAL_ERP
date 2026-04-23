'use client';

import * as React from 'react';
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
  CreateVehicleRequest,
  UpdateVehicleRequest,
  VehicleFuelLogItem,
  VehicleMaintenanceLogItem,
  VehicleItem,
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
import { webRuntime } from '@/shared/config/env';
import { useAppNotification } from '@/shared/providers/notification-provider';
import { FeedbackAlert } from '@/shared/ui/feedback-alert';
import { appLayout } from '@/shared/ui/layout-metrics';
import {
  buildVehicleFallbackItem,
  createVehicle,
  mergeVehicleItem,
  updateVehicle,
  vehicleFuelLogsQueryKey,
  vehicleMaintenanceLogsQueryKey,
  vehicleOperatingSummaryQueryKey,
  vehiclesQueryKey
} from './vehicles.api';
import { buildVehicleOperatingSummaryView } from './vehicles.summary';

const vehicleFormSchema = z.object({
  name: z.string().trim().min(2, '차량 이름은 2자 이상이어야 합니다.'),
  manufacturer: z.string().trim(),
  fuelType: z.enum(['GASOLINE', 'DIESEL', 'LPG', 'HYBRID', 'ELECTRIC']),
  initialOdometerKm: z.coerce
    .number()
    .int()
    .min(0, '초기 주행거리는 0 이상이어야 합니다.'),
  estimatedFuelEfficiencyKmPerLiter: z
    .string()
    .trim()
    .refine(
      (value) =>
        value.length === 0 ||
        (Number.isFinite(Number(value)) && Number(value) > 0),
      '예상 연비는 0보다 커야 합니다.'
    ),
  defaultFundingAccountId: z.string().trim(),
  defaultFuelCategoryId: z.string().trim(),
  defaultMaintenanceCategoryId: z.string().trim(),
  operatingExpensePlanOptIn: z.boolean()
});

type VehicleFormInput = z.infer<typeof vehicleFormSchema>;
type VehicleFormMode = 'create' | 'edit';

type SubmitFeedback = {
  severity: 'success' | 'error';
  message: string;
} | null;

type SaveVehicleMutationInput = {
  mode: VehicleFormMode;
  vehicleId?: string;
  payload: UpdateVehicleRequest;
  fallback: VehicleItem;
};

type VehicleFormProps = {
  mode?: VehicleFormMode;
  initialVehicle?: VehicleItem | null;
  onCompleted?: (vehicle: VehicleItem, mode: VehicleFormMode) => void;
};

export function VehicleForm({
  mode = 'create',
  initialVehicle = null,
  onCompleted
}: VehicleFormProps) {
  const queryClient = useQueryClient();
  const { notifySuccess } = useAppNotification();
  const [feedback, setFeedback] = React.useState<SubmitFeedback>(null);
  const form = useForm<VehicleFormInput>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: buildDefaultValues()
  });
  const selectedDefaultFundingAccountId = form.watch('defaultFundingAccountId');
  const selectedDefaultFuelCategoryId = form.watch('defaultFuelCategoryId');
  const selectedDefaultMaintenanceCategoryId = form.watch(
    'defaultMaintenanceCategoryId'
  );
  const includeInactiveReferences = mode === 'edit';
  const fundingAccountsQuery = useQuery({
    queryKey: includeInactiveReferences
      ? fundingAccountsManagementQueryKey
      : fundingAccountsQueryKey,
    queryFn: () =>
      getFundingAccounts({ includeInactive: includeInactiveReferences })
  });
  const categoriesQuery = useQuery({
    queryKey: includeInactiveReferences
      ? categoriesManagementQueryKey
      : categoriesQueryKey,
    queryFn: () => getCategories({ includeInactive: includeInactiveReferences })
  });
  const fundingAccounts = fundingAccountsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const availableFundingAccounts = React.useMemo(
    () =>
      fundingAccounts.filter(
        (fundingAccount) =>
          fundingAccount.status === 'ACTIVE' ||
          fundingAccount.id === selectedDefaultFundingAccountId
      ),
    [fundingAccounts, selectedDefaultFundingAccountId]
  );
  const expenseCategories = React.useMemo(
    () =>
      categories.filter(
        (category) =>
          category.kind === 'EXPENSE' &&
          (category.isActive ||
            category.id === selectedDefaultFuelCategoryId ||
            category.id === selectedDefaultMaintenanceCategoryId)
      ),
    [
      categories,
      selectedDefaultFuelCategoryId,
      selectedDefaultMaintenanceCategoryId
    ]
  );
  const referenceError = fundingAccountsQuery.error ?? categoriesQuery.error;

  const mutation = useMutation({
    mutationFn: ({
      mode: nextMode,
      vehicleId,
      payload,
      fallback
    }: SaveVehicleMutationInput) => {
      if (nextMode === 'edit' && vehicleId) {
        return updateVehicle(vehicleId, payload, fallback);
      }

      return createVehicle(payload, fallback);
    },
    onSuccess: async (saved) => {
      queryClient.setQueryData<VehicleItem[]>(vehiclesQueryKey, (current) =>
        mergeVehicleItem(current, saved)
      );
      queryClient.setQueryData<VehicleFuelLogItem[]>(
        vehicleFuelLogsQueryKey,
        (current) =>
          current?.map((fuelLog) =>
            fuelLog.vehicleId === saved.id
              ? {
                  ...fuelLog,
                  vehicleName: saved.name
                }
              : fuelLog
          ) ?? current
      );
      queryClient.setQueryData<VehicleMaintenanceLogItem[]>(
        vehicleMaintenanceLogsQueryKey,
        (current) =>
          current?.map((maintenanceLog) =>
            maintenanceLog.vehicleId === saved.id
              ? {
                  ...maintenanceLog,
                  vehicleName: saved.name
                }
              : maintenanceLog
          ) ?? current
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
          queryKey: vehiclesQueryKey
        });
        await queryClient.invalidateQueries({
          queryKey: vehicleFuelLogsQueryKey
        });
        await queryClient.invalidateQueries({
          queryKey: vehicleMaintenanceLogsQueryKey
        });
        await queryClient.invalidateQueries({
          queryKey: vehicleOperatingSummaryQueryKey
        });
      }
    }
  });

  React.useEffect(() => {
    setFeedback(null);

    if (mode === 'edit' && initialVehicle) {
      form.reset(mapVehicleToFormInput(initialVehicle));
      return;
    }

    form.reset(buildDefaultValues());
  }, [form, initialVehicle, mode]);

  const isBusy =
    mutation.isPending ||
    form.formState.isSubmitting ||
    fundingAccountsQuery.isLoading ||
    categoriesQuery.isLoading;
  const submitLabel = mode === 'edit' ? '차량 수정' : '차량 저장';

  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        setFeedback(null);

        const payload: CreateVehicleRequest = {
          name: values.name.trim(),
          manufacturer: values.manufacturer.trim() || null,
          fuelType: values.fuelType,
          initialOdometerKm: values.initialOdometerKm,
          estimatedFuelEfficiencyKmPerLiter:
            values.estimatedFuelEfficiencyKmPerLiter.length > 0
              ? Number(values.estimatedFuelEfficiencyKmPerLiter)
              : null,
          defaultFundingAccountId: values.defaultFundingAccountId || null,
          defaultFuelCategoryId: values.defaultFuelCategoryId || null,
          defaultMaintenanceCategoryId:
            values.defaultMaintenanceCategoryId || null,
          operatingExpensePlanOptIn: values.operatingExpensePlanOptIn
        };

        try {
          const saved = await mutation.mutateAsync({
            mode,
            vehicleId: initialVehicle?.id,
            payload,
            fallback: buildVehicleFallbackItem(payload, {
              id: initialVehicle?.id
            })
          });

          if (onCompleted) {
            onCompleted(saved, mode);
            return;
          }

          if (mode === 'create') {
            form.reset({
              ...buildDefaultValues(),
              fuelType: values.fuelType
            });
          }

          notifySuccess(
            mode === 'edit'
              ? '차량 정보를 수정했고 목록을 새로고침했습니다.'
              : '차량 정보를 저장했고 목록을 새로고침했습니다.'
          );
        } catch (error) {
          setFeedback({
            severity: 'error',
            message:
              error instanceof Error
                ? error.message
                : mode === 'edit'
                  ? '차량 정보를 수정하지 못했습니다.'
                  : '차량 정보를 저장하지 못했습니다.'
          });
        }
      })}
    >
      <Stack spacing={appLayout.cardGap}>
        <Alert severity="info" variant="outlined">
          차량 정보는 운영 보조 데이터이며, 실제 회계 확정은 차량비 관련 수집
          거래와 전표 흐름에서 이어집니다.
        </Alert>
        {referenceError ? (
          <Alert severity="error" variant="outlined">
            {referenceError instanceof Error
              ? referenceError.message
              : '차량 기본 회계 기준 데이터를 불러오지 못했습니다.'}
          </Alert>
        ) : null}

        <Grid container spacing={appLayout.fieldGap}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="차량명"
              error={Boolean(form.formState.errors.name)}
              helperText={form.formState.errors.name?.message}
              {...form.register('name')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="제조사"
              helperText="선택 사항"
              error={Boolean(form.formState.errors.manufacturer)}
              {...form.register('manufacturer')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Controller
              control={form.control}
              name="fuelType"
              render={({ field }) => (
                <TextField
                  select
                  label="연료 종류"
                  error={Boolean(form.formState.errors.fuelType)}
                  helperText={form.formState.errors.fuelType?.message}
                  name={field.name}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                  inputRef={field.ref}
                >
                  <MenuItem value="GASOLINE">가솔린</MenuItem>
                  <MenuItem value="DIESEL">디젤</MenuItem>
                  <MenuItem value="LPG">LPG</MenuItem>
                  <MenuItem value="HYBRID">하이브리드</MenuItem>
                  <MenuItem value="ELECTRIC">전기</MenuItem>
                </TextField>
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="초기 주행거리 (km)"
              type="number"
              error={Boolean(form.formState.errors.initialOdometerKm)}
              helperText={form.formState.errors.initialOdometerKm?.message}
              {...form.register('initialOdometerKm')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="예상 연비 (km/L)"
              type="number"
              inputProps={{
                step: 'any'
              }}
              helperText={
                form.formState.errors.estimatedFuelEfficiencyKmPerLiter
                  ?.message ?? '선택 사항'
              }
              error={Boolean(
                form.formState.errors.estimatedFuelEfficiencyKmPerLiter
              )}
              {...form.register('estimatedFuelEfficiencyKmPerLiter')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Controller
              control={form.control}
              name="defaultFundingAccountId"
              render={({ field }) => (
                <TextField
                  select
                  label="기본 자금수단"
                  helperText="선택 사항"
                  name={field.name}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                  inputRef={field.ref}
                  disabled={isBusy}
                >
                  <MenuItem value="">미지정</MenuItem>
                  {availableFundingAccounts.map((fundingAccount) => (
                    <MenuItem key={fundingAccount.id} value={fundingAccount.id}>
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
              name="defaultFuelCategoryId"
              render={({ field }) => (
                <TextField
                  select
                  label="연료 기본 카테고리"
                  helperText="선택 사항"
                  name={field.name}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                  inputRef={field.ref}
                  disabled={isBusy}
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
          <Grid size={{ xs: 12, md: 6 }}>
            <Controller
              control={form.control}
              name="defaultMaintenanceCategoryId"
              render={({ field }) => (
                <TextField
                  select
                  label="정비 기본 카테고리"
                  helperText="선택 사항"
                  name={field.name}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                  inputRef={field.ref}
                  disabled={isBusy}
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
          <Grid size={{ xs: 12 }}>
            <Controller
              control={form.control}
              name="operatingExpensePlanOptIn"
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={field.value}
                      onChange={(event) => {
                        field.onChange(event.target.checked);
                      }}
                    />
                  }
                  label="차량 운영비 계획 자동 생성 대상"
                />
              )}
            />
          </Grid>
        </Grid>

        <FeedbackAlert feedback={feedback} />
        <Button
          type="submit"
          variant="contained"
          disabled={isBusy || Boolean(referenceError)}
          sx={{ alignSelf: 'flex-start' }}
        >
          {mutation.isPending ? '저장 중...' : submitLabel}
        </Button>
      </Stack>
    </form>
  );
}

function buildDefaultValues(): VehicleFormInput {
  return {
    name: '',
    manufacturer: '',
    fuelType: 'DIESEL',
    initialOdometerKm: 0,
    estimatedFuelEfficiencyKmPerLiter: '',
    defaultFundingAccountId: '',
    defaultFuelCategoryId: '',
    defaultMaintenanceCategoryId: '',
    operatingExpensePlanOptIn: false
  };
}

function mapVehicleToFormInput(vehicle: VehicleItem): VehicleFormInput {
  return {
    name: vehicle.name,
    manufacturer: vehicle.manufacturer ?? '',
    fuelType: vehicle.fuelType,
    initialOdometerKm: vehicle.initialOdometerKm,
    estimatedFuelEfficiencyKmPerLiter:
      vehicle.estimatedFuelEfficiencyKmPerLiter?.toString() ?? '',
    defaultFundingAccountId: vehicle.defaultFundingAccountId ?? '',
    defaultFuelCategoryId: vehicle.defaultFuelCategoryId ?? '',
    defaultMaintenanceCategoryId: vehicle.defaultMaintenanceCategoryId ?? '',
    operatingExpensePlanOptIn: vehicle.operatingExpensePlanOptIn
  };
}
