import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  AuthenticatedUser,
  GeneratePlanItemsResponse,
  PlanItemsView
} from '@personal-erp/contracts';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { GeneratePlanItemsUseCase } from './generate-plan-items.use-case';
import { GeneratePlanItemsRequestDto } from './dto/generate-plan-items.dto';
import { PlanItemsService } from './plan-items.service';

@ApiTags('plan-items')
@ApiBearerAuth()
@Controller('plan-items')
export class PlanItemsController {
  constructor(
    private readonly planItemsService: PlanItemsService,
    private readonly generatePlanItemsUseCase: GeneratePlanItemsUseCase
  ) {}

  @Get()
  findView(
    @CurrentUser() user: AuthenticatedUser,
    @Query('periodId') periodId?: string
  ): Promise<PlanItemsView | null> {
    return this.planItemsService.findView(user, periodId);
  }

  @Post('generate')
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: GeneratePlanItemsRequestDto
  ): Promise<GeneratePlanItemsResponse> {
    return this.generatePlanItemsUseCase.execute(user, body);
  }
}
