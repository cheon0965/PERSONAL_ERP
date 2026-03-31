'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Box, Button, Divider, Stack, Typography } from '@mui/material';
import type { JournalEntryItem } from '@personal-erp/contracts';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  currentAccountingPeriodQueryKey,
  getCurrentAccountingPeriod
} from '@/features/accounting-periods/accounting-periods.api';
import { formatWon } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import { StatusChip } from '@/shared/ui/status-chip';
import {
  JournalEntryAdjustmentDialog,
  type JournalEntryAdjustmentMode
} from './journal-entry-adjustment-dialog';
import {
  getJournalEntries,
  journalEntriesQueryKey
} from './journal-entries.api';

type SubmitFeedback = {
  severity: 'success' | 'error';
  message: string;
} | null;

type AdjustmentSelection = {
  mode: JournalEntryAdjustmentMode;
  entry: JournalEntryItem;
} | null;

export function JournalEntriesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightedEntryId = searchParams?.get('entryId') ?? null;
  const [feedback, setFeedback] = React.useState<SubmitFeedback>(null);
  const [selectedAdjustment, setSelectedAdjustment] =
    React.useState<AdjustmentSelection>(null);
  const journalEntriesQuery = useQuery({
    queryKey: journalEntriesQueryKey,
    queryFn: getJournalEntries
  });
  const currentPeriodQuery = useQuery({
    queryKey: currentAccountingPeriodQueryKey,
    queryFn: getCurrentAccountingPeriod
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

    return [
      highlighted,
      ...data.filter((item) => item.id !== highlightedEntryId)
    ];
  }, [highlightedEntryId, journalEntriesQuery.data]);

  const currentPeriod = currentPeriodQuery.data ?? null;

  useDomainHelp({
    title: '전표 조회 개요',
    description:
      '전표는 회계적 진실의 단일 원천입니다. 이 화면에서는 확정된 전표 라인을 검토하고, 현재 열린 운영 기간 안에서 필요한 반전 또는 정정 전표를 추가로 생성합니다.',
    primaryEntity: '전표 (JournalEntry)',
    relatedEntities: [
      '전표 라인 (JournalLine)',
      '수집 거래 (CollectedTransaction)',
      '계정과목 (AccountSubject)',
      '자금수단 (FundingAccount)',
      '운영 기간 (AccountingPeriod)'
    ],
    truthSource:
      '월 운영 중 확정된 거래는 반드시 전표로 이어지고, 이후 마감과 보고는 이 전표를 기준으로 진행됩니다.'
  });

  return (
    <>
      <Stack spacing={appLayout.pageGap}>
        <PageHeader
          eyebrow="전표"
          title="전표 조회"
          description="확정된 JournalEntry와 JournalLine을 검토하고, 현재 열린 운영 기간 안에서 반전 전표와 정정 전표를 추가로 생성하는 화면입니다."
        />

        {feedback ? (
          <Alert severity={feedback.severity} variant="outlined">
            {feedback.message}
          </Alert>
        ) : null}
        {currentPeriodQuery.error ? (
          <QueryErrorAlert
            title="현재 운영 기간을 불러오지 못했습니다."
            error={currentPeriodQuery.error}
          />
        ) : null}
        {journalEntriesQuery.error ? (
          <QueryErrorAlert
            title="전표 목록을 불러오지 못했습니다."
            error={journalEntriesQuery.error}
          />
        ) : null}

        {currentPeriod ? (
          <Alert severity="info" variant="outlined">
            현재 열린 운영 기간은 {currentPeriod.monthLabel}이며, 반전/정정
            전표는 이 기간 안의 일자로만 생성할 수 있습니다.
          </Alert>
        ) : (
          <Alert severity="warning" variant="outlined">
            현재 열린 운영 기간이 없어 반전/정정 전표 버튼이 잠겨 있습니다.
          </Alert>
        )}

        {entries.length === 0 ? (
          <SectionCard
            title="최근 전표가 없습니다"
            description="수집 거래를 전표로 확정하면 이 화면에서 최근 전표와 라인을 바로 확인할 수 있습니다."
          >
            <Typography variant="body2" color="text.secondary">
              아직 확정된 전표가 없습니다. 수집 거래 화면에서 보류 상태의 거래를
              선택해 전표 확정을 진행해 주세요.
            </Typography>
          </SectionCard>
        ) : (
          <Stack spacing={appLayout.sectionGap}>
            {entries.map((entry) => {
              const canAdjust =
                entry.status === 'POSTED' && Boolean(currentPeriod);

              return (
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

                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={1}
                      alignItems={{ xs: 'flex-start', md: 'center' }}
                      justifyContent="space-between"
                    >
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={!canAdjust}
                          onClick={() => {
                            setFeedback(null);
                            setSelectedAdjustment({ mode: 'reverse', entry });
                          }}
                        >
                          반전 전표
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          disabled={!canAdjust}
                          onClick={() => {
                            setFeedback(null);
                            setSelectedAdjustment({ mode: 'correct', entry });
                          }}
                        >
                          정정 전표
                        </Button>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {entry.status !== 'POSTED'
                          ? '이미 반전 또는 정정 처리된 전표는 추가 조정 버튼을 숨깁니다.'
                          : currentPeriod
                            ? `${currentPeriod.monthLabel} 운영 기간에 조정 전표를 생성합니다.`
                            : '현재 열린 운영 기간이 없어 조정 전표를 시작할 수 없습니다.'}
                      </Typography>
                    </Stack>

                    {hasAdjustmentMetadata(entry) ? (
                      <Box
                        sx={{
                          px: appLayout.cardPadding,
                          py: { xs: 1.25, md: 1.5 },
                          borderRadius: 2,
                          bgcolor: 'background.default',
                          border: (theme) =>
                            `1px solid ${theme.palette.divider}`
                        }}
                      >
                        <Stack spacing={0.75}>
                          <Typography variant="subtitle2">조정 계보</Typography>
                          {buildAdjustmentMetadataRows(entry).map((row) => (
                            <Typography
                              key={`${entry.id}-${row.label}`}
                              variant="body2"
                              color="text.secondary"
                            >
                              {row.label}: {row.value}
                            </Typography>
                          ))}
                        </Stack>
                      </Box>
                    ) : null}

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
                              {line.lineNumber}. {line.accountSubjectCode}{' '}
                              {line.accountSubjectName}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {line.fundingAccountName
                                ? `자금수단: ${line.fundingAccountName}`
                                : '자금수단 없음'}
                            </Typography>
                            {line.description ? (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                {line.description}
                              </Typography>
                            ) : null}
                          </Stack>
                          <Stack
                            spacing={0.5}
                            alignItems={{ xs: 'flex-start', md: 'flex-end' }}
                          >
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
              );
            })}
          </Stack>
        )}
      </Stack>

      <JournalEntryAdjustmentDialog
        open={selectedAdjustment != null}
        mode={selectedAdjustment?.mode ?? null}
        entry={selectedAdjustment?.entry ?? null}
        currentPeriod={currentPeriod}
        onClose={() => setSelectedAdjustment(null)}
        onCompleted={(createdEntry, mode) => {
          setFeedback({
            severity: 'success',
            message:
              mode === 'reverse'
                ? `${createdEntry.entryNumber} 반전 전표를 생성했습니다.`
                : `${createdEntry.entryNumber} 정정 전표를 생성했습니다.`
          });
          setSelectedAdjustment(null);
          router.replace(`/journal-entries?entryId=${createdEntry.id}`);
        }}
      />
    </>
  );
}

