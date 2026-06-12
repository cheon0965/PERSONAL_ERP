import type {
  ForgotPasswordRequest,
  ForgotPasswordResponse
} from '@personal-erp/contracts';
import { ApplicationService } from '../../../../common/application/application-service.decorator';
import type { AuthRequestContext } from '../models/auth.types';
import { AuthCommandPort } from '../ports/auth-command.port';

export {
  buildPasswordResetUrl,
  formatPasswordResetTtlLabel
} from '../mappers/auth-link-builders';

@ApplicationService()
export class ForgotPasswordUseCase {
  constructor(private readonly commands: AuthCommandPort) {}

  execute(
    input: ForgotPasswordRequest,
    context: AuthRequestContext
  ): Promise<ForgotPasswordResponse> {
    return this.commands.forgotPassword(input, context);
  }
}
