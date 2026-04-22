import assert from 'node:assert/strict';
import test from 'node:test';
import { OperationalAuditPublisher } from '../src/common/infrastructure/operational/operational-audit-publisher.service';
import { OperationalAuditSinkPort } from '../src/common/infrastructure/operational/operational-audit-sink.port';
import type { OperationalAuditSinkEvent } from '../src/common/infrastructure/operational/operational-audit-sink.port';

class ThrowingOperationalAuditSink extends OperationalAuditSinkPort {
  publishCount = 0;

  async publish(_event: OperationalAuditSinkEvent): Promise<void> {
    this.publishCount += 1;
    throw new Error('central sink unavailable');
  }
}

test('OperationalAuditPublisher does not throw when the external sink fails', async () => {
  const sink = new ThrowingOperationalAuditSink();
  const publisher = new OperationalAuditPublisher(sink);

  assert.doesNotThrow(() => {
    publisher.publish({
      kind: 'WORKSPACE_AUDIT_EVENT',
      eventName: 'audit.action_succeeded',
      occurredAt: new Date('2026-04-22T00:00:00.000Z').toISOString(),
      tenantId: 'tenant-1',
      ledgerId: 'ledger-1',
      actorMembershipId: 'membership-1',
      resourceType: 'import-batch',
      resourceId: 'import-batch-1',
      result: 'SUCCESS',
      payload: {
        action: 'import_batch.upload'
      }
    });
  });

  await new Promise((resolve) => {
    setImmediate(resolve);
  });

  assert.equal(sink.publishCount, 1);
});
