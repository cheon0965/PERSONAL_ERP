import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ClockPort } from '../../common/application/ports/clock.port';

type AuthAttemptBucket = {
  count: number;
  resetAt: number;
};

const LOGIN_LIMIT = 5;
const REFRESH_LIMIT = 10;
const REGISTER_LIMIT = 5;
const VERIFY_LIMIT = 10;
const RESEND_LIMIT = 3;
const WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class AuthRateLimitService {
  private readonly buckets = new Map<string, AuthAttemptBucket>();

  constructor(private readonly clock: ClockPort) {}

  assertLoginAttemptAllowed(clientIp: string | undefined, email: string): void {
    this.assertAllowed(
      this.buildLoginKey(clientIp, email),
      LOGIN_LIMIT,
      '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.'
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
      '세션 갱신 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.'
    );
  }

  recordFailedRefreshAttempt(clientIp: string | undefined): void {
    this.recordFailure(this.buildRefreshKey(clientIp));
  }

  clearRefreshAttempts(clientIp: string | undefined): void {
    this.buckets.delete(this.buildRefreshKey(clientIp));
  }

  assertRegisterAttemptAllowed(
    clientIp: string | undefined,
    email: string
  ): void {
    this.assertAllowed(
      this.buildRegisterKey(clientIp, email),
      REGISTER_LIMIT,
      '회원가입 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.'
    );
  }

  recordRegisterAttempt(clientIp: string | undefined, email: string): void {
    this.recordFailure(this.buildRegisterKey(clientIp, email));
  }

  assertVerifyEmailAttemptAllowed(clientIp: string | undefined): void {
    this.assertAllowed(
      this.buildVerifyEmailKey(clientIp),
      VERIFY_LIMIT,
      '이메일 인증 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.'
    );
  }

  recordFailedVerifyEmailAttempt(clientIp: string | undefined): void {
    this.recordFailure(this.buildVerifyEmailKey(clientIp));
  }

  clearVerifyEmailAttempts(clientIp: string | undefined): void {
    this.buckets.delete(this.buildVerifyEmailKey(clientIp));
  }

  assertResendVerificationAttemptAllowed(
    clientIp: string | undefined,
    email: string
  ): void {
    this.assertAllowed(
      this.buildResendVerificationKey(clientIp, email),
      RESEND_LIMIT,
      '인증 메일 재발송 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.'
    );
  }

  recordResendVerificationAttempt(
    clientIp: string | undefined,
    email: string
  ): void {
    this.recordFailure(this.buildResendVerificationKey(clientIp, email));
  }

  private buildLoginKey(clientIp: string | undefined, email: string): string {
    return `login:${this.normalizeClientIp(clientIp)}:${email.trim().toLowerCase()}`;
  }

  private buildRefreshKey(clientIp: string | undefined): string {
    return `refresh:${this.normalizeClientIp(clientIp)}`;
  }

  private buildRegisterKey(
    clientIp: string | undefined,
    email: string
  ): string {
    return `register:${this.normalizeClientIp(clientIp)}:${email.trim().toLowerCase()}`;
  }

  private buildVerifyEmailKey(clientIp: string | undefined): string {
    return `verify-email:${this.normalizeClientIp(clientIp)}`;
  }

  private buildResendVerificationKey(
    clientIp: string | undefined,
    email: string
  ): string {
    return `resend-verification:${this.normalizeClientIp(clientIp)}:${email.trim().toLowerCase()}`;
  }

  private normalizeClientIp(clientIp: string | undefined): string {
    return clientIp?.trim() || 'unknown-client';
  }

  private assertAllowed(key: string, limit: number, message: string): void {
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
