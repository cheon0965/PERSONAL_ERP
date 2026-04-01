import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  AuthenticatedUser,
  CollectedTransactionItem,
  ImportBatchItem
} from '@personal-erp/contracts';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { readAllowedWorkspaceRoles } from '../../common/auth/workspace-action.policy';
import { RequestWithContext } from '../../common/infrastructure/operational/request-context';
import { SecurityEventLogger } from '../../common/infrastructure/operational/security-event.logger';
import {
  logWorkspaceActionDenied,
  logWorkspaceActionSucceeded
} from '../../common/infrastructure/operational/workspace-action.audit';
import { CollectImportedRowRequestDto } from './dto/collect-imported-row.dto';
import { CreateImportBatchRequestDto } from './dto/create-import-batch.dto';
import { ImportBatchesService } from './import-batches.service';
import { ImportedRowCollectionService } from './imported-row-collection.service';

@ApiTags('import-batches')
@ApiBearerAuth()
@Controller('import-batches')
export class ImportBatchesController {
  constructor(
    private readonly importBatchesService: ImportBatchesService,
    private readonly importedRowCollectionService: ImportedRowCollectionService,
    private readonly securityEvents: SecurityEventLogger
  ) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<ImportBatchItem[]> {
    return this.importBatchesService.findAll(user);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') importBatchId: string
  ): Promise<ImportBatchItem> {
    return this.importBatchesService.findOne(user, importBatchId);
  }

  @Post()
  async create(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateImportBatchRequestDto
  ): Promise<ImportBatchItem> {
    const workspace = requireCurrentWorkspace(user);

    try {
      const created = await this.importBatchesService.create(user, dto);

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'import_batch.upload',
        request,
        workspace,
        details: {
          importBatchId: created.id,
          rowCount: created.rowCount,
          parseStatus: created.parseStatus
        }
      });

      return created;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'import_batch.upload',
          request,
          workspace,
          details: {
            requiredRoles: readAllowedWorkspaceRoles(
              'import_batch.upload'
            ).join(','),
            sourceKind: dto.sourceKind
          }
        });
      }

      throw error;
    }
  }

  @Post(':id/rows/:rowId/collect')
  async collectRow(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') importBatchId: string,
    @Param('rowId') importedRowId: string,
    @Body() dto: CollectImportedRowRequestDto
  ): Promise<CollectedTransactionItem> {
    const workspace = requireCurrentWorkspace(user);

    try {
      const created = await this.importedRowCollectionService.collectRow(
        user,
        importBatchId,
        importedRowId,
        dto
      );

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'collected_transaction.create',
        request,
        workspace,
        details: {
          importBatchId,
          importedRowId,
          collectedTransactionId: created.id
        }
      });

      return created;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'collected_transaction.create',
          request,
          workspace,
          details: {
            importBatchId,
            importedRowId,
            requiredRoles: readAllowedWorkspaceRoles(
              'collected_transaction.create'
            ).join(',')
          }
        });
      }

      throw error;
    }
  }
}
