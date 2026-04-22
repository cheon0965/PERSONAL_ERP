import { Injectable, Logger } from '@nestjs/common';
import { OperationalAuditSinkPort } from './operational-audit-sink.port';
import type { OperationalAuditSinkEvent } from './operational-audit-sink.port';

@Injectable()
export class OperationalAuditPublisher {
  private readonly logger = new Logger(OperationalAuditPublisher.name);

  constructor(private readonly sink: OperationalAuditSinkPort) {}

  publish(event: OperationalAuditSinkEvent): void {
    void this.sink.publish(event).catch((error) => {
      this.logger.warn(
        `operational_audit_sink_failed kind=${event.kind} eventName=${event.eventName} reason=${readErrorMessage(error)}`
      );
    });
  }
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown';
}
