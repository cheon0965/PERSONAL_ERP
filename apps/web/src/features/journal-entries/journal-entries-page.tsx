'use client';

import * as React from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Stack } from '@mui/material';
import type { JournalEntryItem } from '@personal-erp/contracts';
import { useRouter } from 'next/navigation';
import {
  accountingPeriodsQueryKey,
  currentAccountingPeriodQueryKey,
  getAccountingPeriods,
  getCurrentAccountingPeriod
} from '@/features/accounting-periods/accounting-periods.api';
import {
  readLatestJournalWritableAccountingPeriods,
  resolvePreferredAccountingPeriod
} from '@/features/accounting-periods/accounting-period-selection';
import { formatWon } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { useAppNotification } from '@/shared/providers/notification-provider';
import {
  FeedbackAlert,
  type FeedbackAlertValue
} from '@/shared/ui/feedback-alert';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import {
  JournalEntryAdjustmentDialog,
  type JournalEntryAdjustmentMode
} from './journal-entry-adjustment-dialog';
import {
  buildJournalEntryColumns,
  JournalEntriesWorkspace,
  type JournalEntriesTableFilterOptions,
  type JournalEntriesTableFilters
} from './journal-entries-page.sections';
import {
  getJournalEntries,
  journalEntriesQueryKey
} from './journal-entries.api';

type SubmitFeedback = FeedbackAlertValue;

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
  const { notifySuccess } = useAppNotification();
  const [feedback, setFeedback] = React.useState<SubmitFeedback>(null);
  const [selectedAdjustment, setSelectedAdjustment] =
    React.useState<AdjustmentSelection>(null);
  const [tableFilters, setTableFilters] =
    React.useState<JournalEntriesTableFilters>({
      keyword: '',
      status: '',
      sourceKind: '',
      dateFrom: '',
      dateTo: ''
    });
  const journalEntriesQuery = useQuery({
    queryKey: journalEntriesQueryKey,
    queryFn: getJournalEntries
  });
  const currentPeriodQuery = useQuery({
    queryKey: currentAccountingPeriodQueryKey,
    queryFn: getCurrentAccountingPeriod
  });
  const accountingPeriodsQuery = useQuery({
    queryKey: accountingPeriodsQueryKey,
    queryFn: getAccountingPeriods
  });

  const rawEntries = journalEntriesQuery.data ?? [];
  const filterOptions = React.useMemo<JournalEntriesTableFilterOptions>(
    () => ({
      statuses: readUniqueSortedValues(rawEntries.map((entry) => entry.status)),
      sourceKinds: readUniqueSortedValues(
        rawEntries.map((entry) => entry.sourceKind)
      )
    }),
    [rawEntries]
  );
  const filteredEntries = React.useMemo(
    () => filterJournalEntries(rawEntries, tableFilters),
    [rawEntries, tableFilters]
  );
  const entries = filteredEntries;

  const currentPeriod = currentPeriodQuery.data ?? null;
  const accountingPeriods = accountingPeriodsQuery.data ?? [];
  const journalWritablePeriods = React.useMemo(
    () => readLatestJournalWritableAccountingPeriods(accountingPeriods),
    [accountingPeriods]
  );
  const adjustmentPeriod = React.useMemo(
    () =>
      resolvePreferredAccountingPeriod(currentPeriod, journalWritablePeriods),
    [currentPeriod, journalWritablePeriods]
  );
  const selectedEntry = React.useMemo(() => {
    if (entries.length === 0) {
      return null;
    }

    if (!highlightedEntryId) {
      return layout === 'list' ? null : (entries[0] ?? null);
    }

    const highlightedEntry =
      entries.find((entry) => entry.id === highlightedEntryId) ?? null;

    if (highlightedEntry) {
      return highlightedEntry;
    }

    return layout === 'detail' ? null : (entries[0] ?? null);
  }, [entries, highlightedEntryId, layout]);
  const selectedEntryCanAdjust =
    selectedEntry?.status === 'POSTED' && Boolean(adjustmentPeriod);
  const isDetailLayout = layout === 'detail';
  const isSplitLayout = layout === 'split';
  const pageTitle = isDetailLayout
    ? selectedEntry
      ? `${selectedEntry.entryNumber} 전표 상세`
      : '전표 상세'
    : '전표 조회';
  const pageDescription = isDetailLayout
    ? '선택한 전표의 라인, 조정 흐름, 후속 조정 작업을 한 화면에서 집중해서 검토합니다.'
    : '전표 목록에서 선택 버튼으로 대상을 고른 뒤 상세 라인과 조정 이력을 검토하는 공식 회계 확인 화면입니다.';

  const journalEntryColumns = React.useMemo(
    () =>
      buildJournalEntryColumns({
        selectedEntryId: selectedEntry?.id
      }),
    [selectedEntry?.id]
  );

  useDomainHelp(buildJournalEntriesHelpContext(isDetailLayout));

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
                  label: entries.length > 0 ? '전표 선택 전' : '전표 없음',
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

        <FeedbackAlert feedback={feedback} />
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
        {accountingPeriodsQuery.error ? (
          <QueryErrorAlert
            title="운영 기간 목록을 불러오지 못했습니다."
            error={accountingPeriodsQuery.error}
          />
        ) : null}

        {adjustmentPeriod ? (
          <Alert severity="info" variant="outlined">
            {currentPeriod && currentPeriod.id !== adjustmentPeriod.id
              ? `현재 운영 기준 월은 ${currentPeriod.monthLabel}이고, 조정 전표 기본 입력 월은 ${adjustmentPeriod.monthLabel}입니다.`
              : `조정 전표 기본 입력 월은 ${adjustmentPeriod.monthLabel}입니다.`}{' '}
            반전/정정 전표는 최신 전표 입력 가능월의 일자로만 생성할 수
            있습니다.
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
            전표 입력 가능한 운영 기간이 없어 반전/정정 전표 버튼이 잠겨
            있습니다.
          </Alert>
        )}

        <JournalEntriesWorkspace
          adjustmentPeriod={adjustmentPeriod}
          entries={entries}
          isDetailLayout={isDetailLayout}
          isSplitLayout={isSplitLayout}
          selectedEntry={selectedEntry}
          journalEntryColumns={journalEntryColumns}
          filters={tableFilters}
          filterOptions={filterOptions}
          totalCount={rawEntries.length}
          onFiltersChange={setTableFilters}
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
        adjustmentPeriod={adjustmentPeriod}
        journalWritablePeriods={journalWritablePeriods}
        onClose={() => setSelectedAdjustment(null)}
        onCompleted={(createdEntry, mode) => {
          notifySuccess(
            mode === 'reverse'
              ? `${createdEntry.entryNumber} 반전 전표를 생성했습니다.`
              : `${createdEntry.entryNumber} 정정 전표를 생성했습니다.`
          );
          setSelectedAdjustment(null);
          router.push(`/journal-entries/${createdEntry.id}` as Route);
        }}
      />
    </>
  );
}

