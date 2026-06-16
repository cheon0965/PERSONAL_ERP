import {
  ArgumentsHost,
  Catch,
  HttpStatus,
  type ExceptionFilter
} from '@nestjs/common';
import type { Response } from 'express';
import {
  AppError,
  type AppErrorKind
} from '../../application/errors/app-error';

const statusByKind: Record<AppErrorKind, HttpStatus> = {
  validation: HttpStatus.BAD_REQUEST,
  not_found: HttpStatus.NOT_FOUND,
  conflict: HttpStatus.CONFLICT,
  unauthorized: HttpStatus.UNAUTHORIZED,
  forbidden: HttpStatus.FORBIDDEN,
  rate_limited: HttpStatus.TOO_MANY_REQUESTS,
  unavailable: HttpStatus.SERVICE_UNAVAILABLE,
  internal: HttpStatus.INTERNAL_SERVER_ERROR
};

@Catch(AppError)
export class AppErrorExceptionFilter implements ExceptionFilter<AppError> {
  catch(error: AppError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const statusCode = statusByKind[error.kind];

    response.status(statusCode).json({
      statusCode,
      message: error.message,
      error: readHttpErrorLabel(statusCode)
    });
  }
}

function readHttpErrorLabel(statusCode: HttpStatus): string {
  return HttpStatus[statusCode]
    .split('_')
    .map((word) => `${word[0]}${word.slice(1).toLowerCase()}`)
    .join(' ');
}
