'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Grid, MenuItem, Stack, TextField } from '@mui/material';
import type {
  CreateVehicleMaintenanceLogRequest,
  UpdateVehicleMaintenanceLogRequest,
  VehicleFuelLogItem,
  VehicleItem,
  VehicleMaintenanceLogItem,
  VehicleOperatingSummaryView
} from '@personal-erp/contracts/assets';
import { vehicleMaintenanceCategoryValues } from '@personal-erp/contracts/assets';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { webRuntime } from '@/shared/config/env';
import { createNonNegativeMoneyWonSchema } from '@/shared/lib/money';
import { appLayout } from '@/shared/ui/layout-metrics';
import {
  buildVehicleMaintenanceLogFallbackItem,
  createVehicleMaintenanceLog,
  mergeVehicleMaintenanceLogItem,
  updateVehicleMaintenanceLog,
  vehicleFuelLogsQueryKey,
  vehicleMaintenanceLogsQueryKey,
  vehicleOperatingSummaryQueryKey,
  vehiclesQueryKey
} from './vehicles.api';
import { buildVehicleOperatingSummaryView } from './vehicles.summary';

const maintenanceCategoryLabelMap: Record<string, string> = {
  INSPECTION: '점검',
  REPAIR: '수리',
  CONSUMABLE: '소모품',
  TIRE: '타이어',
  ACCIDENT: '사고',
  OTHER: '기타'
};

const vehicleMaintenanceFormSchema = z.object({
  vehicleId: z.string().trim().min(1, '차량을 선택해 주세요.'),
  performedOn: z.string().trim().min(1, '정비일을 입력해 주세요.'),
  odometerKm: z.coerce
    .number()
    .int()
    .min(0, '정비 시점 주행거리는 0 이상이어야 합니다.'),
  category: z.enum(vehicleMaintenanceCategoryValues),
  vendor: z.string().trim(),
  description: z.string().trim().min(2, '정비 내용은 2자 이상이어야 합니다.'),
  amountWon: createNonNegativeMoneyWonSchema(
    '정비 비용은 0 이상이어야 합니다.'
  ),
  memo: z.string().trim()
});

type VehicleMaintenanceFormInput = z.infer<typeof vehicleMaintenanceFormSchema>;
type VehicleMaintenanceFormMode = 'create' | 'edit';

type SubmitFeedback = {
  severity: 'success' | 'error';
  message: string;
} | null;

type SaveVehicleMaintenanceMutationInput = {
  mode: VehicleMaintenanceFormMode;
  maintenanceLogId?: string;
  payload: UpdateVehicleMaintenanceLogRequest;
  fallback: VehicleMaintenanceLogItem;
  vehicleId: string;
};

type VehicleMaintenanceFormProps = {
  vehicles: VehicleItem[];
  mode?: VehicleMaintenanceFormMode;
  initialMaintenanceLog?: VehicleMaintenanceLogItem | null;
  initialVehicleId?: string | null;
  onCompleted?: (
    maintenanceLog: VehicleMaintenanceLogItem,
    mode: VehicleMaintenanceFormMode
  ) => void;
};

