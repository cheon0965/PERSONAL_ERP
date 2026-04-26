import type { Route } from 'next';
import Link from 'next/link';
import { Button, Chip, Typography } from '@mui/material';
import type {
  VehicleFuelLogItem,
  VehicleLogCollectedTransactionLink,
  VehicleItem,
  VehicleMaintenanceLogItem,
  VehicleOperatingSummaryItem
} from '@personal-erp/contracts';
import type { GridColDef } from '@mui/x-data-grid';
import { formatNumber, formatWon } from '@/shared/lib/format';
import {
  GridActionCell,
  GridInlineCell,
  GridStackCell
} from '@/shared/ui/data-grid-cell';
import { StatusChip } from '@/shared/ui/status-chip';
import {
  fuelColumns,
  fuelTypeLabelMap,
  maintenanceColumns
} from './vehicles.columns';

type VehicleColumnsInput = {
  operatingSummaryByVehicleId: Map<string, VehicleOperatingSummaryItem>;
  onEditVehicle: (vehicle: VehicleItem) => void;
  onCreateFuelLog: (vehicleId?: string | null) => void;
  onCreateMaintenanceLog: (vehicleId?: string | null) => void;
};

export function buildVehicleColumns({
  operatingSummaryByVehicleId,
  onEditVehicle,
  onCreateFuelLog,
  onCreateMaintenanceLog
}: VehicleColumnsInput): GridColDef<VehicleItem>[] {
  return [
    {
      field: 'name',
      headerName: '차량명',
      flex: 1.2
    },
    {
      field: 'manufacturer',
      headerName: '제조사',
      flex: 1,
      valueFormatter: (value) => (value ? String(value) : '-')
    },
    {
      field: 'fuelType',
      headerName: '연료 종류',
      flex: 0.9,
      valueFormatter: (value) =>
        fuelTypeLabelMap[String(value)] ?? String(value)
    },
    {
      field: 'initialOdometerKm',
      headerName: '초기 주행거리',
      flex: 1,
      valueFormatter: (value) => `${formatNumber(Number(value))} km`
    },
    {
      field: 'recordedOperatingExpenseWon',
      headerName: '기록 운영비',
      flex: 1,
      valueGetter: (_value, row) =>
        operatingSummaryByVehicleId.get(row.id)?.recordedOperatingExpenseWon ??
        0,
      valueFormatter: (value) => formatWon(Number(value))
    },
    {
      field: 'estimatedFuelEfficiencyKmPerLiter',
      headerName: '입력 기준 연비',
      flex: 0.9,
      valueFormatter: (value) =>
        value == null ? '-' : `${formatNumber(Number(value), 2)} km/L`
    },
    {
      field: 'recordedFuelEfficiencyKmPerLiter',
      headerName: '기록 연비',
      flex: 0.9,
      valueGetter: (_value, row) =>
        operatingSummaryByVehicleId.get(row.id)
          ?.recordedFuelEfficiencyKmPerLiter ?? null,
      valueFormatter: (value) =>
        value == null ? '-' : `${formatNumber(Number(value), 2)} km/L`
    },
    {
      field: 'expenseDefaults',
      headerName: '운영비 기본값',
      flex: 1.1,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <GridActionCell>
          {params.row.defaultFundingAccountId ? (
            <Chip label="자금수단" size="small" variant="outlined" />
          ) : null}
          {params.row.defaultFuelCategoryId ? (
            <Chip label="연료" size="small" variant="outlined" />
          ) : null}
          {params.row.defaultMaintenanceCategoryId ? (
            <Chip label="정비" size="small" variant="outlined" />
          ) : null}
          {params.row.operatingExpensePlanOptIn ? (
            <Chip
              label="계획"
              size="small"
              color="primary"
              variant="outlined"
            />
          ) : null}
          {!params.row.defaultFundingAccountId &&
          !params.row.defaultFuelCategoryId &&
          !params.row.defaultMaintenanceCategoryId &&
          !params.row.operatingExpensePlanOptIn ? (
            <Typography variant="body2" color="text.secondary">
              -
            </Typography>
          ) : null}
        </GridActionCell>
      )
    },
    {
      field: 'actions',
      headerName: '동작',
      flex: 0.9,
      minWidth: 270,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <GridActionCell>
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              onEditVehicle(params.row);
            }}
          >
            수정
          </Button>
          <Button
            size="small"
            variant="text"
            onClick={() => {
              onCreateFuelLog(params.row.id);
            }}
          >
            연료 기록
          </Button>
          <Button
            size="small"
            variant="text"
            onClick={() => {
              onCreateMaintenanceLog(params.row.id);
            }}
          >
            정비 기록
          </Button>
        </GridActionCell>
      )
    }
  ];
}

