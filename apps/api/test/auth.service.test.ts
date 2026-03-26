import assert from 'node:assert/strict';
import test from 'node:test';
import * as argon2 from 'argon2';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../src/modules/auth/auth.service';

function setJwtEnv() {
  const previous = {
    PORT: process.env.PORT,
    APP_ORIGIN: process.env.APP_ORIGIN,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL,
    REFRESH_TOKEN_TTL: process.env.REFRESH_TOKEN_TTL,
    DATABASE_URL: process.env.DATABASE_URL,
    DEMO_EMAIL: process.env.DEMO_EMAIL
  };

  process.env.PORT = '4000';
  process.env.APP_ORIGIN = 'http://localhost:3000';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-2';
  process.env.ACCESS_TOKEN_TTL = '15m';
  process.env.REFRESH_TOKEN_TTL = '7d';
  process.env.DATABASE_URL =
    'mysql://test:test@localhost:3306/personal_erp_test';
  process.env.DEMO_EMAIL = 'demo@example.com';

  return () => {
    process.env.PORT = previous.PORT;
    process.env.APP_ORIGIN = previous.APP_ORIGIN;
    process.env.JWT_ACCESS_SECRET = previous.JWT_ACCESS_SECRET;
    process.env.JWT_REFRESH_SECRET = previous.JWT_REFRESH_SECRET;
    process.env.ACCESS_TOKEN_TTL = previous.ACCESS_TOKEN_TTL;
    process.env.REFRESH_TOKEN_TTL = previous.REFRESH_TOKEN_TTL;
    process.env.DATABASE_URL = previous.DATABASE_URL;
    process.env.DEMO_EMAIL = previous.DEMO_EMAIL;
  };
}

test('AuthService.login returns tokens and user for valid credentials', async () => {
  const restoreEnv = setJwtEnv();
  const passwordHash = await argon2.hash('Demo1234!');

  const prisma = {
    user: {
      findUnique: async () => ({
        id: 'user-1',
        email: 'demo@example.com',
        name: 'Demo User',
        passwordHash
      })
    }
  };

  const tokenCalls: Array<{
    payload: Record<string, unknown>;
    secret: string;
  }> = [];
  const jwtService = {
    signAsync: async (
      payload: Record<string, unknown>,
      options: { secret: string }
    ) => {
      tokenCalls.push({ payload, secret: options.secret });
      return options.secret === 'test-access-secret'
        ? 'access-token'
        : 'refresh-token';
    }
  };

  try {
    const service = new AuthService(prisma as never, jwtService as never);

    const result = await service.login({
      email: 'demo@example.com',
      password: 'Demo1234!'
    });

    assert.deepEqual(result, {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        id: 'user-1',
        email: 'demo@example.com',
        name: 'Demo User'
      }
    });
    assert.equal(tokenCalls.length, 2);
    assert.deepEqual(tokenCalls[0], {
      payload: { sub: 'user-1', email: 'demo@example.com' },
      secret: 'test-access-secret'
    });
    assert.deepEqual(tokenCalls[1], {
      payload: { sub: 'user-1' },
      secret: 'test-refresh-secret-2'
    });
  } finally {
    restoreEnv();
  }
});

test('AuthService.login rejects invalid credentials', async () => {
  const restoreEnv = setJwtEnv();
  const passwordHash = await argon2.hash('Demo1234!');

  const prisma = {
    user: {
      findUnique: async () => ({
        id: 'user-1',
        email: 'demo@example.com',
        name: 'Demo User',
        passwordHash
      })
    }
  };

  const jwtService = {
    signAsync: async () => 'unused'
  };

  try {
    const service = new AuthService(prisma as never, jwtService as never);

    await assert.rejects(
      () =>
        service.login({
          email: 'demo@example.com',
          password: 'WrongPassword!'
        }),
      (error: unknown) =>
        error instanceof UnauthorizedException &&
        error.message === 'Invalid credentials'
    );
  } finally {
    restoreEnv();
  }
});
