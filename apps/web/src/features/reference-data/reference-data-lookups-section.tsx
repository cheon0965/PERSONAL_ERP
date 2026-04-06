'use client';

import { Grid } from '@mui/material';
import type { AccountSubjectItem, LedgerTransactionTypeItem } from '@personal-erp/contracts';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { appLayout } from '@/shared/ui/layout-metrics';
import {
  accountSubjectColumns,
  ledgerTransactionTypeColumns
} from './reference-data.columns';

export function ReferenceDataLookupsSection({
  accountSubjects,
  ledgerTransactionTypes
}: {
  accountSubjects: AccountSubjectItem[];
  ledgerTransactionTypes: LedgerTransactionTypeItem[];
}) {
  return (
    <Grid container spacing={appLayout.sectionGap}>
      <Grid size={{ xs: 12, xl: 6 }}>
        <DataTableCard
          title="계정과목"
          description="전표 라인과 마감 잔액 계산에서 공통으로 쓰는 공식 계정과목입니다."
          rows={accountSubjects}
          columns={accountSubjectColumns}
          height={360}
        />
      </Grid>
      <Grid size={{ xs: 12, xl: 6 }}>
        <DataTableCard
          title="거래유형"
          description="계획 항목과 수집 거래가 공통으로 참조하는 사업 거래 유형입니다."
          rows={ledgerTransactionTypes}
          columns={ledgerTransactionTypeColumns}
          height={360}
        />
      </Grid>
    </Grid>
  );
}