export function buildFuelLogColumns({
  onEditFuelLog,
  onDeleteFuelLog
}: {
  onEditFuelLog: (fuelLog: VehicleFuelLogItem) => void;
  onDeleteFuelLog: (fuelLog: VehicleFuelLogItem) => void;
}): GridColDef<VehicleFuelLogItem>[] {
  return [
    ...fuelColumns,
    {
      field: 'linkedCollectedTransaction',
      headerName: '회계 연동',
      flex: 1.1,
      sortable: false,
      filterable: false,
      renderCell: (params) =>
        params.row.linkedCollectedTransaction ? (
          <VehicleLogAccountingLinkView
            link={params.row.linkedCollectedTransaction}
          />
        ) : (
          <GridInlineCell>
            <Chip label="미연결" size="small" variant="outlined" />
          </GridInlineCell>
        )
    },
    {
      field: 'actions',
      headerName: '동작',
      flex: 0.8,
      minWidth: 170,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const deleteBlockReason = readVehicleLogDeleteBlockReason(
          params.row.linkedCollectedTransaction
        );

        return (
          <GridStackCell>
            <GridActionCell>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  onEditFuelLog(params.row);
                }}
              >
                수정
              </Button>
              <Button
                size="small"
                color="error"
                variant="text"
                disabled={Boolean(deleteBlockReason)}
                onClick={() => {
                  onDeleteFuelLog(params.row);
                }}
              >
                삭제
              </Button>
            </GridActionCell>
            {deleteBlockReason ? (
              <Typography variant="caption" color="text.secondary">
                {deleteBlockReason}
              </Typography>
            ) : null}
          </GridStackCell>
        );
      }
    }
  ];
}

export function buildMaintenanceLogColumns({
  onEditMaintenanceLog,
  onDeleteMaintenanceLog
}: {
  onEditMaintenanceLog: (maintenanceLog: VehicleMaintenanceLogItem) => void;
  onDeleteMaintenanceLog: (maintenanceLog: VehicleMaintenanceLogItem) => void;
}): GridColDef<VehicleMaintenanceLogItem>[] {
  return [
    ...maintenanceColumns,
    {
      field: 'linkedCollectedTransaction',
      headerName: '회계 연동',
      flex: 1.1,
      sortable: false,
      filterable: false,
      renderCell: (params) =>
        params.row.linkedCollectedTransaction ? (
          <VehicleLogAccountingLinkView
            link={params.row.linkedCollectedTransaction}
          />
        ) : (
          <GridInlineCell>
            <Chip label="미연결" size="small" variant="outlined" />
          </GridInlineCell>
        )
    },
    {
      field: 'actions',
      headerName: '동작',
      flex: 0.8,
      minWidth: 170,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const deleteBlockReason = readVehicleLogDeleteBlockReason(
          params.row.linkedCollectedTransaction
        );

        return (
          <GridStackCell>
            <GridActionCell>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  onEditMaintenanceLog(params.row);
                }}
              >
                수정
              </Button>
              <Button
                size="small"
                color="error"
                variant="text"
                disabled={Boolean(deleteBlockReason)}
                onClick={() => {
                  onDeleteMaintenanceLog(params.row);
                }}
              >
                삭제
              </Button>
            </GridActionCell>
            {deleteBlockReason ? (
              <Typography variant="caption" color="text.secondary">
                {deleteBlockReason}
              </Typography>
            ) : null}
          </GridStackCell>
        );
      }
    }
  ];
}

function VehicleLogAccountingLinkView({
  link
}: {
  link: VehicleLogCollectedTransactionLink;
}) {
  return (
    <GridStackCell>
      <StatusChip label={link.postingStatus} />
      {link.postedJournalEntryId && link.postedJournalEntryNumber ? (
        <Button
          size="small"
          component={Link}
          href={`/journal-entries/${link.postedJournalEntryId}` as Route}
          sx={{ justifyContent: 'flex-start', px: 0 }}
        >
          {link.postedJournalEntryNumber}
        </Button>
      ) : null}
    </GridStackCell>
  );
}

function readVehicleLogDeleteBlockReason(
  link: VehicleLogCollectedTransactionLink | null
) {
  if (!link) {
    return null;
  }

  if (link.postedJournalEntryId) {
    return '전표 확정 후에는 전표 반전/정정으로 조정';
  }

  if (
    link.postingStatus === 'POSTED' ||
    link.postingStatus === 'CORRECTED' ||
    link.postingStatus === 'LOCKED'
  ) {
    return '확정 상태라 삭제 불가';
  }

  return null;
}
