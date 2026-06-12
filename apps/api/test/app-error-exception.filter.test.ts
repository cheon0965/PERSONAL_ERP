import assert from 'node:assert/strict';
import test from 'node:test';
import type { ArgumentsHost } from '@nestjs/common';
import {
  AppError,
  type AppErrorKind
} from '../src/common/application/errors/app-error';
import { AppErrorExceptionFilter } from '../src/common/infrastructure/http/app-error-exception.filter';

const expectedStatusByKind: Record<AppErrorKind, number> = {
  validation: 400,
  not_found: 404,
  conflict: 409,
  unauthorized: 401,
  forbidden: 403,
  rate_limited: 429,
  unavailable: 503,
  internal: 500
};

for (const [kind, expectedStatus] of Object.entries(
  expectedStatusByKind
) as Array<[AppErrorKind, number]>) {
  test(`AppErrorExceptionFilter maps ${kind} to ${expectedStatus}`, () => {
    let statusCode = 0;
    let body: unknown;
    const response = {
      status(value: number) {
        statusCode = value;
        return this;
      },
      json(value: unknown) {
        body = value;
      }
    };
    const host = {
      switchToHttp: () => ({
        getResponse: () => response
      })
    } as unknown as ArgumentsHost;

    new AppErrorExceptionFilter().catch(
      new AppError(kind, `${kind} message`),
      host
    );

    assert.equal(statusCode, expectedStatus);
    assert.deepEqual(body, {
      statusCode: expectedStatus,
      message: `${kind} message`,
      error: readExpectedHttpErrorLabel(expectedStatus)
    });
  });
}

function readExpectedHttpErrorLabel(statusCode: number): string {
  return (
    (
      {
        400: 'Bad Request',
        401: 'Unauthorized',
        403: 'Forbidden',
        404: 'Not Found',
        409: 'Conflict',
        429: 'Too Many Requests',
        500: 'Internal Server Error',
        503: 'Service Unavailable'
      } as Record<number, string>
    )[statusCode] ?? 'Internal Server Error'
  );
}
