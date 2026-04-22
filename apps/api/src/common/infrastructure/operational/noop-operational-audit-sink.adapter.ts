import { Injectable } from '@nestjs/common';
import { OperationalAuditSinkPort } from './operational-audit-sink.port';
import type { OperationalAuditSinkEvent } from './operational-audit-sink.port';

@Injectable()
export class NoopOperationalAuditSinkAdapter extends OperationalAuditSinkPort {
  async publish(_event: OperationalAuditSinkEvent): Promise<void> {
    return undefined;
  }
}
