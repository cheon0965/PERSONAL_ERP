import type { UpdateLiabilityAgreementRequest } from '@personal-erp/contracts';
import { CreateLiabilityAgreementDto } from './create-liability-agreement.dto';

export class UpdateLiabilityAgreementDto
  extends CreateLiabilityAgreementDto
  implements UpdateLiabilityAgreementRequest {}
