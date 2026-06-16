import type {
  AcceptInvitationRequest,
  AcceptInvitationResponse
} from '@personal-erp/contracts';
import { ApplicationService } from '../../../../common/application/application-service.decorator';
import type { AuthRequestContext } from '../models/auth.types';
import { AuthCommandPort } from '../ports/auth-command.port';

@ApplicationService()
export class AcceptInvitationUseCase {
  constructor(private readonly commands: AuthCommandPort) {}

  execute(
    input: AcceptInvitationRequest,
    context: AuthRequestContext
  ): Promise<AcceptInvitationResponse> {
    return this.commands.acceptInvitation(input, context);
  }
}
