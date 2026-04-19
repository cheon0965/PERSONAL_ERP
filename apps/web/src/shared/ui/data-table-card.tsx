'use client';

import type { ReactNode } from 'react';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { Card, CardContent, Stack, Typography } from '@mui/material';
import { appLayout } from './layout-metrics';

type DataTableCardProps<T extends { id: string }> = {
  title: string;
  description?: string;
  actions?: ReactNode;
  toolbar?: ReactNode;
  rows: T[];
  columns: GridColDef<T>[];
  height?: number;
};

export function DataTableCard<T extends { id: string }>({
  title,
  description,
  actions,
  toolbar,
  rows,
  columns,
  height = 440
}: DataTableCardProps<T>) {
  return (
    <Card sx={{ height: '100%', display: 'flex' }}>
      <CardContent sx={{ p: appLayout.cardPadding, flex: 1, width: '100%' }}>
        <Stack spacing={appLayout.cardGap} sx={{ height: '100%' }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
          >
            <div>
              <Typography variant="h6">{title}</Typography>
              {description ? (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    mt: appLayout.cardDescriptionOffset,
                    maxWidth: 760,
                    lineHeight: 1.7,
                    overflow: 'hidden',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 2,
                    display: '-webkit-box'
                  }}
                >
                  {description}
                </Typography>
              ) : null}
            </div>
            {actions ? <div>{actions}</div> : null}
          </Stack>
          {toolbar ? <div>{toolbar}</div> : null}
          <div style={{ width: '100%', height }}>
            <DataGrid
              rows={rows}
              columns={columns}
              pageSizeOptions={[5, 10, 20]}
              initialState={{
                pagination: {
                  paginationModel: {
                    pageSize: 5,
                    page: 0
                  }
                }
              }}
              disableRowSelectionOnClick
            />
          </div>
        </Stack>
      </CardContent>
    </Card>
  );
}
