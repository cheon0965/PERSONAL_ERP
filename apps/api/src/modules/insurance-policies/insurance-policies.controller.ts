import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { InsurancePoliciesService } from './insurance-policies.service';

@ApiTags('insurance-policies')
@ApiBearerAuth()
@Controller('insurance-policies')
export class InsurancePoliciesController {
  constructor(
    private readonly insurancePoliciesService: InsurancePoliciesService
  ) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.insurancePoliciesService.findAll(user);
  }
}
