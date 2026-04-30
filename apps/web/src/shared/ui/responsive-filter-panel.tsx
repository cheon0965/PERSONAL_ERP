'use client';

import * as React from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded';
import {
  Box,
  Button,
  Chip,
  Drawer,
  IconButton,
  Stack,
  Typography
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { brandTokens } from '@/shared/theme/tokens';
import { appLayout } from './layout-metrics';

type ResponsiveFilterPanelProps = {
  title?: string;
  description?: string;
  activeFilterCount?: number;
  activeFilterLabels?: React.ReactNode[];
  clearLabel?: string;
  onClear?: () => void;
  children: React.ReactNode;
};

export function ResponsiveFilterPanel({
  title = '조회조건',
  description,
  activeFilterCount = 0,
  activeFilterLabels = [],
  clearLabel = '초기화',
  onClear,
  children
}: ResponsiveFilterPanelProps) {
  const [open, setOpen] = React.useState(false);
  const hasActiveFilters = activeFilterCount > 0;

  return (
    <>
      <Box sx={{ display: { xs: 'none', md: 'block' }, minWidth: 0 }}>
        {children}
      </Box>

      <Stack
        spacing={1.25}
        sx={{
          display: { xs: 'flex', md: 'none' },
          minWidth: 0,
          p: 1.25,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            fullWidth
            variant={hasActiveFilters ? 'contained' : 'outlined'}
            size="small"
            startIcon={<FilterListRoundedIcon fontSize="small" />}
            onClick={() => setOpen(true)}
            sx={{ justifyContent: 'flex-start' }}
          >
            {hasActiveFilters ? `${title} ${activeFilterCount}` : title}
          </Button>
          {hasActiveFilters && onClear ? (
            <Button
              size="small"
              variant="text"
              onClick={onClear}
              sx={{ flexShrink: 0 }}
            >
              {clearLabel}
            </Button>
          ) : null}
        </Stack>

        {activeFilterLabels.length > 0 ? (
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            {activeFilterLabels.map((label, index) => (
              <Chip
                key={`active-filter-${index}-${String(label)}`}
                label={label}
                size="small"
                variant="outlined"
              />
            ))}
          </Stack>
        ) : null}
      </Stack>

      <Drawer
        anchor="bottom"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{
          sx: {
            display: { xs: 'block', md: 'none' },
            maxHeight: '86vh',
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            bgcolor: 'background.default'
          }
        }}
      >
        <Stack
          spacing={appLayout.cardGap}
          sx={{
            p: 2,
            borderBottom: '1px solid',
            borderColor: alpha(brandTokens.palette.primaryBright, 0.12),
            bgcolor: 'background.paper'
          }}
        >
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="h6">{title}</Typography>
              {description ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.5, lineHeight: 1.6 }}
                >
                  {description}
                </Typography>
              ) : null}
            </Box>
            <IconButton
              aria-label="조회조건 닫기"
              size="small"
              onClick={() => setOpen(false)}
            >
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </Stack>
          {hasActiveFilters && onClear ? (
            <div>
              <Button size="small" variant="outlined" onClick={onClear}>
                {clearLabel}
              </Button>
            </div>
          ) : null}
        </Stack>
        <Box sx={{ p: 2, overflowY: 'auto' }}>{children}</Box>
      </Drawer>
    </>
  );
}
