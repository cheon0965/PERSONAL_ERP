'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import type {
  AccountingPeriodItem,
  FinancialStatementKind
} from '@personal-erp/contracts';
import { formatWon } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import { useAuthSession } from '@/shared/auth/auth-provider';
import {
  accountingPeriodsQueryKey,
  getAccountingPeriods
} from '@/features/accounting-periods/accounting-periods.api';
import {
  buildFinancialStatementsFallbackView,
  financialStatementsQueryKey,
  generateFinancialStatements,
  getFinancialStatements
} from './financial-statements.api';

export function FinancialStatementsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();
  const [feedback, setFeedback] = React.useState<{
    severity: 'success' | 'error';
    message: string;
  } | null>(null);
  const periodsQuery = useQuery({
    queryKey: accountingPeriodsQueryKey,
    queryFn: getAccountingPeriods
  });

  useDomainHelp({
    title: '재무제표 스냅샷 개요',
    description:
      '이 화면은 마감 후 생성되는 공식 보고 스냅샷을 보여줍니다. 전망이나 대시보드와 달리, 잠금된 기간에 대해 확정 저장된 결과만 다룹니다.',
    primaryEntity: '재무제표 스냅샷 (FinancialStatementSnapshot)',
    relatedEntities: [
      '운영 기간 (AccountingPeriod)',
      '마감 스냅샷 (ClosingSnapshot)',
      '전표 (JournalEntry)',
      '마감 라인 (BalanceSnapshotLine)'
    ],
    truthSource: '공식 재무제표는 잠금된 기간의 ClosingSnapshot과 JournalEntry를 근거로 생성됩니다.',
    readModelNote:
      'Round 8에서는 보고 결과를 snapshot으로 먼저 고정하고, 상세 표현과 비교 분석은 이후 라운드에서 확장합니다.'
  });

  const lockedPeriods = React.useMemo(
    () => (periodsQuery.data ?? []).filter((period) => period.status === 'LOCKED'),
    [periodsQuery.data]
  );

  const [selectedPeriodId, setSelectedPeriodId] = React.useState<string>('');

  React.useEffect(() => {
    if (!selectedPeriodId && lockedPeriods.length > 0) {
      setSelectedPeriodId(lockedPeriods[0]!.id);
    }
  }, [lockedPeriods, selectedPeriodId]);

  const selectedPeriod =
    lockedPeriods.find((period) => period.id === selectedPeriodId) ?? null;

  const statementsQuery = useQuery({
    queryKey: financialStatementsQueryKey(selectedPeriodId || null),
    queryFn: () => getFinancialStatements(selectedPeriodId || null),
    enabled: Boolean(selectedPeriodId)
  });

  const mutation = useMutation({
    mutationFn: (period: AccountingPeriodItem) =>
      generateFinancialStatements(
        {
          periodId: period.id
        },
        buildFinancialStatementsFallbackView(period)
      ),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: financialStatementsQueryKey(result.period.id)
      });
    }
  });

  const membershipRole = user?.currentWorkspace?.membership.role ?? null;
  const canGenerate = membershipRole === 'OWNER' || membershipRole === 'MANAGER';
  const view = statementsQuery.data;

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="공식 보고"
        title="재무제표 스냅샷"
        description="잠금된 운영 기간을 기준으로 공식 FinancialStatementSnapshot을 생성하고 조회합니다. Round 8에서는 재산상태표, 월간 손익, 현금흐름 요약, 순자산 변동 요약을 얇게 연결합니다."
      />
      {feedback ? (
        <Alert severity={feedback.severity} variant="outlined">
          {feedback.message}
        </Alert>
      ) : null}

      {periodsQuery.error ? (
        <QueryErrorAlert
          title="잠금된 운영 기간 목록을 불러오지 못했습니다."
          error={periodsQuery.error}
        />
      ) : null}

      {statementsQuery.error ? (
        <QueryErrorAlert
          title="재무제표 스냅샷을 불러오지 못했습니다."
          error={statementsQuery.error}
        />
      ) : null}

      <SectionCard
        title="보고 대상 선택"
        description="공식 재무제표는 잠금된 기간에 대해서만 생성할 수 있습니다."
      >
        <Stack spacing={appLayout.cardGap}>
          <TextField
            select
            label="잠금된 운영 기간"
            value={selectedPeriodId}
            onChange={(event) => {
              setSelectedPeriodId(event.target.value);
              setFeedback(null);
            }}
            helperText={
              lockedPeriods.length > 0
                ? '잠금된 기간을 선택하면 공식 스냅샷을 생성하거나 다시 조회할 수 있습니다.'
                : '아직 잠금된 운영 기간이 없습니다.'
            }
            disabled={lockedPeriods.length === 0}
          >
            {lockedPeriods.map((period) => (
              <MenuItem key={period.id} value={period.id}>
                {period.monthLabel}
              </MenuItem>
            ))}
          </TextField>

          <Alert severity="info" variant="outlined">
            완료한 라운드: `Round 0, 1, 2, 5, 6, 7, 8, 9`
            {' '}| 남은 라운드: `Round 3, 4`
          </Alert>

          <div>
            <Button
              variant="contained"
              color="inherit"
              onClick={async () => {
                if (!selectedPeriod) {
                  return;
                }

                setFeedback(null);

                try {
                  const result = await mutation.mutateAsync(selectedPeriod);
                  setFeedback({
                    severity: 'success',
                    message: `${result.period.monthLabel} 공식 재무제표 스냅샷을 생성했습니다.`
                  });
                } catch (error) {
                  setFeedback({
                    severity: 'error',
                    message:
                      error instanceof Error
                        ? error.message
                        : '재무제표 스냅샷을 생성하지 못했습니다.'
                  });
                }
              }}
              disabled={!selectedPeriod || !canGenerate || mutation.isPending}
            >
              {mutation.isPending ? '스냅샷 생성 중...' : '공식 재무제표 생성'}
            </Button>
          </div>
        </Stack>
      </SectionCard>

      {!selectedPeriod ? (
        <SectionCard
          title="표시할 재무제표가 없습니다"
          description="먼저 월 마감을 완료해 잠금된 운영 기간을 만들어 주세요."
        >
          <Typography variant="body2" color="text.secondary">
            Round 8은 `Round 7`이 완료된 기간 위에서만 동작합니다.
          </Typography>
        </SectionCard>
      ) : view == null || view.snapshots.length === 0 ? (
        <SectionCard
          title="공식 스냅샷이 아직 없습니다"
          description="잠금된 기간은 있지만, 아직 FinancialStatementSnapshot이 생성되지 않았습니다."
        >
          <Typography variant="body2" color="text.secondary">
            {selectedPeriod.monthLabel} 기간에 대해 공식 재무제표 생성을 실행해 주세요.
          </Typography>
        </SectionCard>
      ) : (
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
                    <Typography key={item.label} variant="body2" color="text.secondary">
                      {item.label} 쨌 {formatWon(item.amountWon)}
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
                            {item.label} 쨌 {formatWon(item.amountWon)}
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
                      <Typography key={note} variant="body2" color="text.secondary">
                        {note}
                      </Typography>
                    ))}
                  </Stack>
                ) : null}
              </Stack>
            </SectionCard>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function readStatementKindLabel(statementKind: FinancialStatementKind) {
  switch (statementKind) {
    case 'STATEMENT_OF_FINANCIAL_POSITION':
      return '개인 재산상태표';
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
