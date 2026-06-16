export type AppErrorKind =
  | 'validation'
  | 'not_found'
  | 'conflict'
  | 'unauthorized'
  | 'forbidden'
  | 'rate_limited'
  | 'unavailable'
  | 'internal';

export class AppError extends Error {
  constructor(
    readonly kind: AppErrorKind,
    message: string,
    readonly code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function validationError(message: string, code?: string): AppError {
  return new AppError('validation', message, code);
}

export function notFoundError(message: string, code?: string): AppError {
  return new AppError('not_found', message, code);
}

export function conflictError(message: string, code?: string): AppError {
  return new AppError('conflict', message, code);
}

export function unauthorizedError(message: string, code?: string): AppError {
  return new AppError('unauthorized', message, code);
}

export function forbiddenError(message: string, code?: string): AppError {
  return new AppError('forbidden', message, code);
}

export function rateLimitedError(message: string, code?: string): AppError {
  return new AppError('rate_limited', message, code);
}

export function unavailableError(message: string, code?: string): AppError {
  return new AppError('unavailable', message, code);
}

export function internalError(message: string, code?: string): AppError {
  return new AppError('internal', message, code);
}
