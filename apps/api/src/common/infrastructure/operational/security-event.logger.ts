import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OperationalAuditPublisher } from './operational-audit-publisher.service';
import type {
  OperationalAuditEventPayload,
  OperationalAuditEventResult
} from './operational-audit-sink.port';

type SecurityEventDetails = Record<
  string,
  string | number | boolean | undefined | null
>;

type SecurityLogLevel = 'log' | 'warn' | 'error';
type SecurityThreatSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type SecurityThreatCategory =
  | 'AUTHENTICATION'
  | 'REGISTRATION'
  | 'SESSION'
  | 'EMAIL_VERIFICATION'
  | 'ACCESS_CONTROL'
  | 'BROWSER_ORIGIN'
  | 'EMAIL_DELIVERY'
  | 'SYSTEM';

@Injectable()
export class SecurityEventLogger {
  private readonly logger = new Logger('SecurityEvent');

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditPublisher: OperationalAuditPublisher
  ) {}

  log(event: string, details: SecurityEventDetails = {}): void {
    this.write('log', event, details);
  }

  warn(event: string, details: SecurityEventDetails = {}): void {
    this.write('warn', event, details);
  }

  error(event: string, details: SecurityEventDetails = {}): void {
    this.write('error', event, details);
  }

  private write(
    level: SecurityLogLevel,
    event: string,
    details: SecurityEventDetails
  ): void {
    const detailText = Object.entries(details)
      .flatMap(([key, value]) => {
        if (value === undefined || value === null || value === '') {
          return [];
        }

        return [`${key}=${normalizeDetailValue(value)}`];
      })
      .join(' ');

    const message = detailText
      ? `event=${event} ${detailText}`
      : `event=${event}`;
    this.logger[level](message);
    this.auditPublisher.publish({
      kind: 'SECURITY_EVENT',
      eventName: event,
      occurredAt: new Date().toISOString(),
      tenantId: readStringDetail(details.tenantId),
      ledgerId: readStringDetail(details.ledgerId),
      actorUserId: readStringDetail(details.userId),
      actorMembershipId: readStringDetail(details.membershipId),
      resourceType: 'security-event',
      resourceId: readStringDetail(details.requestId),
      result: readOperationalAuditResult(level, event),
      payload: buildOperationalAuditPayload(level, details)
    });

    if (shouldPersistThreatEvent(level, event)) {
      void this.persistThreatEvent(level, event, details).catch((error) => {
        this.logger.error(
          `event=security_threat_persist_failed sourceEvent=${event} reason=${normalizeDetailValue(readErrorMessage(error))}`
        );
      });
    }
  }

  private async persistThreatEvent(
    level: SecurityLogLevel,
    eventName: string,
    details: SecurityEventDetails
  ): Promise<void> {
    const clientIp = readStringDetail(details.clientIp);
    const metadata = buildThreatMetadata(details);

    await this.prisma.securityThreatEvent.create({
      data: {
        severity: readThreatSeverity(level, eventName),
        eventCategory: readThreatCategory(eventName),
        eventName,
        source: 'api',
        requestId: readStringDetail(details.requestId),
        path: readStringDetail(details.path),
        clientIpHash: clientIp ? hashSensitiveValue(clientIp) : null,
        userId: readStringDetail(details.userId),
        sessionId: readStringDetail(details.sessionId),
        reason: readStringDetail(details.reason),
        metadata:
          Object.keys(metadata).length > 0
            ? (metadata as Prisma.InputJsonObject)
            : undefined
      }
    });
  }
}

function readOperationalAuditResult(
  level: SecurityLogLevel,
  eventName: string
): OperationalAuditEventResult {
  if (
    eventName === 'audit.action_succeeded' ||
    eventName.endsWith('_succeeded')
  ) {
    return 'SUCCESS';
  }

  if (level === 'error' || eventName.includes('failed')) {
    return 'FAILED';
  }

  if (level === 'warn' || eventName.includes('denied')) {
    return 'DENIED';
  }

  return 'INFO';
}

function buildOperationalAuditPayload(
  level: SecurityLogLevel,
  details: SecurityEventDetails
): OperationalAuditEventPayload {
  return {
    level,
    ...Object.fromEntries(
      Object.entries(details).flatMap(([key, value]) => {
        if (value === undefined) {
          return [];
        }

        return [[key, value]];
      })
    )
  };
}

function normalizeDetailValue(value: string | number | boolean): string {
  return String(value).replace(/\s+/g, '_');
}

function shouldPersistThreatEvent(
  level: SecurityLogLevel,
  eventName: string
): boolean {
  if (level === 'error') {
    return true;
  }

  if (level === 'warn') {
    return true;
  }

  return eventName === 'auth.refresh_reuse_detected';
}

function readThreatSeverity(
  level: SecurityLogLevel,
  eventName: string
): SecurityThreatSeverity {
  if (eventName.includes('refresh_reuse_detected')) {
    return 'CRITICAL';
  }

  if (
    eventName.includes('rate_limited') ||
    eventName.includes('browser_origin_blocked') ||
    eventName.includes('access_denied') ||
    eventName.includes('action_denied') ||
    level === 'error'
  ) {
    return 'HIGH';
  }

  if (
    eventName.includes('login_failed') ||
    eventName.includes('password_change_failed') ||
    eventName.includes('verification_failed') ||
    eventName.includes('invitation_accept_failed')
  ) {
    return 'MEDIUM';
  }

  return 'LOW';
}

function readThreatCategory(eventName: string): SecurityThreatCategory {
  if (eventName.includes('login') || eventName.includes('password')) {
    return 'AUTHENTICATION';
  }

  if (eventName.includes('register')) {
    return 'REGISTRATION';
  }

  if (eventName.includes('refresh') || eventName.includes('session')) {
    return 'SESSION';
  }

  if (
    eventName.includes('verification') ||
    eventName.includes('email_verified')
  ) {
    return 'EMAIL_VERIFICATION';
  }

  if (
    eventName.includes('access_denied') ||
    eventName.includes('authorization')
  ) {
    return 'ACCESS_CONTROL';
  }

  if (eventName.includes('browser_origin')) {
    return 'BROWSER_ORIGIN';
  }

  if (eventName.startsWith('email.') || eventName.includes('email_send')) {
    return 'EMAIL_DELIVERY';
  }

  return 'SYSTEM';
}

function buildThreatMetadata(
  details: SecurityEventDetails
): Record<string, string | number | boolean | null> {
  const reservedKeys = new Set([
    'requestId',
    'path',
    'clientIp',
    'userId',
    'sessionId',
    'reason'
  ]);

  return Object.fromEntries(
    Object.entries(details).flatMap(([key, value]) => {
      if (reservedKeys.has(key) || value === undefined) {
        return [];
      }

      return [[key, value]];
    })
  );
}

function readStringDetail(value: SecurityEventDetails[string]): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return null;
}

function hashSensitiveValue(value: string): string {
  return createHash('sha256').update(value.trim(), 'utf8').digest('hex');
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown';
}
