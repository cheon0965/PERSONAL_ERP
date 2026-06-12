import type { LoginRequest } from '@personal-erp/contracts';
import { ApplicationService } from '../../../../common/application/application-service.decorator';
import type {
  AuthRequestContext,
  AuthSessionResult
} from '../models/auth.types';
import { AuthCommandPort } from '../ports/auth-command.port';

@ApplicationService()
export class LoginUseCase {
  constructor(private readonly commands: AuthCommandPort) {}

  execute(
    input: LoginRequest,
    context: AuthRequestContext
  ): Promise<AuthSessionResult> {
    return this.commands.login(input, context);
  }
}
