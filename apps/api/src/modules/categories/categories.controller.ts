import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import {
  assertWorkspaceActionAllowed,
  readAllowedWorkspaceRoles
} from '../../common/auth/workspace-action.policy';
import type { RequestWithContext } from '../../common/infrastructure/operational/request-context';
import { SecurityEventLogger } from '../../common/infrastructure/operational/security-event.logger';
import {
  logWorkspaceActionDenied,
  logWorkspaceActionSucceeded
} from '../../common/infrastructure/operational/workspace-action.audit';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('categories')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly securityEvents: SecurityEventLogger
  ) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('includeInactive') includeInactive?: string
  ) {
    return this.categoriesService.findAll(user, {
      includeInactive: readBooleanQueryFlag(includeInactive)
    });
  }

  @Post()
  async create(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCategoryDto
  ) {
    const workspace = requireCurrentWorkspace(user);

    try {
      assertWorkspaceActionAllowed(workspace.membershipRole, 'category.create');

      const created = await this.categoriesService.create(user, dto);

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'category.create',
        request,
        workspace,
        details: {
          categoryId: created.id
        }
      });

      return created;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'category.create',
          request,
          workspace,
          details: {
            requiredRoles: readAllowedWorkspaceRoles('category.create').join(',')
          }
        });
      }

      throw error;
    }
  }

  @Patch(':id')
  async update(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') categoryId: string,
    @Body() dto: UpdateCategoryDto
  ) {
    const workspace = requireCurrentWorkspace(user);

    try {
      assertWorkspaceActionAllowed(workspace.membershipRole, 'category.update');

      const updated = await this.categoriesService.update(user, categoryId, dto);

      if (!updated) {
        throw new NotFoundException('Category not found');
      }

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'category.update',
        request,
        workspace,
        details: {
          categoryId: updated.id
        }
      });

      return updated;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'category.update',
          request,
          workspace,
          details: {
            categoryId,
            requiredRoles: readAllowedWorkspaceRoles('category.update').join(',')
          }
        });
      }

      throw error;
    }
  }
}

function readBooleanQueryFlag(value?: string) {
  if (!value) {
    return false;
  }

  return value === 'true' || value === '1';
}
