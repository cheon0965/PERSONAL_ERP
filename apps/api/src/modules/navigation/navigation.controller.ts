import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  AuthenticatedUser,
  NavigationMenuTreeResponse
} from '@personal-erp/contracts';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { NavigationService } from './navigation.service';

@ApiTags('navigation')
@ApiBearerAuth()
@Controller('navigation')
export class NavigationController {
  constructor(private readonly navigationService: NavigationService) {}

  @Get('tree')
  getTree(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<NavigationMenuTreeResponse> {
    return this.navigationService.getAccessibleTree(
      requireCurrentWorkspace(user)
    );
  }
}
