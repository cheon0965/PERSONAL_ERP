'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, MenuItem, Stack, TextField } from '@mui/material';
import type { AccountType, FundingAccountItem } from '@personal-erp/contracts';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  FeedbackAlert,
  type FeedbackAlertValue
} from '@/shared/ui/feedback-alert';
import { appLayout } from '@/shared/ui/layout-metrics';

const fundingAccountManagementSchema = z.object({
  name: z.string().trim().min(1, '자금수단 이름을 입력해 주세요.'),
  type: z.enum(['BANK', 'CASH', 'CARD'])
});

type FundingAccountManagementFormInput = z.infer<
  typeof fundingAccountManagementSchema
>;

const defaultFundingAccountType: AccountType = 'BANK';

export type FundingAccountManagementSubmitInput = {
  name: string;
  type: AccountType;
};

export function FundingAccountManagementForm({
  feedback,
  mode,
  initialFundingAccount,
  busy,
  onSubmit
}: {
  feedback: FeedbackAlertValue;
  mode: 'create' | 'edit';
  initialFundingAccount?: FundingAccountItem | null;
  busy: boolean;
  onSubmit: (
    input: FundingAccountManagementSubmitInput
  ) => Promise<void> | void;
}) {
  const form = useForm<FundingAccountManagementFormInput>({
    resolver: zodResolver(fundingAccountManagementSchema),
    defaultValues: {
      name: '',
      type: defaultFundingAccountType
    }
  });

  React.useEffect(() => {
    if (mode === 'edit' && initialFundingAccount) {
      form.reset({
        name: initialFundingAccount.name,
        type: normalizeFundingAccountType(initialFundingAccount.type)
      });
      return;
    }

    form.reset({
      name: '',
      type: defaultFundingAccountType
    });
  }, [form, initialFundingAccount, mode]);

  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        try {
          await onSubmit({
            name: values.name.trim(),
            type: values.type
          });
        } catch {
          // 상위 mutation onError가 드로어 피드백을 갱신한다.
        }
      })}
    >
      <Stack spacing={appLayout.cardGap}>
        <Alert severity="info" variant="outlined">
          {mode === 'create'
            ? '새 통장/카드는 기초 업로드 대기 상태로 생성됩니다. 목록의 기초입력 버튼에서 시작 금액을 등록하거나 금액 없이 완료할 수 있습니다.'
            : '현재 범위에서는 자금수단 이름만 여기서 수정합니다. 활성/비활성/종료 전환은 목록의 상태 관리 버튼으로 처리하고, 유형과 잔액은 기존 기록 의미를 보존하기 위해 직접 바꾸지 않습니다.'}
        </Alert>

        <TextField
          label="자금수단 이름"
          error={Boolean(form.formState.errors.name)}
          helperText={form.formState.errors.name?.message}
          disabled={busy}
          {...form.register('name')}
        />

        <Controller
          control={form.control}
          name="type"
          render={({ field }) => (
            <TextField
              select
              label="유형"
              name={field.name}
              value={field.value ?? defaultFundingAccountType}
              onBlur={field.onBlur}
              onChange={field.onChange}
              inputRef={field.ref}
              disabled={busy || mode === 'edit'}
              error={Boolean(form.formState.errors.type)}
              helperText={
                form.formState.errors.type?.message ??
                (mode === 'edit'
                  ? '기존 거래와 전표 맥락을 바꾸지 않기 위해 생성 후에는 유형을 유지합니다.'
                  : '통장, 현금, 카드 중 실제 운영 형태에 맞는 유형을 선택합니다.')
              }
            >
              <MenuItem value="BANK">통장</MenuItem>
              <MenuItem value="CASH">현금</MenuItem>
              <MenuItem value="CARD">카드</MenuItem>
            </TextField>
          )}
        />

        <FeedbackAlert feedback={feedback} />
        <Button
          type="submit"
          variant="contained"
          disabled={busy}
          sx={{ alignSelf: 'flex-start' }}
        >
          {busy
            ? '저장 중...'
            : mode === 'create'
              ? '자금수단 추가'
              : '자금수단 저장'}
        </Button>
      </Stack>
    </form>
  );
}

function normalizeFundingAccountType(
  type: AccountType | undefined
): AccountType {
  return type === 'BANK' || type === 'CASH' || type === 'CARD'
    ? type
    : defaultFundingAccountType;
}
