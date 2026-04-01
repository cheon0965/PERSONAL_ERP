import { Injectable, Logger } from '@nestjs/common';

type SecurityEventDetails = Record<
  string,
  string | number | boolean | undefined | null
>;

type SecurityLogLevel = 'log' | 'warn' | 'error';

@Injectable()
export class SecurityEventLogger {
  private readonly logger = new Logger('SecurityEvent');

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
  }
}

function normalizeDetailValue(value: string | number | boolean): string {
  return String(value).replace(/\s+/g, '_');
}
