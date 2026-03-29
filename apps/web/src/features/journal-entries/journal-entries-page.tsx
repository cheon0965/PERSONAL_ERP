'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Divider, Stack, Typography } from '@mui/material';
import type { JournalEntryItem } from '@personal-erp/contracts';
import { useSearchParams } from 'next/navigation';
import { formatWon } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import { StatusChip } from '@/shared/ui/status-chip';
import {
  getJournalEntries,
  journalEntriesQueryKey
} from './journal-entries.api';

export function JournalEntriesPage() {
  const searchParams = useSearchParams();
  const highlightedEntryId = searchParams?.get('entryId') ?? null;
  const journalEntriesQuery = useQuery({
    queryKey: journalEntriesQueryKey,
    queryFn: getJournalEntries
  });

  const entries = React.useMemo(() => {
    const data = journalEntriesQuery.data ?? [];
    if (!highlightedEntryId) {
      return data;
    }

    const highlighted = data.find((item) => item.id === highlightedEntryId);
    if (!highlighted) {
      return data;
    }

    return [highlighted, ...data.filter((item) => item.id !== highlightedEntryId)];
  }, [highlightedEntryId, journalEntriesQuery.data]);

  useDomainHelp({
    title: '전표 조회 개요',
    description:
      '전표는 회계적 진실의 단일 원천입니다. 이 화면은 확정된 수집 거래가 실제 차변/대변 라인으로 어떻게 기록되었는지 보여주는 최소 조회 흐름입니다.',
    primaryEntity: '전표 (JournalEntry)',
    relatedEntities: [
      '전표 라인 (JournalLine)',
      '수집 거래 (CollectedTransaction)',
      '계정과목 (AccountSubject)',
      '자금수단 (FundingAccount)',
      '운영 기간 (AccountingPeriod)'
    ],
    truthSource: '월 운영 중 확정된 거래는 반드시 전표로 이어지고, 이후 마감과 보고는 이 전표를 기준으로 진행됩니다.'
  });

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="전표"
        title="전표 조회"
        description="수집 거래를 확정해 생성된 JournalEntry와 JournalLine을 확인하는 얇은 조회 화면입니다. 현재 단계에서는 최근 전표를 빠르게 검토하고 라인 구성을 확인하는 데 집중합니다."
      />

      {journalEntriesQuery.error ? (
        <QueryErrorAlert
          title="전표 목록을 불러오지 못했습니다."
          error={journalEntriesQuery.error}
        />
      ) : null}
      {entries.length === 0 ? (
        <SectionCard
          title="최근 전표가 없습니다"
          description="수집 거래를 전표로 확정하면 이 화면에서 최근 전표와 라인을 바로 확인할 수 있습니다."
        >
          <Typography variant="body2" color="text.secondary">
            아직 확정된 전표가 없습니다. 수집 거래 화면에서 보류 상태의 거래를 선택해
            전표 확정을 진행해 주세요.
          </Typography>
        </SectionCard>
      ) : (
        <Stack spacing={appLayout.sectionGap}>
          {entries.map((entry) => (
            <SectionCard
              key={entry.id}
              title={`${entry.entryNumber} 전표`}
              description={buildJournalEntryDescription(entry)}
            >
              <Stack spacing={appLayout.cardGap}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={appLayout.fieldGap}
                  alignItems={{ xs: 'flex-start', md: 'center' }}
                  justifyContent="space-between"
                >
                  <Stack spacing={0.5}>
                    <Typography variant="caption" color="text.secondary">
                      전표 상태
                    </Typography>
                    <div>
                      <StatusChip label={entry.status} />
                    </div>
                  </Stack>
                  <Stack spacing={0.5}>
                    <Typography variant="caption" color="text.secondary">
                      전표 일자
                    </Typography>
                    <Typography variant="body2">
                      {entry.entryDate.slice(0, 10)}
                    </Typography>
                  </Stack>
                  <Stack spacing={0.5}>
                    <Typography variant="caption" color="text.secondary">
                      원본 수집 거래
                    </Typography>
                    <Typography variant="body2">
                      {entry.sourceCollectedTransactionTitle ?? '-'}
                    </Typography>
                  </Stack>
                </Stack>

                {entry.memo ? (
                  <Box
                    sx={{
                      px: appLayout.cardPadding,
                      py: { xs: 1.25, md: 1.5 },
                      borderRadius: 2,
                      bgcolor: 'action.hover'
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {entry.memo}
                    </Typography>
                  </Box>
                ) : null}

                <Stack divider={<Divider flexItem />} spacing={0}>
                  {entry.lines.map((line) => (
                    <Stack
                      key={line.id}
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={appLayout.fieldGap}
                      justifyContent="space-between"
                      sx={{ py: { xs: 1.25, md: 1.5 } }}
                    >
                      <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2">
                          {line.lineNumber}. {line.accountSubjectCode} {line.accountSubjectName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {line.fundingAccountName
                            ? `자금수단: ${line.fundingAccountName}`
                            : '자금수단 없음'}
                        </Typography>
                        {line.description ? (
                          <Typography variant="body2" color="text.secondary">
                            {line.description}
                          </Typography>
                        ) : null}
                      </Stack>
                      <Stack spacing={0.5} alignItems={{ xs: 'flex-start', md: 'flex-end' }}>
                        <Typography variant="body2">
                          차변 {formatWon(line.debitAmount)}
                        </Typography>
                        <Typography variant="body2">
                          대변 {formatWon(line.creditAmount)}
                        </Typography>
                      </Stack>
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            </SectionCard>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function buildJournalEntryDescription(entry: JournalEntryItem) {
  return [
    entry.sourceKind === 'COLLECTED_TRANSACTION'
      ? '수집 거래 확정으로 생성된 전표입니다.'
      : `출처: ${entry.sourceKind}`,
    entry.sourceCollectedTransactionTitle
      ? `원본 거래: ${entry.sourceCollectedTransactionTitle}`
      : null
  ]
    .filter(Boolean)
    .join(' ');
}
