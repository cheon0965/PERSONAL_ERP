import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

type AuthenticatedRequest = Request & {
  authSessionId?: string;
};

export const CurrentSessionId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.authSessionId;
  }
);
