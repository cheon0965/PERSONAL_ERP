'use client';

import type { ImportBatchItem } from '@personal-erp/contracts';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { buildImportBatchColumns } from './imports.columns';

export function ImportBatchesGrid({
  batches,
  selectedBatchId,
  onSelectBatch
}: {
  batches: ImportBatchItem[];
  selectedBatchId: string | null;
  onSelectBatch: (batch: ImportBatchItem) => void;
}) {
  return (
    <DataTableCard
      title="업로드 배치 목록"
      description="최근 업로드 배치를 확인하고, 선택한 배치의 업로드 행을 바로 검토할 수 있습니다."
      rows={batches}
      columns={buildImportBatchColumns({ selectedBatchId, onSelectBatch })}
      height={360}
    />
  );
}
