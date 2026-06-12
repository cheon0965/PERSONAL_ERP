import { ApplicationService } from '../../../../common/application/application-service.decorator';
import type {
  AuthRequestContext,
  AuthSessionResult
} from '../models/auth.types';
import { AuthCommandPort } from '../ports/auth-command.port';

@ApplicationService()
export class RefreshSessionUseCase {
  constructor(private readonly commands: AuthCommandPort) {}

  execute(
    refreshToken: string,
    context: AuthRequestContext
  ): Promise<AuthSessionResult> {
    return this.commands.refreshSession(refreshToken, context);
  }
}
