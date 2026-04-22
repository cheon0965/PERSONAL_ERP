import { expect, test } from '@playwright/test';
import type {
  AccountSubjectItem,
  CorrectJournalEntryRequest,
  JournalEntryItem,
  ReverseJournalEntryRequest
} from '@personal-erp/contracts';
import {
  createE2EAccountSubjects,
  createE2ECurrentUser,
  createE2EFundingAccounts
} from '../support/auth-transactions-fixtures';
import {
  buildE2EAccountingPeriod,
  e2eApiRoutePattern,
  expectNoPageErrors,
  expectNoUnhandledApiRequests
} from '../support/auth-transactions-common';

test('@smoke manages journal entry reversal and correction through the journal entries UI', async ({
  page
}) => {
  const pageErrors: string[] = [];
  const unhandledApiRequests: string[] = [];
  const currentUser = createE2ECurrentUser();
  const fundingAccounts = createE2EFundingAccounts();
  const accountSubjects: AccountSubjectItem[] = [
    ...createE2EAccountSubjects(),
    {
      id: 'as-5100',
      code: '5100',
      name: '차량유지비',
      statementType: 'PROFIT_AND_LOSS',
      normalSide: 'DEBIT',
      subjectKind: 'EXPENSE',
      isSystem: true,
      isActive: true
    }
  ];
  const currentPeriod = buildE2EAccountingPeriod({
    id: 'period-2026-05',
    month: '2026-05',
    status: 'OPEN',
    openedAt: '2026-05-01T00:00:00.000Z',
    lockedAt: null,
    hasOpeningBalanceSnapshot: true,
    openingBalanceSourceKind: 'CARRY_FORWARD',
    statusHistory: [
      {
        id: 'period-2026-05-opened',
        fromStatus: null,
        toStatus: 'OPEN',
        eventType: 'OPEN',
        reason: 'Playwright journal entry scenario setup',
        actorType: 'TENANT_MEMBERSHIP',
        actorMembershipId: 'membership-demo',
        changedAt: '2026-05-01T00:00:00.000Z'
      }
    ]
  });
  let sessionActive = false;
  let journalEntries: JournalEntryItem[] = [
    {
      id: 'je-income-1',
      entryNumber: '202605-0001',
      entryDate: '2026-05-03T00:00:00.000Z',
      status: 'POSTED',
      sourceKind: 'COLLECTED_TRANSACTION',
      memo: '5월 스마트스토어 매출',
      sourceCollectedTransactionId: 'txn-income-1',
      sourceCollectedTransactionTitle: '5월 스마트스토어 매출',
      reversesJournalEntryId: null,
      reversesJournalEntryNumber: null,
      reversedByJournalEntryId: null,
      reversedByJournalEntryNumber: null,
      correctsJournalEntryId: null,
      correctsJournalEntryNumber: null,
      correctionEntryIds: [],
      correctionEntryNumbers: [],
      correctionReason: null,
      createdByActorType: 'TENANT_MEMBERSHIP',
      createdByMembershipId: 'membership-demo',
      lines: [
        {
          id: 'je-income-1-line-1',
          lineNumber: 1,
          accountSubjectCode: '1010',
          accountSubjectName: '현금및예금',
          fundingAccountName: '사업 운영 통장',
          debitAmount: 3_200_000,
          creditAmount: 0,
          description: '5월 스마트스토어 매출'
        },
        {
          id: 'je-income-1-line-2',
          lineNumber: 2,
          accountSubjectCode: '4100',
          accountSubjectName: '운영수익',
          fundingAccountName: null,
          debitAmount: 0,
          creditAmount: 3_200_000,
          description: '5월 스마트스토어 매출'
        }
      ]
    },
    {
      id: 'je-expense-1',
      entryNumber: '202605-0002',
      entryDate: '2026-05-04T00:00:00.000Z',
      status: 'POSTED',
      sourceKind: 'COLLECTED_TRANSACTION',
      memo: '배송 차량 주유',
      sourceCollectedTransactionId: 'txn-expense-1',
      sourceCollectedTransactionTitle: '배송 차량 주유',
      reversesJournalEntryId: null,
      reversesJournalEntryNumber: null,
      reversedByJournalEntryId: null,
      reversedByJournalEntryNumber: null,
      correctsJournalEntryId: null,
      correctsJournalEntryNumber: null,
      correctionEntryIds: [],
      correctionEntryNumbers: [],
      correctionReason: null,
      createdByActorType: 'TENANT_MEMBERSHIP',
      createdByMembershipId: 'membership-demo',
      lines: [
        {
          id: 'je-expense-1-line-1',
          lineNumber: 1,
          accountSubjectCode: '5100',
          accountSubjectName: '차량유지비',
          fundingAccountName: null,
          debitAmount: 84_000,
          creditAmount: 0,
          description: '배송 차량 주유'
        },
        {
          id: 'je-expense-1-line-2',
          lineNumber: 2,
          accountSubjectCode: '1010',
          accountSubjectName: '현금및예금',
          fundingAccountName: '비용 예비 통장',
          debitAmount: 0,
          creditAmount: 84_000,
          description: '배송 차량 주유'
        }
      ]
    }
  ];

  page.on('pageerror', (error) => {
    pageErrors.push(error.stack ?? error.message);
  });

  await page.route(e2eApiRoutePattern, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === '/api/auth/login' && request.method() === 'POST') {
      sessionActive = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'playwright-demo-access-token',
          user: currentUser
        })
      });
      return;
    }

    if (path === '/api/auth/refresh' && request.method() === 'POST') {
      if (!sessionActive) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Missing refresh token'
          })
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'playwright-refreshed-access-token',
          user: currentUser
        })
      });
      return;
    }

    if (path === '/api/auth/logout' && request.method() === 'POST') {
      sessionActive = false;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'logged_out'
        })
      });
      return;
    }

    if (path === '/api/navigation/tree' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: []
        })
      });
      return;
    }

    if (
      path === '/api/accounting-periods/current' &&
      request.method() === 'GET'
    ) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(currentPeriod)
      });
      return;
    }

    if (path === '/api/journal-entries' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(journalEntries)
      });
      return;
    }

    if (path === '/api/accounting-periods' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([currentPeriod])
      });
      return;
    }

    if (path === '/api/account-subjects' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(accountSubjects)
      });
      return;
    }

    if (path === '/api/funding-accounts' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fundingAccounts)
      });
      return;
    }

    if (
      /^\/api\/journal-entries\/[^/]+\/reverse$/.test(path) &&
      request.method() === 'POST'
    ) {
      const journalEntryId = path.split('/')[3] ?? '';
      const payload = request.postDataJSON() as ReverseJournalEntryRequest;
      const targetEntry =
        journalEntries.find((entry) => entry.id === journalEntryId) ?? null;

      if (!targetEntry) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({
            message: '전표를 찾지 못했습니다.'
          })
        });
        return;
      }

      const createdEntry: JournalEntryItem = {
        id: 'je-reverse-1',
        entryNumber: '202605-0003',
        entryDate: `${payload.entryDate}T00:00:00.000Z`,
        status: 'POSTED',
        sourceKind: 'MANUAL_ADJUSTMENT',
        memo:
          payload.reason?.trim() || `Reversal of ${targetEntry.entryNumber}`,
        sourceCollectedTransactionId: null,
        sourceCollectedTransactionTitle: null,
        reversesJournalEntryId: targetEntry.id,
        reversesJournalEntryNumber: targetEntry.entryNumber,
        reversedByJournalEntryId: null,
        reversedByJournalEntryNumber: null,
        correctsJournalEntryId: null,
        correctsJournalEntryNumber: null,
        correctionEntryIds: [],
        correctionEntryNumbers: [],
        correctionReason: null,
        createdByActorType: 'TENANT_MEMBERSHIP',
        createdByMembershipId: 'membership-demo',
        lines: targetEntry.lines.map((line, index) => ({
          id: `je-reverse-1-line-${index + 1}`,
          lineNumber: index + 1,
          accountSubjectCode: line.accountSubjectCode,
          accountSubjectName: line.accountSubjectName,
          fundingAccountName: line.fundingAccountName,
          debitAmount: line.creditAmount,
          creditAmount: line.debitAmount,
          description: line.description
        }))
      };
      const updatedTarget: JournalEntryItem = {
        ...targetEntry,
        status: 'REVERSED',
        reversedByJournalEntryId: createdEntry.id,
        reversedByJournalEntryNumber: createdEntry.entryNumber
      };

      journalEntries = [
        createdEntry,
        updatedTarget,
        ...journalEntries.filter((entry) => entry.id !== targetEntry.id)
      ];

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(createdEntry)
      });
      return;
    }

    if (
      /^\/api\/journal-entries\/[^/]+\/correct$/.test(path) &&
      request.method() === 'POST'
    ) {
      const journalEntryId = path.split('/')[3] ?? '';
      const payload = request.postDataJSON() as CorrectJournalEntryRequest;
      const targetEntry =
        journalEntries.find((entry) => entry.id === journalEntryId) ?? null;

      if (!targetEntry) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({
            message: '전표를 찾지 못했습니다.'
          })
        });
        return;
      }

      const createdEntry: JournalEntryItem = {
        id: 'je-correct-1',
        entryNumber: '202605-0004',
        entryDate: `${payload.entryDate}T00:00:00.000Z`,
        status: 'POSTED',
        sourceKind: 'MANUAL_ADJUSTMENT',
        memo: payload.reason,
        sourceCollectedTransactionId: null,
        sourceCollectedTransactionTitle: null,
        reversesJournalEntryId: null,
        reversesJournalEntryNumber: null,
        reversedByJournalEntryId: null,
        reversedByJournalEntryNumber: null,
        correctsJournalEntryId: targetEntry.id,
        correctsJournalEntryNumber: targetEntry.entryNumber,
        correctionEntryIds: [],
        correctionEntryNumbers: [],
        correctionReason: payload.reason,
        createdByActorType: 'TENANT_MEMBERSHIP',
        createdByMembershipId: 'membership-demo',
        lines: payload.lines.map((line, index) => {
          const accountSubject =
            accountSubjects.find(
              (candidate) => candidate.id === line.accountSubjectId
            ) ?? null;
          const fundingAccount =
            line.fundingAccountId == null
              ? null
              : (fundingAccounts.find(
                  (candidate) => candidate.id === line.fundingAccountId
                ) ?? null);

          return {
            id: `je-correct-1-line-${index + 1}`,
            lineNumber: index + 1,
            accountSubjectCode: accountSubject?.code ?? '',
            accountSubjectName: accountSubject?.name ?? '',
            fundingAccountName: fundingAccount?.name ?? null,
            debitAmount: line.debitAmount,
            creditAmount: line.creditAmount,
            description: line.description?.trim() || null
          };
        })
      };
      const updatedTarget: JournalEntryItem = {
        ...targetEntry,
        status: 'SUPERSEDED',
        correctionEntryIds: [
          ...(targetEntry.correctionEntryIds ?? []),
          createdEntry.id
        ],
        correctionEntryNumbers: [
          ...(targetEntry.correctionEntryNumbers ?? []),
          createdEntry.entryNumber
        ]
      };

      journalEntries = [
        createdEntry,
        updatedTarget,
        ...journalEntries.filter((entry) => entry.id !== targetEntry.id)
      ];

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(createdEntry)
      });
      return;
    }

    const requestSignature = `${request.method()} ${path}`;
    unhandledApiRequests.push(requestSignature);

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({
        message: `Unhandled E2E route: ${requestSignature}`
      })
    });
  });

  await page.goto('/journal-entries');
  await expect(
    page.getByRole('heading', { name: '운영 포털 로그인' })
  ).toBeVisible();

  await page.getByLabel('이메일').fill('demo@example.com');
  await page.getByLabel('비밀번호').fill('Demo1234!');
  await page.getByRole('button', { name: '로그인' }).click();

  await expect(page).toHaveURL(/\/journal-entries$/);
  await expect(page.getByRole('heading', { name: '전표 조회' })).toBeVisible();
  await expect(
    page.getByText(/조정 전표 기본 입력 월은 2026-05입니다/)
  ).toBeVisible();

  await page.goto('/journal-entries/je-income-1');
  await expect(page).toHaveURL(/\/journal-entries\/je-income-1$/);
  await expect(
    page.getByRole('heading', { level: 1, name: '202605-0001 전표 상세' })
  ).toBeVisible();
  await page.getByRole('button', { name: '반전 전표 생성' }).click();

  const reverseDialog = page.getByRole('dialog');
  await expect(
    reverseDialog.getByRole('heading', { name: '202605-0001 반전 전표 생성' })
  ).toBeVisible();
  await reverseDialog.getByLabel('반전 전표 일자').fill('2026-05-05');
  await reverseDialog.getByLabel('반전 사유').fill('이중 확정 취소');
  await reverseDialog.getByRole('button', { name: '반전 전표 생성' }).click();

  await expect(
    page.getByText('202605-0003 반전 전표를 생성했습니다.')
  ).toBeVisible();
  await expect(page).toHaveURL(/\/journal-entries\/je-reverse-1$/);
  await expect(page.getByText(/반전 원본:\s*202605-0001/)).toBeVisible();

  await page.goto('/journal-entries/je-income-1');
  await expect(page).toHaveURL(/\/journal-entries\/je-income-1$/);
  await expect(page.getByText(/후속 반전 전표:\s*202605-0003/)).toBeVisible();

  await page.goto('/journal-entries/je-expense-1');
  await expect(page).toHaveURL(/\/journal-entries\/je-expense-1$/);
  await expect(
    page.getByRole('heading', { level: 1, name: '202605-0002 전표 상세' })
  ).toBeVisible();
  await page.getByRole('button', { name: '정정 전표 생성' }).click();

  const correctDialog = page.getByRole('dialog');
  await expect(
    correctDialog.getByRole('heading', { name: '202605-0002 정정 전표 생성' })
  ).toBeVisible();
  await correctDialog.getByLabel('정정 전표 일자').fill('2026-05-06');
  await correctDialog.getByLabel('정정 사유').fill('영수증 재확인');
  await correctDialog.getByLabel('차변').nth(0).fill('95000');
  await correctDialog.getByLabel('대변').nth(1).fill('95000');
  await correctDialog.getByRole('button', { name: '정정 전표 생성' }).click();

  await expect(
    page.getByText('202605-0004 정정 전표를 생성했습니다.')
  ).toBeVisible();
  await expect(page).toHaveURL(/\/journal-entries\/je-correct-1$/);
  await expect(page.getByText(/정정 원본:\s*202605-0002/)).toBeVisible();
  await expect(page.getByText(/정정 사유:\s*영수증 재확인/)).toBeVisible();

  await page.goto('/journal-entries/je-expense-1');
  await expect(page).toHaveURL(/\/journal-entries\/je-expense-1$/);
  await expect(page.getByText(/후속 정정 전표:\s*202605-0004/)).toBeVisible();

  expectNoUnhandledApiRequests(unhandledApiRequests);
  expectNoPageErrors(pageErrors);
});
