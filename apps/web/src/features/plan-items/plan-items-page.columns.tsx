import Link from 'next/link';
import { Button, Stack, Typography } from '@mui/material';
import type { JournalEntryItem, PlanItemItem } from '@personal-erp/contracts';
import type { GridColDef } from '@mui/x-data-grid';
import { formatDate, formatWon } from '@/shared/lib/format';
import { StatusChip } from '@/shared/ui/status-chip';
import { resolveLatestLinkedJournalEntry } from '@/features/transactions/transactions-page.shared';
import { resolveCollectedTransactionActionHint } from '@/features/transactions/transaction-workflow';

type PlanItemColumnsOptions = {
  canConfirmCollectedTransactions: boolean;
  confirmPending: boolean;
  confirmingTransactionId?: string;
  journalEntriesById: Map<string, JournalEntryItem>;
  linkedJournalEntryIdByCollectedTransaction: Map<string, string>;
  onConfirm: (item: PlanItemItem) => void;
};

export function buildPlanItemColumns({
  canConfirmCollectedTransactions,
  confirmPending,
  confirmingTransactionId,
  journalEntriesById,
  linkedJournalEntryIdByCollectedTransaction,
  onConfirm
}: PlanItemColumnsOptions): GridColDef<PlanItemItem>[] {
  return [
    {
      field: 'plannedDate',
      headerName: '계획일',
      flex: 0.9,
      valueFormatter: (value) => formatDate(String(value))
    },
    {
      field: 'title',
      headerName: '제목',
      flex: 1.4
    },
    {
      field: 'plannedAmount',
      headerName: '계획 금액',
      flex: 1,
      valueFormatter: (value) => formatWon(Number(value))
    },
    {
      field: 'ledgerTransactionTypeName',
      headerName: '거래 유형',
      flex: 1
    },
    {
      field: 'fundingAccountName',
      headerName: '자금수단',
      flex: 1
    },
    {
      field: 'categoryName',
      headerName: '카테고리',
      flex: 1
    },
    {
      field: 'status',
      headerName: '상태',
      flex: 0.9,
      renderCell: (params) => <StatusChip label={String(params.value)} />
    },
    {
      field: 'executionLink',
      headerName: '실행 연결',
      flex: 1.6,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <PlanItemLinkCell
          item={params.row}
          canConfirmCollectedTransactions={canConfirmCollectedTransactions}
          confirmPending={confirmPending}
          confirmingTransactionId={confirmingTransactionId}
          journalEntriesById={journalEntriesById}
          linkedJournalEntryIdByCollectedTransaction={
            linkedJournalEntryIdByCollectedTransaction
          }
          onConfirm={onConfirm}
        />
      )
    }
  ];
}

function PlanItemLinkCell({
  item,
  canConfirmCollectedTransactions,
  confirmPending,
  confirmingTransactionId,
  journalEntriesById,
  linkedJournalEntryIdByCollectedTransaction,
  onConfirm
}: {
  item: PlanItemItem;
  canConfirmCollectedTransactions: boolean;
  confirmPending: boolean;
  confirmingTransactionId?: string;
  journalEntriesById: Map<string, JournalEntryItem>;
  linkedJournalEntryIdByCollectedTransaction: Map<string, string>;
  onConfirm: (item: PlanItemItem) => void;
}) {
  const linkedJournalEntry = resolvePlanItemLinkedJournalEntry(
    item,
    journalEntriesById,
    linkedJournalEntryIdByCollectedTransaction
  );
  const isConfirming =
    confirmPending &&
    item.matchedCollectedTransactionId != null &&
    item.matchedCollectedTransactionId === confirmingTransactionId;
  const actionHint = item.matchedCollectedTransactionStatus
    ? resolveCollectedTransactionActionHint(
        item.matchedCollectedTransactionStatus
      )
    : null;

  if (item.postedJournalEntryId) {
    return (
      <Button
        size="small"
        component={Link}
        href={`/journal-entries?entryId=${item.postedJournalEntryId}`}
      >
        {item.postedJournalEntryNumber ?? '전표 보기'}
      </Button>
    );
  }

  if (item.matchedCollectedTransactionId) {
    const canConfirm =
      canConfirmCollectedTransactions &&
      linkedJournalEntry == null &&
      item.matchedCollectedTransactionStatus === 'READY_TO_POST';

    return (
      <Stack spacing={0.5} sx={{ py: 0.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          {item.matchedCollectedTransactionStatus ? (
            <StatusChip label={item.matchedCollectedTransactionStatus} />
          ) : null}
          {linkedJournalEntry ? (
            <Button
              size="small"
              component={Link}
              href={`/journal-entries?entryId=${linkedJournalEntry.id}`}
            >
              {linkedJournalEntry.entryNumber}
            </Button>
          ) : null}
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          {canConfirm ? (
            <Button
              size="small"
              variant="contained"
              disabled={isConfirming}
              onClick={() => {
                onConfirm(item);
              }}
            >
              {isConfirming ? '확정 중...' : '바로 전표 확정'}
            </Button>
          ) : null}
          <Button
            size="small"
            component={Link}
            href={`/transactions?transactionId=${item.matchedCollectedTransactionId}`}
          >
            {readPlanItemTransactionActionLabel(
              item.matchedCollectedTransactionStatus
            )}
          </Button>
        </Stack>
        {actionHint ? (
          <Typography variant="caption" color="text.secondary">
            {actionHint}
          </Typography>
        ) : null}
      </Stack>
    );
  }

  return (
    <Typography variant="body2" color="text.secondary">
      아직 실제 거래 연결 없음
    </Typography>
  );
}

export function buildPlanItemConfirmFallbackEntry(
  item: PlanItemItem,
  collectedTransactionId: string
): JournalEntryItem {
  return {
    id: `je-demo-${collectedTransactionId}`,
    entryNumber: 'DEMO',
    entryDate: `${item.plannedDate}T00:00:00.000Z`,
    status: 'POSTED',
    sourceKind: 'COLLECTED_TRANSACTION',
    memo: item.title,
    sourceCollectedTransactionId: collectedTransactionId,
    sourceCollectedTransactionTitle: item.title,
    lines: []
  };
}

function resolvePlanItemLinkedJournalEntry(
  item: PlanItemItem,
  journalEntriesById: Map<string, JournalEntryItem>,
  linkedJournalEntryIdByCollectedTransaction: Map<string, string>
): JournalEntryItem | null {
  const collectedTransactionId = item.matchedCollectedTransactionId;
  if (!collectedTransactionId) {
    return null;
  }

  const journalEntryId =
    linkedJournalEntryIdByCollectedTransaction.get(collectedTransactionId) ??
    null;
  if (!journalEntryId) {
    return null;
  }

  return resolveLatestLinkedJournalEntry(journalEntriesById, journalEntryId);
}

function readPlanItemTransactionActionLabel(
  status: PlanItemItem['matchedCollectedTransactionStatus']
) {
  switch (status) {
    case 'COLLECTED':
    case 'REVIEWED':
      return '수집 거래 보완';
    case 'READY_TO_POST':
      return '수집 거래 보기';
    default:
      return '수집 거래';
  }
}
