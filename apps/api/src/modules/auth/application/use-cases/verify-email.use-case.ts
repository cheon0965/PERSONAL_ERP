import type {
  VerifyEmailRequest,
  VerifyEmailResponse
} from '@personal-erp/contracts';
import { ApplicationService } from '../../../../common/application/application-service.decorator';
import type { AuthRequestContext } from '../models/auth.types';
import { AuthCommandPort } from '../ports/auth-command.port';

@ApplicationService()
export class VerifyEmailUseCase {
  constructor(private readonly commands: AuthCommandPort) {}

  execute(
    input: VerifyEmailRequest,
    context: AuthRequestContext
  ): Promise<VerifyEmailResponse> {
    return this.commands.verifyEmail(input, context);
  }
}
