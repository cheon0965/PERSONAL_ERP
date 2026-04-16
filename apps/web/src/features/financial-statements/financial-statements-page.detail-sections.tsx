'use client';

import { Grid, Stack, Typography } from '@mui/material';
import type { FinancialStatementKind } from '@personal-erp/contracts';
import { formatWon } from '@/shared/lib/format';
import { appLayout } from '@/shared/ui/layout-metrics';
import { SectionCard } from '@/shared/ui/section-card';
import { getFinancialStatements } from './financial-statements.api';

type FinancialStatementsView = NonNullable<
  Awaited<ReturnType<typeof getFinancialStatements>>
>;

export function FinancialStatementsDetailSections({
  view
}: {
  view: FinancialStatementsView;
}) {
  return (
    <>
      <SectionCard
        title="이월 및 기준선"
        description="이 재무제표가 어느 마감과 이월 기록을 기준으로 시작했는지 추적합니다."
      >
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">
            기초 잔액 출처:{' '}
            {readOpeningSourceLabel(view.basis.openingBalanceSourceKind)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            차기 이월 기록: {view.basis.carryForwardRecordId ?? '없음'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            기준 마감 스냅샷: {view.basis.sourceClosingSnapshotId ?? '없음'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            기준 월: {view.basis.sourceMonthLabel ?? '없음'}
          </Typography>
        </Stack>
      </SectionCard>

      <Grid container spacing={appLayout.sectionGap}>
        {view.comparison.map((comparison) => (
          <Grid key={comparison.statementKind} size={{ xs: 12, lg: 6 }}>
            <SectionCard
              title={`${readStatementKindLabel(comparison.statementKind)} 비교`}
              description={
                view.previousPeriod
                  ? `${view.period.monthLabel} vs ${view.previousPeriod.monthLabel}`
                  : `${view.period.monthLabel} 단독 요약`
              }
            >
              <Stack spacing={1.2}>
                {comparison.metrics.map((metric) => (
                  <Stack
                    key={`${comparison.statementKind}-${metric.label}`}
                    direction="row"
                    justifyContent="space-between"
                    spacing={2}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {metric.label}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {formatWon(metric.currentAmountWon)}
                      {metric.deltaWon === null
                        ? ''
                        : ` / ${formatWon(metric.deltaWon)} 변동`}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </SectionCard>
          </Grid>
        ))}
      </Grid>

      <Stack spacing={appLayout.sectionGap}>
        {view.snapshots.map((snapshot) => (
          <SectionCard
            key={snapshot.id}
            title={readStatementKindLabel(snapshot.statementKind)}
            description={`${snapshot.monthLabel} 기준 공식 보고 스냅샷입니다.`}
          >
            <Stack spacing={appLayout.cardGap}>
              <Stack spacing={1}>
                <Typography variant="subtitle2">핵심 요약</Typography>
                {snapshot.payload.summary.map((item) => (
                  <Typography
                    key={item.label}
                    variant="body2"
                    color="text.secondary"
                  >
                    {item.label}: {formatWon(item.amountWon)}
                  </Typography>
                ))}
              </Stack>

              <Stack spacing={appLayout.fieldGap}>
                {snapshot.payload.sections.map((section) => (
                  <Stack key={section.title} spacing={1}>
                    <Typography variant="subtitle2">{section.title}</Typography>
                    {section.items.length > 0 ? (
                      section.items.map((item) => (
                        <Typography
                          key={`${section.title}-${item.label}`}
                          variant="body2"
                          color="text.secondary"
                        >
                          {item.label}: {formatWon(item.amountWon)}
                        </Typography>
                      ))
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        표시할 항목이 없습니다.
                      </Typography>
                    )}
                  </Stack>
                ))}
              </Stack>

              {snapshot.payload.notes.length > 0 ? (
                <Stack spacing={1}>
                  <Typography variant="subtitle2">메모</Typography>
                  {snapshot.payload.notes.map((note) => (
                    <Typography
                      key={note}
                      variant="body2"
                      color="text.secondary"
                    >
                      {note}
                    </Typography>
                  ))}
                </Stack>
              ) : null}
            </Stack>
          </SectionCard>
        ))}
      </Stack>
    </>
  );
}

export function ReportInfoItem({
  label,
  value,
  description
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="subtitle1">{value}</Typography>
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
    </Stack>
  );
}

export function readStatementKindLabel(statementKind: FinancialStatementKind) {
  switch (statementKind) {
    case 'STATEMENT_OF_FINANCIAL_POSITION':
      return '사업 재무상태표';
    case 'MONTHLY_PROFIT_AND_LOSS':
      return '월간 손익보고서';
    case 'CASH_FLOW_SUMMARY':
      return '현금흐름 요약표';
    case 'NET_WORTH_MOVEMENT':
      return '순자산 변동표';
    default:
      return statementKind;
  }
}

export function readOpeningSourceLabel(sourceKind: string | null) {
  switch (sourceKind) {
    case 'INITIAL_SETUP':
      return '초기 설정';
    case 'CARRY_FORWARD':
      return '차기 이월';
    default:
      return '없음';
  }
}
