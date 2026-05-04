'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DataGrid,
  type DataGridProps,
  type GridColDef,
  type GridRowId,
  type GridRowParams,
  type GridRowSelectionModel
} from '@mui/x-data-grid';
import {
  Box,
  Card,
  CardContent,
  Checkbox,
  Divider,
  Stack,
  TablePagination,
  Typography
} from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import { alpha, useTheme } from '@mui/material/styles';
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
  mobileCard?: (row: T, context: DataTableMobileCardContext) => ReactNode;
  emptyLabel?: string;
  mobileEmptyLabel?: string;
  disableMobileCards?: boolean;
};

export type DataTableMobileCardContext = {
  selected: boolean;
  selectable: boolean;
  toggleSelected: () => void;
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
  isRowSelectable,
  mobileCard,
  emptyLabel,
  mobileEmptyLabel,
  disableMobileCards = false
}: DataTableCardProps<T>) {
  const resolvedEmptyLabel =
    emptyLabel ?? mobileEmptyLabel ?? '표시할 항목이 없습니다.';
  const resolvedRowHeight = rowHeight ?? 64;
  const [mobilePage, setMobilePage] = useState(0);
  const [mobileRowsPerPage, setMobileRowsPerPage] = useState(5);
  const responsiveColumns = useMemo(
    () =>
      columns.map((column) =>
        column.minWidth != null || column.width != null
          ? column
          : { ...column, minWidth: 120 }
      ),
    [columns]
  );
  const usesMobileCards = !disableMobileCards;
  const theme = useTheme();
  const isDesktopGridViewport = useMediaQuery(theme.breakpoints.up('md'), {
    noSsr: true
  });
  const shouldRenderDesktopGrid = !usesMobileCards || isDesktopGridViewport;
  const shouldRenderMobileCards = usesMobileCards && !isDesktopGridViewport;
  // 모바일 카드 목록도 표와 같은 데이터 양을 다루므로, 화면 높이를 밀어내지 않게 자체 페이지를 둔다.
  const mobilePageCount = Math.max(
    1,
    Math.ceil(rows.length / mobileRowsPerPage)
  );
  const hasMobilePagination = rows.length > 5;
  const visibleMobileRows = useMemo(
    () =>
      rows.slice(
        mobilePage * mobileRowsPerPage,
        mobilePage * mobileRowsPerPage + mobileRowsPerPage
      ),
    [mobilePage, mobileRowsPerPage, rows]
  );
  const selectedRowIds = useMemo(() => {
    if (!rowSelectionModel || rowSelectionModel.type !== 'include') {
      return new Set<GridRowId>();
    }

    return rowSelectionModel.ids;
  }, [rowSelectionModel]);

  useEffect(() => {
    if (mobilePage > mobilePageCount - 1) {
      setMobilePage(mobilePageCount - 1);
    }
  }, [mobilePage, mobilePageCount]);

  function handleMobileSelectionToggle(row: T, selectable: boolean) {
    if (!selectable || !rowSelectionModel || !onRowSelectionModelChange) {
      return;
    }

    const nextSelectedIds = new Set(
      rowSelectionModel.type === 'include' ? rowSelectionModel.ids : []
    );

    if (nextSelectedIds.has(row.id)) {
      nextSelectedIds.delete(row.id);
    } else {
      nextSelectedIds.add(row.id);
    }

    onRowSelectionModelChange(
      {
        type: 'include',
        ids: nextSelectedIds
      },
      {} as Parameters<
        NonNullable<DataGridProps<T>['onRowSelectionModelChange']>
      >[1]
    );
  }

  function readMobileRowSelectable(row: T) {
    if (!checkboxSelection) {
      return false;
    }

    if (!isRowSelectable) {
      return true;
    }

    return Boolean(
      isRowSelectable({
        id: row.id,
        row,
        columns: responsiveColumns
      } as GridRowParams<T>)
    );
  }

  function renderDefaultMobileCard(
    row: T,
    context: DataTableMobileCardContext
  ) {
    const actionColumn = responsiveColumns.find(isMobileActionColumn);
    const contentColumns = responsiveColumns.filter(
      (column) => !isMobileActionColumn(column) && column.field !== 'id'
    );
    const primaryColumn =
      contentColumns.find((column) =>
        preferredMobilePrimaryFields.has(column.field)
      ) ?? contentColumns[0];
    const amountColumn = contentColumns.find(
      (column) =>
        column !== primaryColumn &&
        mobileAmountFieldPattern.test(`${column.field} ${column.headerName}`)
    );
    const detailColumns = contentColumns
      .filter((column) => column !== primaryColumn && column !== amountColumn)
      .slice(0, 6);
    const actionContent = actionColumn
      ? renderMobileColumnValue(row, actionColumn)
      : null;

    return (
      <Box
        component="article"
        sx={{
          p: 1.5,
          borderRadius: 2,
          border: '1px solid',
          borderColor: context.selected ? 'primary.main' : 'divider',
          bgcolor: context.selected ? 'action.selected' : 'background.paper',
          minWidth: 0
        }}
      >
        <Stack spacing={1.25}>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            {context.selectable ? (
              <Checkbox
                checked={context.selected}
                onChange={context.toggleSelected}
                size="small"
                sx={{ mt: -0.75, ml: -1, flexShrink: 0 }}
                inputProps={{
                  'aria-label': `${resolveMobileTextValue(
                    row,
                    primaryColumn
                  )} 선택`
                }}
              />
            ) : null}
            <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
              {primaryColumn ? (
                <>
                  <Typography variant="caption" color="text.secondary">
                    {resolveMobileColumnLabel(primaryColumn)}
                  </Typography>
                  <Box
                    sx={{
                      minWidth: 0,
                      fontSize: (theme) => theme.typography.subtitle2.fontSize,
                      fontWeight: 800,
                      overflowWrap: 'anywhere',
                      '& .MuiTypography-root': {
                        fontWeight: 800
                      }
                    }}
                  >
                    {renderMobileColumnValue(row, primaryColumn)}
                  </Box>
                </>
              ) : (
                <Typography variant="subtitle2" fontWeight={800}>
                  {row.id}
                </Typography>
              )}
            </Stack>
            {amountColumn ? (
              <Box
                sx={{
                  flexShrink: 0,
                  maxWidth: '46%',
                  textAlign: 'right',
                  fontSize: (theme) => theme.typography.subtitle2.fontSize,
                  fontWeight: 900,
                  overflowWrap: 'anywhere'
                }}
              >
                {renderMobileColumnValue(row, amountColumn)}
              </Box>
            ) : null}
          </Stack>

          {detailColumns.length > 0 ? (
            <>
              <Divider flexItem />
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))' },
                  gap: 1
                }}
              >
                {detailColumns.map((column) => (
                  <Stack key={column.field} spacing={0.25} sx={{ minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary">
                      {resolveMobileColumnLabel(column)}
                    </Typography>
                    <Box
                      sx={{
                        minWidth: 0,
                        fontSize: (theme) => theme.typography.body2.fontSize,
                        fontWeight: 700,
                        overflowWrap: 'anywhere',
                        '& .MuiButton-root': {
                          minWidth: 0,
                          px: 0,
                          justifyContent: 'flex-start',
                          textAlign: 'left'
                        },
                        '& .MuiChip-root': {
                          maxWidth: '100%'
                        }
                      }}
                    >
                      {renderMobileColumnValue(row, column)}
                    </Box>
                  </Stack>
                ))}
              </Box>
            </>
          ) : null}

          {actionContent ? (
            <>
              <Divider flexItem />
              <Box
                sx={{
                  minWidth: 0,
                  '& .MuiStack-root': {
                    minWidth: 0
                  },
                  '& .MuiButton-root': {
                    minWidth: 0,
                    whiteSpace: 'nowrap'
                  }
                }}
              >
                {actionContent}
              </Box>
            </>
          ) : null}
        </Stack>
      </Box>
    );
  }

  return (
    <Card
      sx={{
        position: 'relative',
        height: '100%',
        display: 'flex',
        minWidth: 0,
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
      <CardContent
        sx={{ p: appLayout.cardPadding, flex: 1, width: '100%', minWidth: 0 }}
      >
        <Stack spacing={appLayout.cardGap} sx={{ height: '100%', minWidth: 0 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            sx={{ minWidth: 0 }}
          >
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="h6" sx={{ overflowWrap: 'anywhere' }}>
                {title}
              </Typography>
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
                    display: '-webkit-box',
                    overflowWrap: 'anywhere'
                  }}
                >
                  {description}
                </Typography>
              ) : null}
            </Box>
            {actions ? (
              <Box
                sx={{
                  width: { xs: '100%', sm: 'auto' },
                  maxWidth: '100%',
                  minWidth: 0,
                  flexShrink: 0,
                  '& .MuiStack-root': {
                    minWidth: 0
                  },
                  '& .MuiButton-root': {
                    minWidth: 0,
                    maxWidth: '100%',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }
                }}
              >
                {actions}
              </Box>
            ) : null}
          </Stack>
          {toolbar ? <Box sx={{ minWidth: 0 }}>{toolbar}</Box> : null}
          {shouldRenderDesktopGrid ? (
            <Box
              sx={{
                width: '100%',
                minWidth: 0,
                height,
                borderRadius: '4px 4px 0 0',
                overflow: 'hidden'
              }}
            >
              <DataGrid
                rows={rows}
                columns={responsiveColumns}
                columnBufferPx={4096}
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
                localeText={{
                  noRowsLabel: resolvedEmptyLabel,
                  noResultsOverlayLabel: resolvedEmptyLabel
                }}
                sx={{
                  minWidth: 0,
                  '& .MuiDataGrid-main': {
                    minWidth: 0
                  },
                  '& .MuiDataGrid-columnHeaderTitle': {
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  },
                  '& .MuiDataGrid-cell': {
                    display: 'flex',
                    alignItems: 'center',
                    py: 0.75,
                    lineHeight: 1.45,
                    minWidth: 0
                  },
                  '& .MuiDataGrid-cell > *': {
                    maxWidth: '100%'
                  },
                  '& .MuiDataGrid-cellContent': {
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  },
                  '& .MuiDataGrid-cell .MuiButton-root': {
                    minHeight: 30,
                    px: 1.1,
                    borderRadius: 999,
                    borderWidth: 1.5,
                    whiteSpace: 'nowrap'
                  },
                  '& .MuiDataGrid-cell .MuiButton-contained': {
                    boxShadow: 'none'
                  },
                  '& .MuiDataGrid-cell .MuiButton-text': {
                    px: 0.75,
                    backgroundColor: 'transparent',
                    '&:hover': {
                      backgroundColor: alpha(
                        brandTokens.palette.primaryBright,
                        0.08
                      )
                    }
                  },
                  '& .MuiDataGrid-cell .MuiChip-root': {
                    flexShrink: 0,
                    maxWidth: '100%',
                    cursor: 'default'
                  },
                  '& .MuiDataGrid-cell .MuiTypography-root': {
                    lineHeight: 1.45
                  },
                  '& .MuiDataGrid-footerContainer': {
                    minWidth: 0,
                    overflow: 'hidden'
                  },
                  '& .MuiTablePagination-toolbar': {
                    flexWrap: 'wrap',
                    minHeight: 'auto',
                    rowGap: 0.5,
                    py: 0.5,
                    pl: { xs: 0.5, sm: 2 },
                    pr: { xs: 0.5, sm: 2 }
                  },
                  '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows':
                    {
                      my: 0.5
                    },
                  '& .MuiTablePagination-spacer': {
                    display: { xs: 'none', sm: 'block' }
                  }
                }}
              />
            </Box>
          ) : null}
          {shouldRenderMobileCards ? (
            <Box sx={{ minWidth: 0 }}>
              {rows.length > 0 ? (
                <Stack spacing={1.25}>
                  {visibleMobileRows.map((row) => {
                    const selectable = readMobileRowSelectable(row);

                    return (
                      <Box key={row.id} sx={{ minWidth: 0 }}>
                        {(mobileCard ?? renderDefaultMobileCard)(row, {
                          selected: selectedRowIds.has(row.id),
                          selectable,
                          toggleSelected: () => {
                            handleMobileSelectionToggle(row, selectable);
                          }
                        })}
                      </Box>
                    );
                  })}
                  {hasMobilePagination ? (
                    <Box
                      sx={{
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.default',
                        overflow: 'hidden'
                      }}
                    >
                      <TablePagination
                        component="div"
                        count={rows.length}
                        page={mobilePage}
                        rowsPerPage={mobileRowsPerPage}
                        rowsPerPageOptions={[5, 10, 20]}
                        labelRowsPerPage="페이지당 항목"
                        labelDisplayedRows={({ from, to, count }) =>
                          `${from}-${to} / ${count}`
                        }
                        onPageChange={(_, page) => {
                          setMobilePage(page);
                        }}
                        onRowsPerPageChange={(event) => {
                          setMobileRowsPerPage(Number(event.target.value));
                          setMobilePage(0);
                        }}
                        sx={{
                          '& .MuiTablePagination-toolbar': {
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            minHeight: 'auto',
                            gap: 0.75,
                            px: 1,
                            py: 0.75
                          },
                          '& .MuiTablePagination-spacer': {
                            display: 'none'
                          },
                          '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows':
                            {
                              my: 0,
                              fontSize: (theme) =>
                                theme.typography.caption.fontSize
                            },
                          '& .MuiTablePagination-input': {
                            mr: 0.5
                          },
                          '& .MuiTablePagination-actions': {
                            ml: 0,
                            flexShrink: 0
                          }
                        }}
                      />
                    </Box>
                  ) : null}
                </Stack>
              ) : (
                <Box
                  sx={{
                    minHeight: 160,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 2,
                    border: '1px dashed',
                    borderColor: 'divider',
                    bgcolor: 'background.default',
                    px: 2,
                    textAlign: 'center'
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    {resolvedEmptyLabel}
                  </Typography>
                </Box>
              )}
            </Box>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}

const preferredMobilePrimaryFields = new Set([
  'title',
  'name',
  'displayName',
  'productName',
  'provider',
  'vehicleName',
  'entryNumber',
  'businessDate',
  'monthLabel',
  'email',
  'tenantName'
]);

const mobileAmountFieldPattern =
  /(amount|total|balance|premium|cost|expense|won|금액|보험료|비용|잔액|합계)/i;

function isMobileActionColumn<T extends { id: string }>(column: GridColDef<T>) {
  const field = column.field.toLowerCase();
  const headerName = String(column.headerName ?? '').toLowerCase();

  return (
    field === 'actions' ||
    field.endsWith('actions') ||
    headerName === '동작' ||
    headerName.includes('action')
  );
}

function resolveMobileColumnLabel<T extends { id: string }>(
  column: GridColDef<T>
) {
  return column.headerName ?? column.field;
}

function renderMobileColumnValue<T extends { id: string }>(
  row: T,
  column: GridColDef<T>
) {
  const rawValue = readMobileColumnValue(row, column);
  const formattedValue = formatMobileColumnValue(row, column, rawValue);

  if (column.renderCell) {
    const renderCell = column.renderCell as (
      params: Parameters<NonNullable<GridColDef<T>['renderCell']>>[0]
    ) => ReactNode;

    return normalizeMobileNode(
      renderCell({
        id: row.id,
        field: column.field,
        row,
        value: rawValue,
        formattedValue,
        colDef: column
      } as Parameters<NonNullable<GridColDef<T>['renderCell']>>[0])
    );
  }

  return normalizeMobileNode(formattedValue);
}

function resolveMobileTextValue<T extends { id: string }>(
  row: T,
  column: GridColDef<T> | undefined
) {
  if (!column) {
    return row.id;
  }

  const value = formatMobileColumnValue(
    row,
    column,
    readMobileColumnValue(row, column)
  );

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }

  return row.id;
}

function readMobileColumnValue<T extends { id: string }>(
  row: T,
  column: GridColDef<T>
) {
  const rawValue = (row as Record<string, unknown>)[column.field];

  if (!column.valueGetter) {
    return rawValue;
  }

  const valueGetter = column.valueGetter as (
    value: unknown,
    row: T,
    column: GridColDef<T>
  ) => unknown;

  return valueGetter(rawValue, row, column);
}

function formatMobileColumnValue<T extends { id: string }>(
  row: T,
  column: GridColDef<T>,
  value: unknown
) {
  if (!column.valueFormatter) {
    return value;
  }

  const valueFormatter = column.valueFormatter as (
    value: unknown,
    row: T,
    column: GridColDef<T>
  ) => ReactNode;

  return valueFormatter(value, row, column);
}

function normalizeMobileNode(value: unknown): ReactNode {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }

  return value as ReactNode;
}
