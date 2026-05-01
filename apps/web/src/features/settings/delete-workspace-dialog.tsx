'use client';

import * as React from 'react';
import DeleteForeverRoundedIcon from '@mui/icons-material/DeleteForeverRounded';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  authWorkspacesQueryKey,
  getAccessibleWorkspaces
} from '@/features/auth/auth.api';
import { readErrorUserMessage } from '@/shared/api/fetch-json';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { workspaceSettingsQueryKey } from './settings.api';

type DeleteWorkspaceDialogProps = {
  open: boolean;
  onClose: () => void;
  onDeleted?: () => void;
};

export function DeleteWorkspaceDialog({
  open,
  onClose,
  onDeleted
}: DeleteWorkspaceDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { deleteWorkspace, user } = useAuthSession();
  const [confirmationSlug, setConfirmationSlug] = React.useState('');
  const currentWorkspace = user?.currentWorkspace ?? null;

  const workspacesQuery = useQuery({
    queryKey: authWorkspacesQueryKey,
    queryFn: getAccessibleWorkspaces,
    enabled: open
  });

  React.useEffect(() => {
    if (!open) {
      return;
    }

    setConfirmationSlug('');
  }, [open]);

  const activeWorkspaceCount = workspacesQuery.data?.items.length ?? 0;
  const isOwner = currentWorkspace?.membership.role === 'OWNER';
  const normalizedConfirmation = confirmationSlug.trim();
  const expectedSlug = currentWorkspace?.tenant.slug ?? '';
  const canDelete =
    Boolean(currentWorkspace) &&
    isOwner &&
    activeWorkspaceCount > 1 &&
    normalizedConfirmation === expectedSlug;

  const mutation = useMutation({
    mutationFn: () => {
      if (!currentWorkspace) {
        throw new Error('삭제할 사업장을 확인할 수 없습니다.');
      }

      return deleteWorkspace(currentWorkspace.tenant.id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authWorkspacesQueryKey });
      await queryClient.invalidateQueries({
        queryKey: workspaceSettingsQueryKey
      });
      queryClient.clear();
      onDeleted?.();
      onClose();
      router.refresh();
    }
  });

  const disabledReason = readDisabledReason({
    hasWorkspace: Boolean(currentWorkspace),
    isOwner,
    activeWorkspaceCount,
    isWorkspacesLoading: workspacesQuery.isLoading
  });

  const handleSubmit = () => {
    if (!canDelete || mutation.isPending) {
      return;
    }

    mutation.mutate();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>사업장 삭제</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Alert severity="warning" variant="outlined">
            삭제하면 이 사업장의 장부, 거래, 기준 데이터가 함께 삭제됩니다.
          </Alert>

          {disabledReason ? (
            <Alert severity="info" variant="outlined">
              {disabledReason}
            </Alert>
          ) : null}

          {mutation.error ? (
            <Alert severity="error" variant="outlined">
              {readErrorUserMessage(
                mutation.error,
                '사업장을 삭제하지 못했습니다.'
              )}
            </Alert>
          ) : null}

          <Stack spacing={0.75}>
            <Typography variant="body2" color="text.secondary">
              현재 사업장
            </Typography>
            <Typography variant="subtitle1" fontWeight={700}>
              {currentWorkspace?.tenant.name ?? '-'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {expectedSlug || '-'}
            </Typography>
          </Stack>

          <TextField
            fullWidth
            autoFocus
            label="사업장 슬러그 확인"
            value={confirmationSlug}
            disabled={mutation.isPending || Boolean(disabledReason)}
            onChange={(event) => setConfirmationSlug(event.target.value)}
            helperText={
              expectedSlug
                ? `${expectedSlug} 입력 시 삭제 버튼이 활성화됩니다.`
                : '삭제할 사업장을 확인할 수 없습니다.'
            }
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>
          취소
        </Button>
        <Button
          variant="contained"
          color="error"
          startIcon={<DeleteForeverRoundedIcon />}
          disabled={!canDelete || mutation.isPending}
          onClick={handleSubmit}
        >
          {mutation.isPending ? '삭제 중...' : '사업장 삭제'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function readDisabledReason(input: {
  hasWorkspace: boolean;
  isOwner: boolean;
  activeWorkspaceCount: number;
  isWorkspacesLoading: boolean;
}) {
  if (!input.hasWorkspace) {
    return '현재 연결된 사업장이 없습니다.';
  }

  if (!input.isOwner) {
    return '사업장 삭제는 소유자만 수행할 수 있습니다.';
  }

  if (input.isWorkspacesLoading) {
    return '삭제 가능 조건을 확인하고 있습니다.';
  }

  if (input.activeWorkspaceCount <= 1) {
    return '마지막으로 남은 사업장은 삭제할 수 없습니다.';
  }

  return null;
}
