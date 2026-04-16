'use client';

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle
} from '@mui/material';

type ConfirmActionDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  pendingLabel?: string;
  confirmColor?: 'error' | 'primary' | 'warning';
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function ConfirmActionDialog({
  open,
  title,
  description,
  confirmLabel = '확인',
  pendingLabel = '처리 중...',
  confirmColor = 'primary',
  busy = false,
  onClose,
  onConfirm
}: ConfirmActionDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{description}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          취소
        </Button>
        <Button
          onClick={onConfirm}
          color={confirmColor}
          variant="contained"
          disabled={busy}
        >
          {busy ? pendingLabel : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
