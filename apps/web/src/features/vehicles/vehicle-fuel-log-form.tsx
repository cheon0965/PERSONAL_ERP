'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
  VehicleItem
} from '@personal-erp/contracts';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { webRuntime } from '@/shared/config/env';
import { createNonNegativeMoneyWonSchema } from '@/shared/lib/money';
import { appLayout } from '@/shared/ui/layout-metrics';
import {
  buildVehicleFuelLogFallbackItem,
  createVehicleFuelLog,
  mergeVehicleFuelLogItem,
  updateVehicleFuelLog,
  vehicleFuelLogsQueryKey
} from './vehicles.api';

const vehicleFuelLogFormSchema = z.object({
  vehicleId: z.string().trim().min(1, '차량을 선택해 주세요.'),
  filledOn: z.string().trim().min(1, '주유일을 입력해 주세요.'),
  odometerKm: z.coerce
    .number()
    .int()
    .min(0, '주유 시점 주행거리는 0 이상이어야 합니다.'),
  liters: z.coerce.number().positive('주유량은 0보다 커야 합니다.'),
  amountWon: createNonNegativeMoneyWonSchema('주유 금액은 0 이상이어야 합니다.'),
  unitPriceWon: createNonNegativeMoneyWonSchema(
    '리터당 단가는 0 이상이어야 합니다.'
  ),
  isFullTank: z.boolean()
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
  const [feedback, setFeedback] = React.useState<SubmitFeedback>(null);
  const form = useForm<VehicleFuelLogFormInput>({
    resolver: zodResolver(vehicleFuelLogFormSchema),
    defaultValues: buildDefaultValues(vehicles, initialVehicleId)
  });

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

      if (!webRuntime.demoFallbackEnabled) {
        await queryClient.invalidateQueries({
          queryKey: vehicleFuelLogsQueryKey
        });
      }
    }
  });

  React.useEffect(() => {
    setFeedback(null);

    if (mode === 'edit' && initialFuelLog) {
      form.reset(mapFuelLogToFormInput(initialFuelLog));
      return;
    }

    form.reset(buildDefaultValues(vehicles, initialVehicleId));
  }, [form, initialFuelLog, initialVehicleId, mode, vehicles]);

  const isBusy = mutation.isPending || form.formState.isSubmitting;
  const submitLabel = mode === 'edit' ? '연료 기록 수정' : '연료 기록 저장';

  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        setFeedback(null);

        const selectedVehicle =
          vehicles.find((vehicle) => vehicle.id === values.vehicleId) ?? null;

        if (!selectedVehicle) {
          setFeedback({
            severity: 'error',
            message: '연료 기록을 연결할 차량을 먼저 선택해 주세요.'
          });
          return;
        }

        const payload: CreateVehicleFuelLogRequest = {
          filledOn: values.filledOn,
          odometerKm: values.odometerKm,
          liters: values.liters,
          amountWon: values.amountWon,
          unitPriceWon: values.unitPriceWon,
          isFullTank: values.isFullTank
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
            form.reset(buildDefaultValues(vehicles, values.vehicleId));
          }

          setFeedback({
            severity: 'success',
            message:
              mode === 'edit'
                ? '연료 기록을 수정했고 목록을 새로고침했습니다.'
                : '연료 기록을 저장했고 목록을 새로고침했습니다.'
          });
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
        {feedback ? (
          <Alert severity={feedback.severity} variant="outlined">
            {feedback.message}
          </Alert>
        ) : null}
        <Alert severity="info" variant="outlined">
          연료 이력은 차량 운영 판단을 위한 보조 데이터이며, 실제 회계 확정은
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
              label="주유일"
              type="date"
              InputLabelProps={{ shrink: true }}
              error={Boolean(form.formState.errors.filledOn)}
              helperText={form.formState.errors.filledOn?.message}
              {...form.register('filledOn')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="주유 시점 주행거리 (km)"
              type="number"
              error={Boolean(form.formState.errors.odometerKm)}
              helperText={form.formState.errors.odometerKm?.message}
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
              {...form.register('liters')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="주유 금액 (원)"
              type="number"
              error={Boolean(form.formState.errors.amountWon)}
              helperText={form.formState.errors.amountWon?.message}
              {...form.register('amountWon')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="리터당 단가 (원)"
              type="number"
              error={Boolean(form.formState.errors.unitPriceWon)}
              helperText={form.formState.errors.unitPriceWon?.message}
              {...form.register('unitPriceWon')}
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
): VehicleFuelLogFormInput {
  return {
    vehicleId: initialVehicleId ?? vehicles[0]?.id ?? '',
    filledOn: new Date().toISOString().slice(0, 10),
    odometerKm: 0,
    liters: 0,
    amountWon: 0,
    unitPriceWon: 0,
    isFullTank: true
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
    isFullTank: fuelLog.isFullTank
  };
}
