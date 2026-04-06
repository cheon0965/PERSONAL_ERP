'use client';

import type { ImportBatchItem } from '@personal-erp/contracts';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { buildImportedRowsColumns } from './imports.columns';
import type { ImportedRowTableItem } from './imports.shared';

export function ImportedRowsGrid({
  selectedBatch,
  rows,
  selectedRowId,
  onPrepareCollect
}: {
  selectedBatch: ImportBatchItem | null;
  rows: ImportedRowTableItem[];
  selectedRowId: string | null;
  onPrepareCollect: (row: ImportedRowTableItem) => void;
}) {
  return (
    <DataTableCard
      title={selectedBatch ? `${selectedBatch.fileName} 업로드 행` : '업로드 행'}
      description={
        selectedBatch
          ? `${selectedBatch.fileName}의 행을 검토하고, 승격 전 preview와 승격 후 실제 연결 결과를 함께 확인할 수 있습니다.`
          : '먼저 업로드 배치를 선택해 주세요.'
      }
      rows={rows}
      columns={buildImportedRowsColumns({ selectedRowId, onPrepareCollect })}
      height={420}
    />
  );
}
