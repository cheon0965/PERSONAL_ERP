import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  AuthenticatedUser,
  CarryForwardView
} from '@personal-erp/contracts';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { GenerateCarryForwardUseCase } from './generate-carry-forward.use-case';
import { GenerateCarryForwardRequestDto } from './dto/generate-carry-forward.dto';
import { CarryForwardsService } from './carry-forwards.service';

@ApiTags('carry-forwards')
@ApiBearerAuth()
@Controller('carry-forwards')
export class CarryForwardsController {
  constructor(
    private readonly carryForwardsService: CarryForwardsService,
    private readonly generateCarryForwardUseCase: GenerateCarryForwardUseCase
  ) {}

  @Get()
  findView(
    @CurrentUser() user: AuthenticatedUser,
    @Query('fromPeriodId') fromPeriodId?: string
  ): Promise<CarryForwardView | null> {
    return this.carryForwardsService.findView(user, fromPeriodId);
  }

  @Post('generate')
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: GenerateCarryForwardRequestDto
  ): Promise<CarryForwardView> {
    return this.generateCarryForwardUseCase.execute(user, body);
  }
}
