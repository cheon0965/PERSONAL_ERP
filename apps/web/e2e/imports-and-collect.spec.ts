import { expect, test } from '@playwright/test';
import type {
  AccountingPeriodItem,
  AuthenticatedUser,
  CategoryItem,
  CollectedTransactionItem,
  CollectImportedRowPreview,
  CollectImportedRowRequest,
  CollectImportedRowResponse,
  CreateImportBatchRequest,
  FundingAccountItem,
  ImportBatchItem,
  ImportedRowAutoPreparationSummary,
  JournalEntryItem,
  ReferenceDataReadinessSummary
} from '@personal-erp/contracts';

const e2eApiRoutePattern = '**/api/**';

function expectNoPageErrors(pageErrors: string[]) {
  expect(pageErrors, pageErrors.join('\n\n')).toEqual([]);
}

function expectNoUnhandledApiRequests(unhandledApiRequests: string[]) {
  expect(unhandledApiRequests, unhandledApiRequests.join('\n\n')).toEqual([]);
}

function buildAutoPreparationSummary(input: {
  type: CollectImportedRowRequest['type'];
  categoryId: string | null;
  categoryName: string | null;
}): ImportedRowAutoPreparationSummary {
  return {
    matchedPlanItemId: null,
    matchedPlanItemTitle: null,
    effectiveCategoryId: input.categoryId,
    effectiveCategoryName: input.categoryName,
    nextWorkflowStatus:
      input.type === 'TRANSFER' ? 'REVIEWED' : 'READY_TO_POST',
    hasDuplicateSourceFingerprint: false,
    allowPlanItemMatch: true,
    decisionReasons: [
      '선택한 자금수단을 기준으로 수집 거래 생성 경로를 확인했습니다.',
      input.categoryName
        ? `"${input.categoryName}" 카테고리를 유지합니다.`
        : '카테고리 자동 보완을 허용합니다.'
    ]
  };
}

function buildPreview(input: {
  row: ImportBatchItem['rows'][number];
  request: CollectImportedRowRequest;
  fundingAccountName: string;
  categoryName: string | null;
}): CollectImportedRowPreview {
  const parsed = input.row.rawPayload.parsed as {
    occurredOn: string;
    title: string;
    amount: number;
  };

  return {
    importedRowId: input.row.id,
    occurredOn: parsed.occurredOn,
    title: parsed.title,
    amountWon: parsed.amount,
    fundingAccountId: input.request.fundingAccountId,
    fundingAccountName: input.fundingAccountName,
    type: input.request.type,
    requestedCategoryId: input.request.categoryId ?? null,
    requestedCategoryName: input.categoryName,
    autoPreparation: buildAutoPreparationSummary({
      type: input.request.type,
      categoryId: input.request.categoryId ?? null,
      categoryName: input.categoryName
    })
  };
}

