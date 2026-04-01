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
          backgroundImage: 'none'
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
          gap: 2
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6">{title}</Typography>
          {description ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {description}
            </Typography>
          ) : null}
        </Box>
        <IconButton onClick={onClose} aria-label="닫기" size="small">
          <CloseRoundedIcon />
        </IconButton>
      </Box>

      <Divider />

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
