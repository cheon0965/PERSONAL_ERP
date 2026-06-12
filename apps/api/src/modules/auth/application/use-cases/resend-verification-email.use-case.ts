import type {
  RegisterResponse,
  ResendVerificationRequest
} from '@personal-erp/contracts';
import { ApplicationService } from '../../../../common/application/application-service.decorator';
import type { AuthRequestContext } from '../models/auth.types';
import { AuthCommandPort } from '../ports/auth-command.port';

@ApplicationService()
export class ResendVerificationEmailUseCase {
  constructor(private readonly commands: AuthCommandPort) {}

  execute(
    input: ResendVerificationRequest,
    context: AuthRequestContext
  ): Promise<RegisterResponse> {
    return this.commands.resendVerificationEmail(input, context);
  }
}
