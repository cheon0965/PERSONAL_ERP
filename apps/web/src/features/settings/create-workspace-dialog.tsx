'use client';

import * as React from 'react';
import AddBusinessRoundedIcon from '@mui/icons-material/AddBusinessRounded';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  TextField
} from '@mui/material';
import type { CreateWorkspaceRequest } from '@personal-erp/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { authWorkspacesQueryKey } from '@/features/auth/auth.api';
import { readErrorUserMessage } from '@/shared/api/fetch-json';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { workspaceSettingsQueryKey } from './settings.api';

type CreateWorkspaceDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
};

const defaultCurrency = 'KRW';
const defaultTimezone = 'Asia/Seoul';

export function CreateWorkspaceDialog({
  open,
  onClose,
  onCreated
}: CreateWorkspaceDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { createWorkspace } = useAuthSession();
  const [slugEdited, setSlugEdited] = React.useState(false);
  const [form, setForm] = React.useState<CreateWorkspaceRequest>(() =>
    createEmptyWorkspaceForm()
  );

  React.useEffect(() => {
    if (!open) {
      return;
    }

    setSlugEdited(false);
    setForm(createEmptyWorkspaceForm());
  }, [open]);

  const mutation = useMutation({
    mutationFn: (input: CreateWorkspaceRequest) => createWorkspace(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authWorkspacesQueryKey });
      await queryClient.invalidateQueries({
        queryKey: workspaceSettingsQueryKey
      });
      queryClient.clear();
      onCreated?.();
      onClose();
      router.refresh();
    }
  });

  const normalizedForm = normalizeWorkspaceForm(form);
  const canSubmit =
    normalizedForm.tenantName.length > 0 &&
    /^[a-z0-9-]{3,40}$/.test(normalizedForm.tenantSlug) &&
    normalizedForm.ledgerName.length > 0 &&
    /^[A-Z]{3}$/.test(normalizedForm.baseCurrency) &&
    normalizedForm.timezone.length >= 3 &&
    (!normalizedForm.openedFromYearMonth ||
      /^\d{4}-\d{2}$/.test(normalizedForm.openedFromYearMonth));

  const handleTenantNameChange = (value: string) => {
    setForm((current) => ({
      ...current,
      tenantName: value,
      ...(slugEdited ? {} : { tenantSlug: slugifyWorkspaceName(value) })
    }));
  };

  const handleSubmit = () => {
    if (!canSubmit || mutation.isPending) {
      return;
    }

    mutation.mutate(normalizedForm);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>사업장 추가</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {mutation.error ? (
            <Alert severity="error" variant="outlined">
              {readErrorUserMessage(
                mutation.error,
                '사업장을 만들지 못했습니다.'
              )}
            </Alert>
          ) : null}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                autoFocus
                label="사업장 이름"
                value={form.tenantName}
                onChange={(event) => handleTenantNameChange(event.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="사업장 슬러그"
                value={form.tenantSlug}
                onChange={(event) => {
                  setSlugEdited(true);
                  setForm((current) => ({
                    ...current,
                    tenantSlug: event.target.value.toLowerCase()
                  }));
                }}
                helperText="소문자, 숫자, 하이픈 3-40자"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="기본 장부 이름"
                value={form.ledgerName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    ledgerName: event.target.value
                  }))
                }
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                type="month"
                label="운영 시작 월"
                value={form.openedFromYearMonth ?? ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    openedFromYearMonth: event.target.value
                  }))
                }
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="기준 통화"
                value={form.baseCurrency}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    baseCurrency: event.target.value.toUpperCase()
                  }))
                }
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="시간대"
                value={form.timezone}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    timezone: event.target.value
                  }))
                }
              />
            </Grid>
          </Grid>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>
          취소
        </Button>
        <Button
          variant="contained"
          startIcon={<AddBusinessRoundedIcon />}
          disabled={!canSubmit || mutation.isPending}
          onClick={handleSubmit}
        >
          {mutation.isPending ? '생성 중...' : '사업장 생성'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function createEmptyWorkspaceForm(): CreateWorkspaceRequest {
  return {
    tenantName: '',
    tenantSlug: '',
    ledgerName: '기본 장부',
    baseCurrency: defaultCurrency,
    timezone: defaultTimezone,
    openedFromYearMonth: formatCurrentYearMonth()
  };
}

function normalizeWorkspaceForm(
  input: CreateWorkspaceRequest
): CreateWorkspaceRequest {
  return {
    tenantName: input.tenantName.trim().replace(/\s+/g, ' '),
    tenantSlug: input.tenantSlug.trim().toLowerCase(),
    ledgerName: input.ledgerName.trim().replace(/\s+/g, ' '),
    baseCurrency: input.baseCurrency.trim().toUpperCase(),
    timezone: input.timezone.trim(),
    openedFromYearMonth: input.openedFromYearMonth?.trim() || undefined
  };
}

function slugifyWorkspaceName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function formatCurrentYearMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
