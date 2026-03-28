'use client';

import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { Card, CardContent, Stack, Typography } from '@mui/material';
import { appLayout } from './layout-metrics';

type DataTableCardProps<T extends { id: string }> = {
  title: string;
  description?: string;
  rows: T[];
  columns: GridColDef<T>[];
  height?: number;
};

export function DataTableCard<T extends { id: string }>({
  title,
  description,
  rows,
  columns,
  height = 440
}: DataTableCardProps<T>) {
  return (
    <Card>
      <CardContent sx={{ p: appLayout.cardPadding }}>
        <Stack spacing={appLayout.cardGap}>
          <div>
            <Typography variant="h6">{title}</Typography>
            {description ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: appLayout.cardDescriptionOffset }}
              >
                {description}
              </Typography>
            ) : null}
          </div>
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
