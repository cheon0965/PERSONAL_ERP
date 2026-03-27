import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ClockPort } from '../../common/application/ports/clock.port';

type AuthAttemptBucket = {
  count: number;
  resetAt: number;
};

const LOGIN_LIMIT = 5;
const REFRESH_LIMIT = 10;
const WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class AuthRateLimitService {
  private readonly buckets = new Map<string, AuthAttemptBucket>();

  constructor(private readonly clock: ClockPort) {}

  assertLoginAttemptAllowed(clientIp: string | undefined, email: string): void {
    this.assertAllowed(
      this.buildLoginKey(clientIp, email),
      LOGIN_LIMIT,
      'Too many sign-in attempts. Try again later.'
    );
  }

  recordFailedLoginAttempt(clientIp: string | undefined, email: string): void {
    this.recordFailure(this.buildLoginKey(clientIp, email));
  }

  clearLoginAttempts(clientIp: string | undefined, email: string): void {
    this.buckets.delete(this.buildLoginKey(clientIp, email));
  }

  assertRefreshAttemptAllowed(clientIp: string | undefined): void {
    this.assertAllowed(
      this.buildRefreshKey(clientIp),
      REFRESH_LIMIT,
      'Too many session refresh attempts. Try again later.'
    );
  }

  recordFailedRefreshAttempt(clientIp: string | undefined): void {
    this.recordFailure(this.buildRefreshKey(clientIp));
  }

  clearRefreshAttempts(clientIp: string | undefined): void {
    this.buckets.delete(this.buildRefreshKey(clientIp));
  }

  private buildLoginKey(clientIp: string | undefined, email: string): string {
    return `login:${this.normalizeClientIp(clientIp)}:${email.trim().toLowerCase()}`;
  }

  private buildRefreshKey(clientIp: string | undefined): string {
    return `refresh:${this.normalizeClientIp(clientIp)}`;
  }

  private normalizeClientIp(clientIp: string | undefined): string {
    return clientIp?.trim() || 'unknown-client';
  }

  private assertAllowed(
    key: string,
    limit: number,
    message: string
  ): void {
    const bucket = this.readBucket(key);

    if (bucket.count >= limit) {
      throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private recordFailure(key: string): void {
    const bucket = this.readBucket(key);
    bucket.count += 1;
    this.buckets.set(key, bucket);
  }

  private readBucket(key: string): AuthAttemptBucket {
    const now = this.clock.now().getTime();
    const current = this.buckets.get(key);

    return !current || current.resetAt <= now
      ? { count: 0, resetAt: now + WINDOW_MS }
      : current;
  }
}
