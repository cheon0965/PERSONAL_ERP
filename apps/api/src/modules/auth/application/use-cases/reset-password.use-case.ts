import type {
  ResetPasswordRequest,
  ResetPasswordResponse
} from '@personal-erp/contracts';
import { ApplicationService } from '../../../../common/application/application-service.decorator';
import type { AuthRequestContext } from '../models/auth.types';
import { AuthCommandPort } from '../ports/auth-command.port';

@ApplicationService()
export class ResetPasswordUseCase {
  constructor(private readonly commands: AuthCommandPort) {}

  execute(
    input: ResetPasswordRequest,
    context: AuthRequestContext
  ): Promise<ResetPasswordResponse> {
    return this.commands.resetPassword(input, context);
  }
}