function readJournalEntryTotalAmount(entry: JournalEntryItem) {
  return entry.lines.reduce((total, line) => total + line.debitAmount, 0);
}

function filterJournalEntries(
  entries: JournalEntryItem[],
  filters: JournalEntriesTableFilters
) {
  const keyword = normalizeFilterText(filters.keyword);

  return entries.filter((entry) => {
    if (filters.status && entry.status !== filters.status) {
      return false;
    }

    if (filters.sourceKind && entry.sourceKind !== filters.sourceKind) {
      return false;
    }

    if (!isDateWithinRange(entry.entryDate, filters.dateFrom, filters.dateTo)) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    const lineText = entry.lines
      .map((line) =>
        [
          line.accountSubjectCode,
          line.accountSubjectName,
          line.fundingAccountName,
          line.description
        ]
          .filter(Boolean)
          .join(' ')
      )
      .join(' ');
    const haystack = normalizeFilterText(
      [
        entry.entryNumber,
        entry.status,
        entry.sourceKind,
        entry.sourceCollectedTransactionTitle,
        entry.memo,
        lineText
      ]
        .filter(Boolean)
        .join(' ')
    );

    return haystack.includes(keyword);
  });
}

function isDateWithinRange(value: string, dateFrom: string, dateTo: string) {
  const date = value.slice(0, 10);

  if (dateFrom && date < dateFrom) {
    return false;
  }

  if (dateTo && date > dateTo) {
    return false;
  }

  return true;
}

