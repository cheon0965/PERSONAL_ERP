'use client';

import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import {
  Box,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Typography
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { brandTokens } from '@/shared/theme/tokens';

type FormDrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function FormDrawer({
  open,
  onClose,
  title,
  description,
  children
}: FormDrawerProps) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 520 },
          maxWidth: '100%',
          backgroundColor: brandTokens.palette.background
        }
      }}
    >
      <Box
        sx={{
          px: { xs: 2.5, md: 3 },
          py: 2,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
          borderBottom: '1px solid',
          borderColor: alpha(brandTokens.palette.primaryBright, 0.12),
          background: `linear-gradient(135deg, ${alpha(
            brandTokens.palette.surface,
            0.95
          )}, ${alpha(brandTokens.palette.primaryTint, 0.9)})`
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6">{title}</Typography>
          {description ? (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 0.75, display: 'block', lineHeight: 1.7 }}
            >
              {description}
            </Typography>
          ) : null}
        </Box>
        <IconButton
          onClick={onClose}
          aria-label="닫기"
          size="small"
          sx={{
            border: '1px solid',
            borderColor: alpha(brandTokens.palette.primaryBright, 0.16),
            backgroundColor: alpha(brandTokens.palette.surface, 0.72)
          }}
        >
          <CloseRoundedIcon />
        </IconButton>
      </Box>

      <Divider sx={{ borderColor: alpha(brandTokens.palette.primary, 0.06) }} />

      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: { xs: 2.5, md: 3 },
          py: { xs: 2.5, md: 3 }
        }}
      >
        <Stack spacing={2.5}>{children}</Stack>
      </Box>
    </Drawer>
  );
}