test('@smoke uploads an import batch, collects it into a transaction, confirms it, and opens the created journal entry', async ({
  page
}) => {
  const pageErrors: string[] = [];
  const unhandledApiRequests: string[] = [];
  let sessionActive = false;
  let collectedTransactions: CollectedTransactionItem[] = [];
  let journalEntries: JournalEntryItem[] = [];

  const currentUser: AuthenticatedUser = {
    id: 'user-demo',
    email: 'demo@example.com',
    name: 'Demo User',
    currentWorkspace: {
      tenant: {
        id: 'tenant-demo',
        slug: 'demo-tenant',
        name: 'Demo Workspace',
        status: 'ACTIVE'
      },
      membership: {
        id: 'membership-demo',
        role: 'OWNER',
        status: 'ACTIVE'
      },
      ledger: {
        id: 'ledger-demo',
        name: '사업 장부',
        baseCurrency: 'KRW',
        timezone: 'Asia/Seoul',
        status: 'ACTIVE'
      }
    }
  };

  const currentPeriod: AccountingPeriodItem = {
    id: 'period-demo-current',
    year: 2026,
    month: 4,
    monthLabel: '2026-04',
    startDate: '2026-04-01T00:00:00.000Z',
    endDate: '2026-05-01T00:00:00.000Z',
    status: 'OPEN',
    openedAt: '2026-04-01T00:00:00.000Z',
    lockedAt: null,
    hasOpeningBalanceSnapshot: false,
    openingBalanceSourceKind: null,
    statusHistory: [
      {
        id: 'period-history-demo-open',
        fromStatus: null,
        toStatus: 'OPEN',
        eventType: 'OPEN',
        reason: 'Playwright import test setup',
        actorType: 'TENANT_MEMBERSHIP',
        actorMembershipId: 'membership-demo',
        changedAt: '2026-04-01T00:00:00.000Z'
      }
    ]
  };

  const fundingAccounts: FundingAccountItem[] = [
    {
      id: 'acc-main',
      name: '사업 운영 통장',
      type: 'BANK',
      balanceWon: 2_450_000,
      status: 'ACTIVE'
    }
  ];

  const categories: CategoryItem[] = [
    {
      id: 'cat-materials',
      name: '원재료비',
      kind: 'EXPENSE',
      isActive: true
    },
    {
      id: 'cat-sales',
      name: '매출 입금',
      kind: 'INCOME',
      isActive: true
    }
  ];

  const referenceDataReadiness: ReferenceDataReadinessSummary = {
    status: 'READY',
    currentRole: 'OWNER',
    isReadyForMonthlyOperation: true,
    isReadyForTransactionEntry: true,
    isReadyForImportCollection: true,
    isReadyForRecurringRuleSetup: true,
    missingRequirements: [],
    checks: [
      {
        key: 'funding-accounts',
        label: '자금수단',
        description:
          '수집 거래, 반복 규칙, 업로드 승격에서 실제 자금 흐름 계정으로 선택하는 기준 목록입니다.',
        ready: true,
        count: fundingAccounts.length,
        minimumRequiredCount: 1,
        ownershipScope: 'USER_MANAGED',
        responsibleRoles: ['OWNER', 'MANAGER'],
        inProductEditEnabled: true,
        operatingImpact:
          '없으면 수집 거래 등록과 업로드 행 승격에서 자금수단을 고를 수 없습니다.',
        managementNote:
          '사용자 관리 데이터이며 소유자 또는 관리자가 앱 안에서 직접 생성, 이름 수정, 활성 상태 관리를 진행할 수 있습니다.'
      },
      {
        key: 'income-categories',
        label: '수입 카테고리',
        description:
          '수입 거래를 계획 항목, 수집 거래, 업로드 자동 판정에서 분류할 때 쓰는 기준 목록입니다.',
        ready: true,
        count: 1,
        minimumRequiredCount: 1,
        ownershipScope: 'USER_MANAGED',
        responsibleRoles: ['OWNER', 'MANAGER'],
        inProductEditEnabled: true,
        operatingImpact:
          '없으면 수입 흐름을 계획/수집 단계에서 안정적으로 분류하기 어렵습니다.',
        managementNote:
          '사용자 관리 데이터이며 소유자 또는 관리자가 앱 안에서 직접 생성, 이름 수정, 활성 상태 관리를 진행할 수 있습니다.'
      },
      {
        key: 'expense-categories',
        label: '지출 카테고리',
        description:
          '지출 거래를 계획 항목, 수집 거래, 업로드 자동 판정에서 분류할 때 쓰는 기준 목록입니다.',
        ready: true,
        count: 1,
        minimumRequiredCount: 1,
        ownershipScope: 'USER_MANAGED',
        responsibleRoles: ['OWNER', 'MANAGER'],
        inProductEditEnabled: true,
        operatingImpact:
          '없으면 지출 흐름을 계획/수집 단계에서 안정적으로 분류하기 어렵습니다.',
        managementNote:
          '사용자 관리 데이터이며 소유자 또는 관리자가 앱 안에서 직접 생성, 이름 수정, 활성 상태 관리를 진행할 수 있습니다.'
      }
    ]
  };

  let importBatches: ImportBatchItem[] = [
    {
      id: 'import-batch-seeded',
      sourceKind: 'MANUAL_UPLOAD',
      fileName: 'seeded-batch.csv',
      fileHash: 'hash-seeded',
      rowCount: 1,
      parseStatus: 'COMPLETED',
      uploadedAt: '2026-04-01T09:00:00.000Z',
      parsedRowCount: 1,
      failedRowCount: 0,
      rows: [
        {
          id: 'imported-row-seeded-1',
          rowNumber: 2,
          parseStatus: 'PARSED',
          parseError: null,
          sourceFingerprint: 'sf:v1:seeded-1',
          createdCollectedTransactionId: null,
          collectionSummary: null,
          rawPayload: {
            original: {
              date: '2026-04-01',
              title: 'Seeded row',
              amount: '12000'
            },
            parsed: {
              occurredOn: '2026-04-01',
              title: 'Seeded row',
              amount: 12_000
            }
          }
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
        body: JSON.stringify({ status: 'logged_out' })
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

    if (path === '/api/funding-accounts' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fundingAccounts)
      });
      return;
    }

    if (path === '/api/categories' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(categories)
      });
      return;
    }

    if (
      path === '/api/reference-data/readiness' &&
      request.method() === 'GET'
    ) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(referenceDataReadiness)
      });
      return;
    }

    if (path === '/api/import-batches' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(importBatches)
      });
      return;
    }

    if (path === '/api/import-batches' && request.method() === 'POST') {
      const payload = request.postDataJSON() as CreateImportBatchRequest;
      const createdBatch: ImportBatchItem = {
        id: 'import-batch-e2e-new',
        sourceKind: payload.sourceKind,
        fileName: payload.fileName,
        fileHash: 'hash-import-batch-e2e-new',
        rowCount: 1,
        parseStatus: 'COMPLETED',
        uploadedAt: '2026-04-06T09:00:00.000Z',
        parsedRowCount: 1,
        failedRowCount: 0,
        rows: [
          {
            id: 'imported-row-e2e-new-1',
            rowNumber: 2,
            parseStatus: 'PARSED',
            parseError: null,
            sourceFingerprint: 'sf:v1:e2e-new-1',
            createdCollectedTransactionId: null,
            collectionSummary: null,
            rawPayload: {
              original: {
                date: '2026-04-06',
                title: 'Coffee beans',
                amount: '19800'
              },
              parsed: {
                occurredOn: '2026-04-06',
                title: 'Coffee beans',
                amount: 19_800
              }
            }
          }
        ]
      };

      importBatches = [createdBatch, ...importBatches];

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(createdBatch)
      });
      return;
    }

    if (
      /^\/api\/import-batches\/[^/]+\/rows\/[^/]+\/collect-preview$/.test(
        path
      ) &&
      request.method() === 'POST'
    ) {
      const [, , , importBatchId, , importedRowId] = path.split('/');
      const payload = request.postDataJSON() as CollectImportedRowRequest;
      const batch = importBatches.find(
        (candidate) => candidate.id === importBatchId
      );
      const row = batch?.rows.find(
        (candidate) => candidate.id === importedRowId
      );
      const fundingAccountName =
        fundingAccounts.find(
          (candidate) => candidate.id === payload.fundingAccountId
        )?.name ?? '-';
      const categoryName =
        categories.find((candidate) => candidate.id === payload.categoryId)
          ?.name ?? null;

      if (!batch || !row) {
        unhandledApiRequests.push(`${request.method()} ${path}`);
        await route.abort();
        return;
      }

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(
          buildPreview({
            row,
            request: payload,
            fundingAccountName,
            categoryName
          })
        )
      });
      return;
    }

    if (
      /^\/api\/import-batches\/[^/]+\/rows\/[^/]+\/collect$/.test(path) &&
      request.method() === 'POST'
    ) {
      const [, , , importBatchId, , importedRowId] = path.split('/');
      const payload = request.postDataJSON() as CollectImportedRowRequest;
      const batch = importBatches.find(
        (candidate) => candidate.id === importBatchId
      );
      const row = batch?.rows.find(
        (candidate) => candidate.id === importedRowId
      );
      const fundingAccountName =
        fundingAccounts.find(
          (candidate) => candidate.id === payload.fundingAccountId
        )?.name ?? '-';
      const categoryName =
        categories.find((candidate) => candidate.id === payload.categoryId)
          ?.name ?? null;

      if (!batch || !row) {
        unhandledApiRequests.push(`${request.method()} ${path}`);
        await route.abort();
        return;
      }

      const preview = buildPreview({
        row,
        request: payload,
        fundingAccountName,
        categoryName
      });
      const collectedTransaction: CollectedTransactionItem = {
        id: 'txn-import-e2e-1',
        businessDate: preview.occurredOn,
        title: preview.title,
        type: preview.type,
        amountWon: preview.amountWon,
        fundingAccountName: preview.fundingAccountName,
        categoryName: preview.requestedCategoryName ?? '-',
        sourceKind: 'IMPORT',
        postingStatus: preview.autoPreparation.nextWorkflowStatus,
        postedJournalEntryId: null,
        postedJournalEntryNumber: null,
        matchedPlanItemId: preview.autoPreparation.matchedPlanItemId,
        matchedPlanItemTitle: preview.autoPreparation.matchedPlanItemTitle
      };
      const response: CollectImportedRowResponse = {
        collectedTransaction,
        preview
      };

      row.createdCollectedTransactionId = collectedTransaction.id;
      row.collectionSummary = {
        createdCollectedTransactionId: collectedTransaction.id,
        createdCollectedTransactionTitle: collectedTransaction.title,
        createdCollectedTransactionStatus: collectedTransaction.postingStatus,
        autoPreparation: preview.autoPreparation
      };
      collectedTransactions = [collectedTransaction, ...collectedTransactions];

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(response)
      });
      return;
    }

    if (path === '/api/collected-transactions' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(collectedTransactions)
      });
      return;
    }

    if (
      /^\/api\/collected-transactions\/[^/]+\/confirm$/.test(path) &&
      request.method() === 'POST'
    ) {
      const collectedTransactionId = path.split('/')[3] ?? null;
      const targetTransaction =
        collectedTransactions.find(
          (candidate) => candidate.id === collectedTransactionId
        ) ?? null;

      if (!targetTransaction) {
        const requestSignature = `${request.method()} ${path}`;
        unhandledApiRequests.push(requestSignature);
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({
            message: `Unhandled E2E route: ${requestSignature}`
          })
        });
        return;
      }

      const createdJournalEntry: JournalEntryItem = {
        id: 'je-import-e2e-1',
        entryNumber: '202604-0007',
        entryDate: `${targetTransaction.businessDate}T00:00:00.000Z`,
        status: 'POSTED',
        sourceKind: 'COLLECTED_TRANSACTION',
        memo: `${targetTransaction.title} 업로드 확정`,
        sourceCollectedTransactionId: targetTransaction.id,
        sourceCollectedTransactionTitle: targetTransaction.title,
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
            id: 'jel-import-e2e-1',
            lineNumber: 1,
            accountSubjectCode: '5100',
            accountSubjectName: '원재료비',
            fundingAccountName: null,
            debitAmount: targetTransaction.amountWon,
            creditAmount: 0,
            description: targetTransaction.title
          },
          {
            id: 'jel-import-e2e-2',
            lineNumber: 2,
            accountSubjectCode: '1010',
            accountSubjectName: '현금및예금',
            fundingAccountName: targetTransaction.fundingAccountName,
            debitAmount: 0,
            creditAmount: targetTransaction.amountWon,
            description: targetTransaction.title
          }
        ]
      };

      collectedTransactions = collectedTransactions.map((candidate) =>
        candidate.id === targetTransaction.id
          ? {
              ...candidate,
              postingStatus: 'POSTED',
              postedJournalEntryId: createdJournalEntry.id,
              postedJournalEntryNumber: createdJournalEntry.entryNumber
            }
          : candidate
      );
      journalEntries = [createdJournalEntry, ...journalEntries];
      importBatches = importBatches.map((batch) => ({
        ...batch,
        rows: batch.rows.map((row) =>
          row.createdCollectedTransactionId === targetTransaction.id
            ? {
                ...row,
                collectionSummary: row.collectionSummary
                  ? {
                      ...row.collectionSummary,
                      createdCollectedTransactionStatus: 'POSTED'
                    }
                  : row.collectionSummary
              }
            : row
        )
      }));

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(createdJournalEntry)
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

    const requestSignature = `${request.method()} ${path}`;
    unhandledApiRequests.push(requestSignature);
    await route.abort();
  });

  await page.goto('/imports');

  await expect(
    page.getByRole('heading', { name: '워크스페이스에 로그인' })
  ).toBeVisible();
  await page.getByLabel('이메일').fill('demo@example.com');
  await page.getByLabel('비밀번호').fill('Demo1234!');
  await page.getByRole('button', { name: '로그인' }).click();

  await expect(
    page.getByRole('heading', { name: '업로드 배치', exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('gridcell', { name: 'seeded-batch.csv', exact: true })
  ).toBeVisible();

  await page.getByRole('button', { name: '업로드 배치 등록' }).click();
  await expect(
    page.getByRole('heading', { name: '새 업로드 배치' })
  ).toBeVisible();
  await page
    .getByRole('textbox', { name: '파일명', exact: true })
    .fill('e2e-import.csv');
  await page
    .getByLabel('UTF-8 본문')
    .fill('date,title,amount\n2026-04-06,Coffee beans,19800');
  await page.getByRole('button', { name: '배치 생성' }).click();

  await expect(
    page.getByText('e2e-import.csv 업로드를 등록하고 1개 행을 파싱했습니다.')
  ).toBeVisible();
  await expect(
    page.getByRole('gridcell', { name: 'e2e-import.csv', exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('gridcell', { name: 'Coffee beans', exact: true })
  ).toBeVisible();

  await page.getByRole('button', { name: '승격 준비' }).click();
  await expect(page.getByRole('heading', { name: '행 승격' })).toBeVisible();
  await expect(page.getByText('자동 판정 요약')).toBeVisible();
  await expect(
    page.getByText(
      '선택한 자금수단을 기준으로 수집 거래 생성 경로를 확인했습니다.'
    )
  ).toBeVisible();

  await page.getByRole('combobox', { name: '카테고리', exact: true }).click();
  await page.getByRole('option', { name: '원재료비' }).click();
  await expect(
    page.getByText('"원재료비" 카테고리를 유지합니다.')
  ).toBeVisible();
  await page.getByLabel('메모').fill('UTF-8 업로드 승격 확인');
  await page.getByRole('button', { name: '수집 거래로 승격' }).click();

  await expect(
    page.getByText('Coffee beans 행을 수집 거래로 올렸습니다.')
  ).toBeVisible();
  await expect(
    page.locator('a[href="/transactions?transactionId=txn-import-e2e-1"]')
  ).toBeVisible();

  await page
    .locator('a[href="/transactions?transactionId=txn-import-e2e-1"]')
    .click();

  await expect(page).toHaveURL(
    /\/transactions\?transactionId=txn-import-e2e-1$/
  );
  await expect(
    page.getByText('다른 화면에서 연결된 수집 거래 맥락을 열었습니다.')
  ).toBeVisible();
  await expect(
    page.getByRole('gridcell', { name: 'Coffee beans', exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: '전표 확정' }).click();
  await expect(
    page.getByText('202604-0007 전표를 생성하고 수집 거래를 확정했습니다.')
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: '202604-0007', exact: true })
  ).toBeVisible();

  await page.getByRole('link', { name: '202604-0007', exact: true }).click();
  await expect(page).toHaveURL(/\/journal-entries\?entryId=je-import-e2e-1$/);
  await expect(page.getByRole('heading', { name: '전표 조회' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '202604-0007 전표', exact: true })
  ).toBeVisible();
  await expect(
    page.getByText(
      '수집 거래 확정으로 생성된 전표입니다. 원본 거래: Coffee beans'
    )
  ).toBeVisible();
  await expect(page.getByText('원재료비')).toBeVisible();
  await expect(page.getByText('현금및예금')).toBeVisible();

  expectNoPageErrors(pageErrors);
  expectNoUnhandledApiRequests(unhandledApiRequests);
});
