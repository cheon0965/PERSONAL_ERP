'use client';

import type { ReactNode } from 'react';
import {
  DataGrid,
  type DataGridProps,
  type GridColDef,
  type GridRowSelectionModel
} from '@mui/x-data-grid';
import { Card, CardContent, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { brandTokens } from '@/shared/theme/tokens';
import { appLayout } from './layout-metrics';

type DataTableCardProps<T extends { id: string }> = {
  title: string;
  description?: string;
  actions?: ReactNode;
  toolbar?: ReactNode;
  rows: T[];
  columns: GridColDef<T>[];
  height?: number;
  rowHeight?: DataGridProps<T>['rowHeight'];
  getRowHeight?: DataGridProps<T>['getRowHeight'];
  checkboxSelection?: boolean;
  rowSelectionModel?: GridRowSelectionModel;
  onRowSelectionModelChange?: DataGridProps<T>['onRowSelectionModelChange'];
  isRowSelectable?: DataGridProps<T>['isRowSelectable'];
};

export function DataTableCard<T extends { id: string }>({
  title,
  description,
  actions,
  toolbar,
  rows,
  columns,
  height = 440,
  rowHeight,
  getRowHeight,
  checkboxSelection = false,
  rowSelectionModel,
  onRowSelectionModelChange,
  isRowSelectable
}: DataTableCardProps<T>) {
  const resolvedRowHeight = rowHeight ?? 64;

  return (
    <Card
      sx={{
        position: 'relative',
        height: '100%',
        display: 'flex',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: '0 0 auto 0',
          height: 3,
          background: `linear-gradient(90deg, ${alpha(
            brandTokens.palette.primaryBright,
            0.68
          )}, ${alpha(brandTokens.palette.secondary, 0.7)}, transparent)`
        }
      }}
    >
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
          <div
            style={{
              width: '100%',
              height,
              borderRadius: 16,
              overflow: 'hidden'
            }}
          >
            <DataGrid
              rows={rows}
              columns={columns}
              rowHeight={resolvedRowHeight}
              getRowHeight={getRowHeight}
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
              checkboxSelection={checkboxSelection}
              rowSelectionModel={rowSelectionModel}
              onRowSelectionModelChange={onRowSelectionModelChange}
              isRowSelectable={isRowSelectable}
              sx={{
                '& .MuiDataGrid-cell': {
                  display: 'flex',
                  alignItems: 'center',
                  py: 0.75,
                  lineHeight: 1.45
                },
                '& .MuiDataGrid-cell > *': {
                  maxWidth: '100%'
                },
                '& .MuiDataGrid-cell .MuiButton-root': {
                  minHeight: 30,
                  px: 1.1,
                  whiteSpace: 'nowrap'
                },
                '& .MuiDataGrid-cell .MuiChip-root': {
                  flexShrink: 0,
                  maxWidth: '100%'
                },
                '& .MuiDataGrid-cell .MuiTypography-root': {
                  lineHeight: 1.45
                }
              }}
            />
          </div>
        </Stack>
      </CardContent>
    </Card>
  );
}
