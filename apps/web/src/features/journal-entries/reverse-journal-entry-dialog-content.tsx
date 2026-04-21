import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  DialogActions,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import type { ReverseJournalEntryRequest } from '@personal-erp/contracts';
import { useForm } from 'react-hook-form';
import { findAccountingPeriodForDate } from '@/features/accounting-periods/accounting-period-selection';
import { appLayout } from '@/shared/ui/layout-metrics';
import {
  buildReverseJournalEntryFallbackItem,
  reverseJournalEntry
} from './journal-entries.api';
import {
  buildReverseDefaultValues,
  invalidateAdjustmentQueries,
  trimOptionalText
} from './journal-entry-adjustment-dialog.shared';
import type {
  JournalEntryAdjustmentContentProps,
  ReverseJournalEntryFormInput,
  SubmitFeedback
} from './journal-entry-adjustment-dialog.types';
import { reverseJournalEntrySchema } from './journal-entry-adjustment-dialog.types';

export function ReverseJournalEntryDialogContent({
  entry,
  adjustmentPeriod,
  journalWritablePeriods,
  onClose,
  onCompleted
}: JournalEntryAdjustmentContentProps) {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = React.useState<SubmitFeedback>(null);
  const form = useForm<ReverseJournalEntryFormInput>({
    resolver: zodResolver(reverseJournalEntrySchema),
    defaultValues: buildReverseDefaultValues(adjustmentPeriod)
  });

  React.useEffect(() => {
    form.reset(buildReverseDefaultValues(adjustmentPeriod));
    setFeedback(null);
  }, [adjustmentPeriod, entry.id, form]);

  const mutation = useMutation({
    mutationFn: (payload: ReverseJournalEntryRequest) =>
      reverseJournalEntry(
        entry.id,
        payload,
        buildReverseJournalEntryFallbackItem(entry, payload)
      ),
    onSuccess: async (createdEntry) => {
      await invalidateAdjustmentQueries(queryClient);
      onCompleted(createdEntry, 'reverse');
      onClose();
    },
    onError: (error) => {
      setFeedback({
        severity: 'error',
        message:
          error instanceof Error
            ? error.message
            : '반전 전표를 생성하지 못했습니다.'
      });
    }
  });

  const canSubmit = journalWritablePeriods.length > 0;

  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        setFeedback(null);

        if (journalWritablePeriods.length === 0) {
          setFeedback({
            severity: 'error',
            message:
              '전표 입력 가능한 운영 기간이 없어 반전 전표를 생성할 수 없습니다.'
          });
          return;
        }

        if (
          !findAccountingPeriodForDate(journalWritablePeriods, values.entryDate)
        ) {
          setFeedback({
            severity: 'error',
            message:
              '반전 전표 일자는 전표 입력 가능한 열린 운영 기간 안에 있어야 합니다.'
          });
          return;
        }

        await mutation.mutateAsync({
          entryDate: values.entryDate,
          reason: trimOptionalText(values.reason)
        });
      })}
    >
      <Stack spacing={appLayout.cardGap}>
        {!canSubmit ? (
          <Alert severity="warning" variant="outlined">
            전표 입력 가능한 운영 기간이 없어 반전 전표를 시작할 수 없습니다.
          </Alert>
        ) : (
          <Alert severity="info" variant="outlined">
            {entry.entryNumber} 전표를 {adjustmentPeriod?.monthLabel} 운영
            기간을 기본 기준으로 반전합니다.
          </Alert>
        )}
        {feedback ? (
          <Alert severity={feedback.severity} variant="outlined">
            {feedback.message}
          </Alert>
        ) : null}

        <Stack spacing={1}>
          <Typography variant="subtitle2">원전표 요약</Typography>
          <Typography variant="body2" color="text.secondary">
            상태: {entry.status} | 전표 일자: {entry.entryDate.slice(0, 10)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {entry.memo ?? '메모 없음'}
          </Typography>
        </Stack>

        <TextField
          label="반전 전표 일자"
          type="date"
          disabled={!canSubmit || mutation.isPending}
          error={Boolean(form.formState.errors.entryDate)}
          helperText={
            form.formState.errors.entryDate?.message ??
            (journalWritablePeriods.length > 1
              ? '전표 입력 가능한 열린 운영 기간 안에서만 반전할 수 있습니다.'
              : adjustmentPeriod
                ? `${adjustmentPeriod.monthLabel} 운영 기간 안에서만 반전할 수 있습니다.`
                : '전표 입력 가능한 운영 기간이 필요합니다.')
          }
          {...form.register('entryDate')}
        />
        <TextField
          label="반전 사유"
          multiline
          minRows={3}
          disabled={mutation.isPending}
          error={Boolean(form.formState.errors.reason)}
          helperText={
            form.formState.errors.reason?.message ??
            '선택 사항입니다. 비우면 기본 메모를 사용합니다.'
          }
          {...form.register('reason')}
        />
      </Stack>
      <DialogActions sx={{ px: 0, pt: appLayout.cardGap }}>
        <Button onClick={onClose} disabled={mutation.isPending}>
          취소
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={!canSubmit || mutation.isPending}
        >
          {mutation.isPending ? '반전 생성 중...' : '반전 전표 생성'}
        </Button>
      </DialogActions>
    </form>
  );
}
