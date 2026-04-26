'use client';

import type { ReactNode } from 'react';
import { Stack, type StackProps } from '@mui/material';

type GridCellStackProps = Omit<StackProps, 'children'> & {
  children: ReactNode;
};

export function GridInlineCell({
  children,
  sx,
  ...stackProps
}: GridCellStackProps) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      useFlexGap
      {...stackProps}
      sx={{
        width: '100%',
        minWidth: 0,
        minHeight: '100%',
        py: 0.5,
        columnGap: 0.75,
        rowGap: 0.5,
        overflow: 'hidden',
        '& .MuiButton-root, & .MuiChip-root': {
          flexShrink: 0,
          whiteSpace: 'nowrap'
        },
        ...sx
      }}
    >
      {children}
    </Stack>
  );
}

export function GridActionCell({
  children,
  sx,
  ...stackProps
}: GridCellStackProps) {
  return (
    <GridInlineCell
      flexWrap="wrap"
      alignContent="center"
      {...stackProps}
      sx={{
        overflow: 'visible',
        ...sx
      }}
    >
      {children}
    </GridInlineCell>
  );
}

export function GridStackCell({
  children,
  sx,
  ...stackProps
}: GridCellStackProps) {
  return (
    <Stack
      spacing={0.5}
      justifyContent="center"
      alignItems="flex-start"
      {...stackProps}
      sx={{
        width: '100%',
        minWidth: 0,
        minHeight: '100%',
        py: 0.5,
        overflow: 'hidden',
        '& .MuiButton-root, & .MuiChip-root': {
          flexShrink: 0,
          whiteSpace: 'nowrap'
        },
        ...sx
      }}
    >
      {children}
    </Stack>
  );
}
