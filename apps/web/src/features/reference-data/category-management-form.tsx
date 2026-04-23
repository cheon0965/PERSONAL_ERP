'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, MenuItem, Stack, TextField } from '@mui/material';
import type { CategoryItem, CategoryKind } from '@personal-erp/contracts';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  FeedbackAlert,
  type FeedbackAlertValue
} from '@/shared/ui/feedback-alert';
import { appLayout } from '@/shared/ui/layout-metrics';

const categoryManagementSchema = z.object({
  name: z.string().trim().min(1, '카테고리 이름을 입력해 주세요.'),
  kind: z.enum(['INCOME', 'EXPENSE', 'TRANSFER'])
});

type CategoryManagementFormInput = z.infer<typeof categoryManagementSchema>;

export type CategoryManagementSubmitInput = {
  name: string;
  kind: CategoryKind;
};

export function CategoryManagementForm({
  feedback,
  mode,
  initialCategory,
  busy,
  onSubmit
}: {
  feedback: FeedbackAlertValue;
  mode: 'create' | 'edit';
  initialCategory?: CategoryItem | null;
  busy: boolean;
  onSubmit: (input: CategoryManagementSubmitInput) => Promise<void> | void;
}) {
  const form = useForm<CategoryManagementFormInput>({
    resolver: zodResolver(categoryManagementSchema),
    defaultValues: {
      name: '',
      kind: 'EXPENSE'
    }
  });

  React.useEffect(() => {
    if (mode === 'edit' && initialCategory) {
      form.reset({
        name: initialCategory.name,
        kind: initialCategory.kind
      });
      return;
    }

    form.reset({
      name: '',
      kind: 'EXPENSE'
    });
  }, [form, initialCategory, mode]);

  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        await onSubmit({
          name: values.name.trim(),
          kind: values.kind
        });
      })}
    >
      <Stack spacing={appLayout.cardGap}>
        <Alert severity="info" variant="outlined">
          {mode === 'create'
            ? '현재 범위에서는 카테고리를 새로 만들고 바로 활성 상태로 운영에 투입할 수 있습니다.'
            : '현재 범위에서는 카테고리 이름과 활성 상태만 관리합니다. 구분(kind)은 기존 거래 의미를 보존하기 위해 수정하지 않습니다.'}
        </Alert>

        <TextField
          label="카테고리 이름"
          error={Boolean(form.formState.errors.name)}
          helperText={form.formState.errors.name?.message}
          disabled={busy}
          {...form.register('name')}
        />

        <TextField
          select
          label="구분"
          disabled={busy || mode === 'edit'}
          helperText={
            mode === 'edit'
              ? '기존 거래 의미를 바꾸지 않기 위해 생성 후에는 구분을 유지합니다.'
              : '수입/지출/이체 중 해당 카테고리의 성격을 선택합니다.'
          }
          {...form.register('kind')}
        >
          <MenuItem value="INCOME">수입</MenuItem>
          <MenuItem value="EXPENSE">지출</MenuItem>
          <MenuItem value="TRANSFER">이체</MenuItem>
        </TextField>

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
              ? '카테고리 추가'
              : '카테고리 저장'}
        </Button>
      </Stack>
    </form>
  );
}