function normalizeFilterText(value: string) {
  return value.trim().toLocaleLowerCase('ko-KR');
}

function readUniqueSortedValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, 'ko-KR')
  );
}

function buildJournalEntriesHelpContext(isDetailLayout: boolean) {
  if (isDetailLayout) {
    return {
      title: '전표 상세 도움말',
      description:
        '이 화면은 선택한 전표의 라인, 조정 흐름, 후속 반전·정정 작업을 한 번에 검토하는 상세 화면입니다.',
      primaryEntity: '전표 상세',
      relatedEntities: ['전표 라인', '조정 전표', '수집 거래', '운영 월'],
      truthSource:
        '월 운영 중 확정된 거래는 반드시 전표로 이어지고, 이후 마감과 보고는 이 전표를 기준으로 진행됩니다.',
      supplementarySections: [
        {
          title: '이 화면에서 진행할 일',
          items: [
            '선택한 전표의 차변과 대변 라인이 의도한 계정과목과 자금수단으로 잡혔는지 확인합니다.',
            '취소가 필요하면 반전 전표를, 금액이나 분류 수정이 필요하면 정정 전표를 생성합니다.',
            '조정 전표가 생기면 원본과 후속 전표 연결이 의도대로 이어졌는지 함께 확인합니다.'
          ]
        },
        {
          title: '이어지는 화면',
          links: [
            {
              title: '전표 조회',
              description:
                '다른 전표를 다시 고르거나 목록 전체 흐름을 확인합니다.',
              href: '/journal-entries',
              actionLabel: '전표 조회 보기'
            },
            {
              title: '수집 거래',
              description:
                '전표의 원본 거래와 전표 준비 전 상태를 다시 확인합니다.',
              href: '/transactions',
              actionLabel: '수집 거래 보기'
            }
          ]
        }
      ],
      readModelNote:
        '전표는 이후 월 마감, 재무제표, 차기 이월의 기준입니다. 확정 후 수정은 원본 삭제가 아니라 조정 전표로 이력을 남깁니다.'
    };
  }

  return {
    title: '전표 조회 도움말',
    description:
      '이 화면은 수집 거래가 전표로 확정된 뒤 공식 회계 라인을 검토하는 목록 중심 화면입니다.',
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
        title: '이 화면에서 진행할 일',
        items: [
          '검색과 기간 필터를 사용해 확인할 전표 범위를 먼저 좁힙니다.',
          '목록에서 전표 번호, 전표 일자, 원본 수집 거래를 먼저 확인합니다.',
          '선택한 전표의 상세 라인과 조정 이력을 검토합니다.',
          '필요하면 상세 화면이나 분할 화면에서 반전·정정 전표 생성까지 이어서 진행합니다.'
        ]
      },
      {
        title: '문제가 있을 때 확인',
        items: [
          '반전/정정 버튼은 현재 열린 운영 기간이 있어야 사용할 수 있습니다.',
          'POSTED 상태 전표만 추가 조정 대상으로 봅니다.',
          '아직 전표가 없다면 수집 거래 또는 계획 항목 화면에서 전표 준비 거래를 먼저 확정합니다.'
        ]
      },
      {
        title: '이어지는 화면',
        links: [
          {
            title: '수집 거래',
            description:
              '전표가 아직 없는 실제 거래 후보를 보완하고 확정합니다.',
            href: '/transactions',
            actionLabel: '수집 거래 보기'
          },
          {
            title: '재무제표 생성 / 선택',
            description:
              '잠금 월의 공식 보고 숫자에 전표가 어떻게 반영됐는지 확인합니다.',
            href: '/financial-statements',
            actionLabel: '재무제표 보기'
          },
          {
            title: '월 마감',
            description:
              '전표 조정 후 마감 차단 사유가 남아 있는지 운영 기준으로 확인합니다.',
            href: '/operations/month-end',
            actionLabel: '월 마감 보기'
          }
        ]
      }
    ],
    readModelNote:
      '전표 조회는 공식 회계 확인 화면입니다. 운영 참고 화면보다 우선하는 확정 기준으로 읽어야 합니다.'
  };
}