function buildJournalEntryDescription(entry: JournalEntryItem) {
  const sourceDescription =
    entry.sourceKind === 'COLLECTED_TRANSACTION'
      ? '수집 거래 확정으로 생성된 전표입니다.'
      : entry.sourceKind === 'MANUAL_ADJUSTMENT'
        ? '운영 중 반전 또는 정정으로 생성된 조정 전표입니다.'
        : `출처: ${entry.sourceKind}`;

  return [
    sourceDescription,
    entry.sourceCollectedTransactionTitle
      ? `원본 거래: ${entry.sourceCollectedTransactionTitle}`
      : null
  ]
    .filter(Boolean)
    .join(' ');
}

function hasAdjustmentMetadata(entry: JournalEntryItem) {
  return buildAdjustmentMetadataRows(entry).length > 0;
}

function buildAdjustmentMetadataRows(entry: JournalEntryItem) {
  return [
    entry.reversesJournalEntryNumber
      ? {
          label: '반전 원본',
          value: entry.reversesJournalEntryNumber
        }
      : null,
    entry.reversedByJournalEntryNumber
      ? {
          label: '후속 반전 전표',
          value: entry.reversedByJournalEntryNumber
        }
      : null,
    entry.correctsJournalEntryNumber
      ? {
          label: '정정 원본',
          value: entry.correctsJournalEntryNumber
        }
      : null,
    entry.correctionEntryNumbers && entry.correctionEntryNumbers.length > 0
      ? {
          label: '후속 정정 전표',
          value: entry.correctionEntryNumbers.join(', ')
        }
      : null,
    entry.correctionReason
      ? {
          label: '정정 사유',
          value: entry.correctionReason
        }
      : null,
    entry.createdByActorType
      ? {
          label: '생성 주체',
          value:
            entry.createdByActorType === 'TENANT_MEMBERSHIP'
              ? entry.createdByMembershipId
                ? `작업 사용자 (${entry.createdByMembershipId})`
                : '작업 사용자'
              : '시스템'
        }
      : null
  ].filter((row): row is { label: string; value: string } => row != null);
}
