'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { parseMoneyWon } from '@personal-erp/money';
import type { FeedbackAlertValue } from '@/shared/ui/feedback-alert';
import { FeedbackAlert } from '@/shared/ui/feedback-alert';
import { formatWon } from '@/shared/lib/format';
import type { FundingAccountBootstrapTarget } from './reference-data.shared';

const bootstrapSchema = z.object({
  initialBalanceWon: z
    .string()
    .trim()
    .refine((value) => value === '' || /^\d+$/.test(value), {
      message: '0 이상의 원 단위 숫자로 입력해 주세요.'
    })
    .refine(
      (value) => value === '' || parseMoneyWon(value, { min: 0 }) != null,
      {
        message: '처리할 수 있는 금액 범위를 초과했습니다.'
      }
    )
});

type FundingAccountBootstrapFormInput = z.infer<typeof bootstrapSchema>;

export type FundingAccountBootstrapSubmitInput = {
  initialBalanceWon?: number | null;
};

export function FundingAccountBootstrapDialog({
  target,
  feedback,
  busy,
  onClose,
  onSubmit
}: {
  target: FundingAccountBootstrapTarget;
  feedback: FeedbackAlertValue;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: FundingAccountBootstrapSubmitInput) => Promise<void>;
}) {
  const form = useForm<FundingAccountBootstrapFormInput>({
    resolver: zodResolver(bootstrapSchema),
    defaultValues: {
      initialBalanceWon: ''
    }
  });

  React.useEffect(() => {
    if (target) {
      form.reset({
        initialBalanceWon: ''
      });
    }
  }, [form, target]);

  const title = target ? `${target.name} 기초금액 입력` : '기초금액 입력';

  return (
    <Dialog
      open={target !== null}
      onClose={busy ? undefined : onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack
          component="form"
          id="funding-account-bootstrap-form"
          spacing={2}
          sx={{ pt: 0.5 }}
          onSubmit={form.handleSubmit(async (values) => {
            const amountText = values.initialBalanceWon.trim();
            try {
              await onSubmit({
                initialBalanceWon:
                  amountText === ''
                    ? null
                    : parseMoneyWon(amountText, { min: 0 })
              });
            } catch {
              // 상위 mutation onError가 다이얼로그 피드백을 갱신한다.
            }
          })}
        >
          <DialogContentText>
            기초 업로드 대기 상태를 닫습니다. 금액을 입력하면 기초전표가
            발행되고, 비워두면 전표 없이 대기 상태만 완료합니다.
          </DialogContentText>

          {target ? (
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary">
                현재 잔액
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {formatWon(target.balanceWon)}
              </Typography>
            </Stack>
          ) : null}

          <Alert severity="info" variant="outlined">
            통장 기초금액은 현금및예금 / 순자산 전표로, 카드 기초금액은 순자산 /
            카드미지급금 전표로 기록됩니다.
          </Alert>

          <TextField
            label="기초금액"
            placeholder="예: 500000"
            disabled={busy}
            error={Boolean(form.formState.errors.initialBalanceWon)}
            helperText={
              form.formState.errors.initialBalanceWon?.message ??
              '필수 입력은 아닙니다. 0원 또는 빈 값이면 기초전표를 만들지 않습니다.'
            }
            inputProps={{
              min: 0,
              step: 1,
              inputMode: 'numeric'
            }}
            {...form.register('initialBalanceWon')}
          />

          <FeedbackAlert feedback={feedback} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={busy} variant="outlined">
          취소
        </Button>
        <Button
          form="funding-account-bootstrap-form"
          type="submit"
          variant="contained"
          disabled={busy}
        >
          {busy ? '처리 중...' : '기초 처리 완료'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
