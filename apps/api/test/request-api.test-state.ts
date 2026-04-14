import * as argon2 from 'argon2';
import {
  createRequestAssetStateFixtures,
  createRequestIdentityStateFixtures,
  createRequestOperationsStateFixtures,
  createRequestReferenceDataStateFixtures
} from './request-api.test-state-fixtures';
import type { RequestTestState } from './request-api.test-types';

const demoPasswordHashPromise = argon2.hash('Demo1234!');

export async function createRequestTestState(): Promise<RequestTestState> {
  const passwordHash = await demoPasswordHashPromise;
  const activeSessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return {
    databaseReady: true,
    failOpeningBalanceSnapshotCreate: false,
    simulateCollectedTransactionAlreadyPostedOnNextTransactionId: null,
    simulateCollectedTransactionAlreadyLinkedOnNextImportClaimId: null,
    ...createRequestIdentityStateFixtures({
      passwordHash,
      activeSessionExpiresAt
    }),
    accountingPeriods: [],
    periodStatusHistory: [],
    openingBalanceSnapshots: [],
    closingSnapshots: [],
    balanceSnapshotLines: [],
    financialStatementSnapshots: [],
    carryForwardRecords: [],
    emailVerificationTokens: [],
    tenantMembershipInvitations: [],
    workspaceAuditEvents: [],
    sentEmails: [],
    importBatches: [],
    importedRows: [],
    ...createRequestReferenceDataStateFixtures(),
    ...createRequestOperationsStateFixtures(),
    ...createRequestAssetStateFixtures()
  };
}
