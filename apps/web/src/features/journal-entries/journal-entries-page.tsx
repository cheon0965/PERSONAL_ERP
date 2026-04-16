'use client';

import * as React from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Stack } from '@mui/material';
import type { JournalEntryItem } from '@personal-erp/contracts';
import { useRouter } from 'next/navigation';
import {
  currentAccountingPeriodQueryKey,
  getCurrentAccountingPeriod
} from '@/features/accounting-periods/accounting-periods.api';
import { formatWon } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import {
  JournalEntryAdjustmentDialog,
  type JournalEntryAdjustmentMode
} from './journal-entry-adjustment-dialog';
import {
  buildJournalEntryColumns,
  JournalEntriesWorkspace
} from './journal-entries-page.sections';
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

type JournalEntriesLayout = 'list' | 'split' | 'detail';

export function JournalEntriesPage({
  highlightedEntryId = null,
  layout = highlightedEntryId ? 'split' : 'list'
}: {
  highlightedEntryId?: string | null;
  layout?: JournalEntriesLayout;
}) {
  const router = useRouter();
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
  const selectedEntry = React.useMemo(() => {
    if (entries.length === 0) {
      return null;
    }

    if (!highlightedEntryId) {
      return entries[0] ?? null;
    }

    const highlightedEntry =
      entries.find((entry) => entry.id === highlightedEntryId) ?? null;

    if (highlightedEntry) {
      return highlightedEntry;
    }

    return layout === 'detail' ? null : (entries[0] ?? null);
  }, [entries, highlightedEntryId, layout]);
  const selectedEntryCanAdjust =
    selectedEntry?.status === 'POSTED' && Boolean(currentPeriod);
  const isDetailLayout = layout === 'detail';
  const isSplitLayout = layout === 'split';
  const pageTitle = isDetailLayout
    ? selectedEntry
      ? `${selectedEntry.entryNumber} 전표 상세`
      : '전표 상세'
    : '전표 조회';
  const pageDescription = isDetailLayout
    ? '선택한 전표의 라인, 조정 계보, 후속 조정 액션을 한 화면에서 집중해서 검토합니다.'
    : '전표 목록에서 대상을 고른 뒤 상세 라인과 조정 이력을 검토하는 공식 회계 확인 화면입니다.';

  const journalEntryColumns = React.useMemo(
    () =>
      buildJournalEntryColumns({
        selectedEntryId: selectedEntry?.id
      }),
    [selectedEntry?.id]
  );

  useDomainHelp({
    title: '전표 조회 사용 가이드',
    description:
      '이 화면은 수집 거래가 전표로 확정된 뒤 공식 회계 라인을 검토하는 곳입니다. 이미 확정된 내용을 되돌리거나 고쳐야 할 때도 삭제 대신 반전 전표 또는 정정 전표를 만듭니다.',
    primaryEntity: '전표',
    relatedEntities: [
      '전표 라인',
      '수집 거래',
      '계정과목',
      '입출금 계정',
      '운영 월'
    ],
    truthSource:
      '월 운영 중 확정된 거래는 반드시 전표로 이어지고, 이후 마감과 보고는 이 전표를 기준으로 진행됩니다.',
    supplementarySections: [
      {
        title: '바로 쓰는 순서',
        items: [
          '목록에서 전표 번호, 전표 일자, 원본 수집 거래를 확인합니다.',
          '선택한 전표 상세에서 차변과 대변 라인이 의도한 계정과목과 자금수단으로 잡혔는지 확인합니다.',
          '거래를 취소해야 하면 반전 전표를 생성합니다.',
          '분류나 금액을 바로잡아야 하면 정정 전표를 생성합니다.',
          '조정 전표가 생기면 조정 계보에서 원본과 후속 전표 연결을 확인합니다.'
        ]
      },
      {
        title: '막히면 확인',
        items: [
          '반전/정정 버튼은 현재 열린 운영 기간이 있어야 사용할 수 있습니다.',
          'POSTED 상태 전표만 추가 조정 대상으로 봅니다.',
          '아직 전표가 없다면 수집 거래 또는 계획 항목 화면에서 전표 준비 거래를 먼저 확정합니다.'
        ]
      }
    ],
    readModelNote:
      '전표는 이후 월 마감, 재무제표, 차기 이월의 기준입니다. 확정 후 수정은 원본 삭제가 아니라 조정 전표로 이력을 남깁니다.'
  });

  return (
    <>
      <Stack spacing={appLayout.pageGap}>
        <PageHeader
          eyebrow="전표"
          title={pageTitle}
          description={pageDescription}
          badges={[
            {
              label: currentPeriod?.monthLabel ?? '열린 운영 월 없음',
              color: currentPeriod ? 'primary' : 'warning'
            },
            selectedEntry
              ? {
                  label: selectedEntry.status,
                  color:
                    selectedEntry.status === 'POSTED' ? 'success' : 'default'
                }
              : {
                  label: '전표 없음',
                  color: 'default'
                }
          ]}
          metadata={[
            {
              label: '전표 수',
              value: `${entries.length}건`
            },
            {
              label: isDetailLayout ? '현재 전표' : '선택 전표',
              value: selectedEntry?.entryNumber ?? '-'
            },
            {
              label: '선택 금액',
              value: selectedEntry
                ? formatWon(readJournalEntryTotalAmount(selectedEntry))
                : '-'
            }
          ]}
          primaryActionLabel="정정 전표 생성"
          primaryActionOnClick={() => {
            if (!selectedEntry) {
              return;
            }

            setFeedback(null);
            setSelectedAdjustment({ mode: 'correct', entry: selectedEntry });
          }}
          primaryActionDisabled={!selectedEntryCanAdjust}
          secondaryActionLabel="반전 전표 생성"
          secondaryActionOnClick={() => {
            if (!selectedEntry) {
              return;
            }

            setFeedback(null);
            setSelectedAdjustment({ mode: 'reverse', entry: selectedEntry });
          }}
          secondaryActionDisabled={!selectedEntryCanAdjust}
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
          <Alert
            severity="warning"
            variant="outlined"
            action={
              <Button component={Link} href="/periods" size="small">
                운영 월 확인
              </Button>
            }
          >
            현재 열린 운영 기간이 없어 반전/정정 전표 버튼이 잠겨 있습니다.
          </Alert>
        )}

        <JournalEntriesWorkspace
          currentPeriod={currentPeriod}
          entries={entries}
          isDetailLayout={isDetailLayout}
          isSplitLayout={isSplitLayout}
          selectedEntry={selectedEntry}
          journalEntryColumns={journalEntryColumns}
          onSelectReverse={(entry) => {
            setFeedback(null);
            setSelectedAdjustment({ mode: 'reverse', entry });
          }}
          onSelectCorrect={(entry) => {
            setFeedback(null);
            setSelectedAdjustment({ mode: 'correct', entry });
          }}
        />
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
          router.replace(`/journal-entries/${createdEntry.id}` as Route);
        }}
      />
    </>
  );
}

function readJournalEntryTotalAmount(entry: JournalEntryItem) {
  return entry.lines.reduce((total, line) => total + line.debitAmount, 0);
}
