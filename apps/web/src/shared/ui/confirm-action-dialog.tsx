'use client';

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { brandTokens } from '@/shared/theme/tokens';

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
      PaperProps={{
        sx: {
          overflow: 'hidden',
          border: '1px solid',
          borderColor: alpha(brandTokens.palette.primaryBright, 0.14),
          background: brandTokens.gradient.card,
          boxShadow: brandTokens.shadow.cardStrong
        }
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          pb: 1
        }}
      >
        <Box
          sx={{
            width: 10,
            height: 32,
            borderRadius: 999,
            background:
              confirmColor === 'error'
                ? brandTokens.palette.error
                : confirmColor === 'warning'
                  ? brandTokens.palette.warning
                  : brandTokens.gradient.brand
          }}
        />
        {title}
      </DialogTitle>
      <DialogContent>
        <DialogContentText>{description}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={busy} variant="outlined">
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
