'use client';

import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { Card, CardContent, Stack, Typography } from '@mui/material';

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
      <CardContent>
        <Stack spacing={2}>
          <div>
            <Typography variant="h6">{title}</Typography>
            {description ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
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
