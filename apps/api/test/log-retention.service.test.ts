import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLogRetentionCutoffs,
  LogRetentionService
} from '../src/common/infrastructure/operational/log-retention.service';
import type { ApiEnv } from '../src/config/api-env';

const baseEnv = {
  WORKSPACE_AUDIT_LOG_RETENTION_DAYS: 180,
  SECURITY_THREAT_LOG_RETENTION_DAYS: 365
} satisfies Pick<
  ApiEnv,
  'WORKSPACE_AUDIT_LOG_RETENTION_DAYS' | 'SECURITY_THREAT_LOG_RETENTION_DAYS'
>;

test('buildLogRetentionCutoffs calculates independent audit and security cutoffs', () => {
  const now = new Date('2026-05-02T03:30:00.000Z');
  const cutoffs = buildLogRetentionCutoffs(baseEnv, now);

  assert.equal(cutoffs.auditCutoff.toISOString(), '2025-11-03T03:30:00.000Z');
  assert.equal(
    cutoffs.securityThreatCutoff.toISOString(),
    '2025-05-02T03:30:00.000Z'
  );
});

test('LogRetentionService deletes only rows older than each retention cutoff', async () => {
  const calls: unknown[] = [];
  const prisma = {
    workspaceAuditEvent: {
      deleteMany: (args: unknown) => {
        calls.push({ model: 'workspaceAuditEvent', args });
        return Promise.resolve({ count: 2 });
      }
    },
    securityThreatEvent: {
      deleteMany: (args: unknown) => {
        calls.push({ model: 'securityThreatEvent', args });
        return Promise.resolve({ count: 3 });
      }
    },
    $transaction: async <T>(operations: Array<Promise<T>>) =>
      Promise.all(operations)
  };
  const service = new LogRetentionService(prisma as never);
  const summary = await service.pruneExpiredLogs(
    {
      ...baseEnv
    } as ApiEnv,
    new Date('2026-05-02T03:30:00.000Z')
  );

  assert.equal(summary.workspaceAuditDeletedCount, 2);
  assert.equal(summary.securityThreatDeletedCount, 3);
  assert.deepEqual(calls, [
    {
      model: 'workspaceAuditEvent',
      args: {
        where: {
          occurredAt: {
            lt: new Date('2025-11-03T03:30:00.000Z')
          }
        }
      }
    },
    {
      model: 'securityThreatEvent',
      args: {
        where: {
          occurredAt: {
            lt: new Date('2025-05-02T03:30:00.000Z')
          }
        }
      }
    }
  ]);
});
