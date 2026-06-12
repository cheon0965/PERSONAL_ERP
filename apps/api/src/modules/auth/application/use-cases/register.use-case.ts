import type {
  RegisterRequest,
  RegisterResponse
} from '@personal-erp/contracts';
import { ApplicationService } from '../../../../common/application/application-service.decorator';
import type { AuthRequestContext } from '../models/auth.types';
import { AuthCommandPort } from '../ports/auth-command.port';

export { buildVerificationUrl } from '../mappers/auth-link-builders';

@ApplicationService()
export class RegisterUseCase {
  constructor(private readonly commands: AuthCommandPort) {}

  execute(
    input: RegisterRequest,
    context: AuthRequestContext
  ): Promise<RegisterResponse> {
    return this.commands.register(input, context);
  }
}
