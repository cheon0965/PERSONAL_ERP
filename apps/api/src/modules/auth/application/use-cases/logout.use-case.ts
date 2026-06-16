import { ApplicationService } from '../../../../common/application/application-service.decorator';
import type { AuthRequestContext } from '../models/auth.types';
import { AuthCommandPort } from '../ports/auth-command.port';

@ApplicationService()
export class LogoutUseCase {
  constructor(private readonly commands: AuthCommandPort) {}

  execute(
    refreshToken: string | undefined,
    context: AuthRequestContext
  ): Promise<void> {
    return this.commands.logout(refreshToken, context);
  }
}
