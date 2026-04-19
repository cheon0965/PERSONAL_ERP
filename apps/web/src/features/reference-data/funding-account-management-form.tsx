'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, MenuItem, Stack, TextField } from '@mui/material';
import type { AccountType, FundingAccountItem } from '@personal-erp/contracts';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { appLayout } from '@/shared/ui/layout-metrics';

const fundingAccountManagementSchema = z.object({
  name: z.string().trim().min(1, '자금수단 이름을 입력해 주세요.'),
  type: z.enum(['BANK', 'CASH', 'CARD'])
});

type FundingAccountManagementFormInput = z.infer<
  typeof fundingAccountManagementSchema
>;

export type FundingAccountManagementSubmitInput = {
  name: string;
  type: AccountType;
};

export function FundingAccountManagementForm({
  mode,
  initialFundingAccount,
  busy,
  onSubmit
}: {
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
      type: 'BANK'
    }
  });

  React.useEffect(() => {
    if (mode === 'edit' && initialFundingAccount) {
      form.reset({
        name: initialFundingAccount.name,
        type: initialFundingAccount.type
      });
      return;
    }

    form.reset({
      name: '',
      type: 'BANK'
    });
  }, [form, initialFundingAccount, mode]);

  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        await onSubmit({
          name: values.name.trim(),
          type: values.type
        });
      })}
    >
      <Stack spacing={appLayout.cardGap}>
        <Alert severity="info" variant="outlined">
          {mode === 'create'
            ? '새 자금수단은 활성 상태로 생성되며 시작 잔액은 0원으로 둡니다. 실제 잔액 흐름은 운영 거래와 전표에서 쌓이도록 유지합니다.'
            : '현재 범위에서는 자금수단 이름만 여기서 수정합니다. 활성/비활성/종료 전환은 목록의 상태 관리 버튼으로 처리하고, 유형과 잔액은 기존 기록 의미를 보존하기 위해 직접 바꾸지 않습니다.'}
        </Alert>

        <TextField
          label="자금수단 이름"
          error={Boolean(form.formState.errors.name)}
          helperText={form.formState.errors.name?.message}
          disabled={busy}
          {...form.register('name')}
        />

        <TextField
          select
          label="유형"
          disabled={busy || mode === 'edit'}
          helperText={
            mode === 'edit'
              ? '기존 거래와 전표 맥락을 바꾸지 않기 위해 생성 후에는 유형을 유지합니다.'
              : '통장, 현금, 카드 중 실제 운영 형태에 맞는 유형을 선택합니다.'
          }
          {...form.register('type')}
        >
          <MenuItem value="BANK">통장</MenuItem>
          <MenuItem value="CASH">현금</MenuItem>
          <MenuItem value="CARD">카드</MenuItem>
        </TextField>

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
