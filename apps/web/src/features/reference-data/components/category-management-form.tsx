'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, MenuItem, Stack, TextField } from '@mui/material';
import type {
  AccountSubjectItem,
  CategoryItem,
  CategoryKind
} from '@personal-erp/contracts';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  FeedbackAlert,
  type FeedbackAlertValue
} from '@/shared/ui/feedback-alert';
import { appLayout } from '@/shared/ui/layout-metrics';

const categoryManagementSchema = z
  .object({
    name: z.string().trim().min(1, '카테고리 이름을 입력해 주세요.'),
    kind: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']),
    defaultAccountSubjectId: z.string()
  })
  .superRefine((value, context) => {
    if (
      value.kind !== 'TRANSFER' &&
      value.defaultAccountSubjectId.trim().length === 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['defaultAccountSubjectId'],
        message: '전표에 사용할 기본 계정과목을 선택해 주세요.'
      });
    }
  });

type CategoryManagementFormInput = z.infer<typeof categoryManagementSchema>;

export type CategoryManagementSubmitInput = {
  name: string;
  kind: CategoryKind;
  defaultAccountSubjectId: string | null;
};

export function CategoryManagementForm({
  feedback,
  mode,
  initialCategory,
  accountSubjects,
  busy,
  onSubmit
}: {
  feedback: FeedbackAlertValue;
  mode: 'create' | 'edit';
  initialCategory?: CategoryItem | null;
  accountSubjects: AccountSubjectItem[];
  busy: boolean;
  onSubmit: (input: CategoryManagementSubmitInput) => Promise<void> | void;
}) {
  const form = useForm<CategoryManagementFormInput>({
    resolver: zodResolver(categoryManagementSchema),
    defaultValues: {
      name: '',
      kind: 'EXPENSE',
      defaultAccountSubjectId: ''
    }
  });
  const selectedKind = form.watch('kind');
  const eligibleAccountSubjects = React.useMemo(
    () =>
      accountSubjects.filter(
        (accountSubject) =>
          selectedKind !== 'TRANSFER' &&
          accountSubject.statementType === 'PROFIT_AND_LOSS' &&
          accountSubject.subjectKind === selectedKind &&
          accountSubject.isSystem &&
          accountSubject.isActive
      ),
    [accountSubjects, selectedKind]
  );

  React.useEffect(() => {
    if (mode === 'edit' && initialCategory) {
      form.reset({
        name: initialCategory.name,
        kind: initialCategory.kind,
        defaultAccountSubjectId: initialCategory.defaultAccountSubjectId ?? ''
      });
      return;
    }

    form.reset({
      name: '',
      kind: 'EXPENSE',
      defaultAccountSubjectId: ''
    });
  }, [form, initialCategory, mode]);

  React.useEffect(() => {
    if (selectedKind === 'TRANSFER') {
      form.setValue('defaultAccountSubjectId', '');
      return;
    }

    const currentAccountSubjectId = form.getValues('defaultAccountSubjectId');
    if (
      eligibleAccountSubjects.some(
        (accountSubject) => accountSubject.id === currentAccountSubjectId
      )
    ) {
      return;
    }

    const genericCode = selectedKind === 'INCOME' ? '4100' : '5100';
    form.setValue(
      'defaultAccountSubjectId',
      eligibleAccountSubjects.find(
        (accountSubject) => accountSubject.code === genericCode
      )?.id ?? ''
    );
  }, [eligibleAccountSubjects, form, selectedKind]);

  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        try {
          await onSubmit({
            name: values.name.trim(),
            kind: values.kind,
            defaultAccountSubjectId:
              values.kind === 'TRANSFER' ? null : values.defaultAccountSubjectId
          });
        } catch {
          // 상위 mutation onError가 드로어 피드백을 갱신한다.
        }
      })}
    >
      <Stack spacing={appLayout.cardGap}>
        <Alert severity="info" variant="outlined">
          {mode === 'create'
            ? '카테고리를 만들 때 전표에 사용할 표준 손익 계정과목을 함께 지정합니다.'
            : '카테고리 이름과 표준 계정과목을 관리합니다. 구분(kind)은 기존 거래 의미를 보존하기 위해 수정하지 않습니다.'}
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

        {selectedKind === 'TRANSFER' ? (
          <Alert severity="info" variant="outlined">
            이체는 손익을 만들지 않으므로 기본 계정과목을 연결하지 않습니다.
          </Alert>
        ) : (
          <TextField
            select
            label="기본 계정과목"
            error={Boolean(form.formState.errors.defaultAccountSubjectId)}
            helperText={
              form.formState.errors.defaultAccountSubjectId?.message ??
              '이 카테고리로 전표를 확정할 때 사용할 표준 손익 계정과목입니다.'
            }
            disabled={busy || eligibleAccountSubjects.length === 0}
            {...form.register('defaultAccountSubjectId')}
          >
            {eligibleAccountSubjects.map((accountSubject) => (
              <MenuItem key={accountSubject.id} value={accountSubject.id}>
                {accountSubject.code} · {accountSubject.name}
              </MenuItem>
            ))}
          </TextField>
        )}

        <FeedbackAlert feedback={feedback} />
        <Button
          type="submit"
          variant="contained"
          disabled={
            busy ||
            (selectedKind !== 'TRANSFER' &&
              eligibleAccountSubjects.length === 0)
          }
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