export function VehicleMaintenanceForm({
  vehicles,
  mode = 'create',
  initialMaintenanceLog = null,
  initialVehicleId = null,
  onCompleted
}: VehicleMaintenanceFormProps) {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = React.useState<SubmitFeedback>(null);
  const form = useForm<VehicleMaintenanceFormInput>({
    resolver: zodResolver(vehicleMaintenanceFormSchema),
    defaultValues: buildDefaultValues(vehicles, initialVehicleId)
  });

  const mutation = useMutation({
    mutationFn: ({
      mode: nextMode,
      maintenanceLogId,
      payload,
      fallback,
      vehicleId
    }: SaveVehicleMaintenanceMutationInput) => {
      if (nextMode === 'edit' && maintenanceLogId) {
        return updateVehicleMaintenanceLog(
          vehicleId,
          maintenanceLogId,
          payload,
          fallback
        );
      }

      return createVehicleMaintenanceLog(vehicleId, payload, fallback);
    },
    onSuccess: async (saved) => {
      queryClient.setQueryData<VehicleMaintenanceLogItem[]>(
        vehicleMaintenanceLogsQueryKey,
        (current) => mergeVehicleMaintenanceLogItem(current, saved)
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

    if (mode === 'edit' && initialMaintenanceLog) {
      form.reset(mapMaintenanceLogToFormInput(initialMaintenanceLog));
      return;
    }

    form.reset(buildDefaultValues(vehicles, initialVehicleId));
  }, [form, initialMaintenanceLog, initialVehicleId, mode, vehicles]);

  const isBusy = mutation.isPending || form.formState.isSubmitting;
  const selectedVehicleId = form.watch('vehicleId');
  const submitLabel = mode === 'edit' ? '정비 수정' : '정비 저장';

  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        setFeedback(null);

        const selectedVehicle =
          vehicles.find((vehicle) => vehicle.id === values.vehicleId) ?? null;

        if (!selectedVehicle) {
          setFeedback({
            severity: 'error',
            message: '정비 기록을 연결할 차량을 먼저 선택해 주세요.'
          });
          return;
        }

        const payload: CreateVehicleMaintenanceLogRequest = {
          performedOn: values.performedOn,
          odometerKm: values.odometerKm,
          category: values.category,
          vendor: values.vendor.trim() || null,
          description: values.description.trim(),
          amountWon: values.amountWon,
          memo: values.memo.trim() || null
        };

        try {
          const saved = await mutation.mutateAsync({
            mode,
            maintenanceLogId: initialMaintenanceLog?.id,
            payload,
            vehicleId: values.vehicleId,
            fallback: buildVehicleMaintenanceLogFallbackItem(payload, {
              id: initialMaintenanceLog?.id,
              vehicleId: values.vehicleId,
              vehicleName: selectedVehicle.name
            })
          });

          if (onCompleted) {
            onCompleted(saved, mode);
            return;
          }

          if (mode === 'create') {
            form.reset(buildDefaultValues(vehicles, values.vehicleId));
          }

          setFeedback({
            severity: 'success',
            message:
              mode === 'edit'
                ? '정비 기록을 수정했고 목록을 새로고침했습니다.'
                : '정비 기록을 저장했고 목록을 새로고침했습니다.'
          });
        } catch (error) {
          setFeedback({
            severity: 'error',
            message:
              error instanceof Error
                ? error.message
                : mode === 'edit'
                  ? '정비 기록을 수정하지 못했습니다.'
                  : '정비 기록을 저장하지 못했습니다.'
          });
        }
      })}
    >
      <Stack spacing={appLayout.cardGap}>
        {feedback ? (
          <Alert severity={feedback.severity} variant="outlined">
            {feedback.message}
          </Alert>
        ) : null}
        <Alert severity="info" variant="outlined">
          정비 이력은 차량 운영 판단을 위한 보조 데이터이며, 실제 회계 확정은
          차량 관련 수집 거래와 전표 흐름에서 이어집니다.
        </Alert>

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
                  disabled={mode === 'edit'}
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
              label="정비일"
              type="date"
              InputLabelProps={{ shrink: true }}
              error={Boolean(form.formState.errors.performedOn)}
              helperText={form.formState.errors.performedOn?.message}
              {...form.register('performedOn')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="정비 시점 주행거리 (km)"
              type="number"
              error={Boolean(form.formState.errors.odometerKm)}
              helperText={form.formState.errors.odometerKm?.message}
              {...form.register('odometerKm')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Controller
              control={form.control}
              name="category"
              render={({ field }) => (
                <TextField
                  select
                  label="정비 구분"
                  error={Boolean(form.formState.errors.category)}
                  helperText={form.formState.errors.category?.message}
                  name={field.name}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                  inputRef={field.ref}
                >
                  {vehicleMaintenanceCategoryValues.map((category) => (
                    <MenuItem key={category} value={category}>
                      {maintenanceCategoryLabelMap[category]}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="정비 비용 (원)"
              type="number"
              error={Boolean(form.formState.errors.amountWon)}
              helperText={form.formState.errors.amountWon?.message}
              {...form.register('amountWon')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="정비처"
              helperText="선택 사항"
              error={Boolean(form.formState.errors.vendor)}
              {...form.register('vendor')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="정비 내용"
              helperText={form.formState.errors.description?.message}
              error={Boolean(form.formState.errors.description)}
              {...form.register('description')}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              label="메모"
              multiline
              minRows={3}
              helperText={
                form.formState.errors.memo?.message ??
                (selectedVehicleId
                  ? '선택 사항'
                  : '차량을 먼저 선택하면 정비 메모를 함께 기록할 수 있습니다.')
              }
              error={Boolean(form.formState.errors.memo)}
              {...form.register('memo')}
            />
          </Grid>
        </Grid>

        <Button
          type="submit"
          variant="contained"
          disabled={isBusy || vehicles.length === 0}
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
): VehicleMaintenanceFormInput {
  return {
    vehicleId: initialVehicleId ?? vehicles[0]?.id ?? '',
    performedOn: new Date().toISOString().slice(0, 10),
    odometerKm: 0,
    category: 'INSPECTION',
    vendor: '',
    description: '',
    amountWon: 0,
    memo: ''
  };
}

function mapMaintenanceLogToFormInput(
  maintenanceLog: VehicleMaintenanceLogItem
): VehicleMaintenanceFormInput {
  return {
    vehicleId: maintenanceLog.vehicleId,
    performedOn: maintenanceLog.performedOn,
    odometerKm: maintenanceLog.odometerKm,
    category: maintenanceLog.category,
    vendor: maintenanceLog.vendor ?? '',
    description: maintenanceLog.description,
    amountWon: maintenanceLog.amountWon,
    memo: maintenanceLog.memo ?? ''
  };
}
