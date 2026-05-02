import assert from 'node:assert/strict';
import test from 'node:test';
import { formatPasswordResetTtlLabel } from '../src/modules/auth/application/use-cases/forgot-password.use-case';

test('formatPasswordResetTtlLabel formats common password reset windows', () => {
  assert.equal(formatPasswordResetTtlLabel(30 * 60 * 1000), '30분');
  assert.equal(formatPasswordResetTtlLabel(2 * 60 * 60 * 1000), '2시간');
  assert.equal(formatPasswordResetTtlLabel(2 * 24 * 60 * 60 * 1000), '2일');
  assert.equal(formatPasswordResetTtlLabel(45 * 1000), '45초');
});
