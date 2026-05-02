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
const FORGOT_PASSWORD_LIMIT = 3;
const RESET_PASSWORD_LIMIT = 5;
const WINDOW_MS = 15 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;
const MAX_BUCKETS = 10_000;
const TARGET_BUCKETS_AFTER_CAP = 9_000;

@Injectable()
export class AuthRateLimitService {
  private readonly buckets = new Map<string, AuthAttemptBucket>();
  private lastSweepAt = 0;

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

  assertForgotPasswordAllowed(
    clientIp: string | undefined,
    email: string
  ): void {
    this.assertAllowed(
      this.buildForgotPasswordKey(clientIp, email),
      FORGOT_PASSWORD_LIMIT,
      '비밀번호 재설정 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'
    );
  }

  recordForgotPasswordAttempt(
    clientIp: string | undefined,
    email: string
  ): void {
    this.recordFailure(this.buildForgotPasswordKey(clientIp, email));
  }

  assertResetPasswordAllowed(clientIp: string | undefined): void {
    this.assertAllowed(
      this.buildResetPasswordKey(clientIp),
      RESET_PASSWORD_LIMIT,
      '비밀번호 재설정 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.'
    );
  }

  recordFailedResetPasswordAttempt(clientIp: string | undefined): void {
    this.recordFailure(this.buildResetPasswordKey(clientIp));
  }

  clearResetPasswordAttempts(clientIp: string | undefined): void {
    this.buckets.delete(this.buildResetPasswordKey(clientIp));
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

  private buildForgotPasswordKey(
    clientIp: string | undefined,
    email: string
  ): string {
    return `forgot-password:${this.normalizeClientIp(clientIp)}:${email.trim().toLowerCase()}`;
  }

  private buildResetPasswordKey(clientIp: string | undefined): string {
    return `reset-password:${this.normalizeClientIp(clientIp)}`;
  }

  private normalizeClientIp(clientIp: string | undefined): string {
    return clientIp?.trim() || 'unknown-client';
  }

  private assertAllowed(key: string, limit: number, message: string): void {
    const now = this.clock.now().getTime();
    this.sweepExpiredBuckets(now);
    const bucket = this.readBucket(key, now);

    if (bucket.count >= limit) {
      throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private recordFailure(key: string): void {
    const now = this.clock.now().getTime();
    this.sweepExpiredBuckets(now);
    const bucket = this.readBucket(key, now);
    bucket.count += 1;
    this.buckets.set(key, bucket);
    this.enforceBucketCap();
  }

  private readBucket(key: string, now: number): AuthAttemptBucket {
    const current = this.buckets.get(key);

    return !current || current.resetAt <= now
      ? { count: 0, resetAt: now + WINDOW_MS }
      : current;
  }

  private sweepExpiredBuckets(now: number): void {
    if (now - this.lastSweepAt < SWEEP_INTERVAL_MS) {
      return;
    }

    this.lastSweepAt = now;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }

  private enforceBucketCap(): void {
    if (this.buckets.size <= MAX_BUCKETS) {
      return;
    }

    for (const key of this.buckets.keys()) {
      this.buckets.delete(key);
      if (this.buckets.size <= TARGET_BUCKETS_AFTER_CAP) {
        return;
      }
    }
  }
}
