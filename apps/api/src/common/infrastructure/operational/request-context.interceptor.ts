import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor
} from '@nestjs/common';
import type { Response } from 'express';
import { finalize, type Observable } from 'rxjs';
import { ensureRequestContext, RequestWithContext } from './request-context';

function deriveModuleTag(path: string): string {
  const normalizedPath = path.replace(/^\/+/, '');
  const withoutApiPrefix = normalizedPath.startsWith('api/')
    ? normalizedPath.slice(4)
    : normalizedPath;
  const firstSegment = withoutApiPrefix.split('/')[0];

  return firstSegment || 'root';
}

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  private readonly logger = new Logger('ApiRequest');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<RequestWithContext>();
    const response = context.switchToHttp().getResponse<Response>();
    const requestId = ensureRequestContext(request, response);
    const startedAt = Date.now();
    const path = request.originalUrl ?? request.url;
    const moduleTag = deriveModuleTag(path);

    return next.handle().pipe(
      finalize(() => {
        const durationMs = Date.now() - startedAt;
        this.logger.log(
          `[${moduleTag}] ${request.method} ${path} ${response.statusCode} ${durationMs}ms requestId=${requestId}`
        );
      })
    );
  }
}
