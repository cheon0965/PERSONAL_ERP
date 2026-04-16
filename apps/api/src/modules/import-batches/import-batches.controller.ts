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
  CollectImportedRowPreview,
  CollectImportedRowResponse,
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
import { CollectImportedRowUseCase } from './application/use-cases/collect-imported-row.use-case';
import { CreateImportBatchUseCase } from './application/use-cases/create-import-batch.use-case';
import { PreviewImportedRowCollectionUseCase } from './application/use-cases/preview-imported-row-collection.use-case';
import { CollectImportedRowRequestDto } from './dto/collect-imported-row.dto';
import { CreateImportBatchRequestDto } from './dto/create-import-batch.dto';
import { ImportBatchQueryService } from './import-batch-query.service';

@ApiTags('import-batches')
@ApiBearerAuth()
@Controller('import-batches')
export class ImportBatchesController {
  constructor(
    private readonly importBatchQueryService: ImportBatchQueryService,
    private readonly createImportBatchUseCase: CreateImportBatchUseCase,
    private readonly previewImportedRowCollectionUseCase: PreviewImportedRowCollectionUseCase,
    private readonly collectImportedRowUseCase: CollectImportedRowUseCase,
    private readonly securityEvents: SecurityEventLogger
  ) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<ImportBatchItem[]> {
    return this.importBatchQueryService.findAll(user);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') importBatchId: string
  ): Promise<ImportBatchItem> {
    return this.importBatchQueryService.findOne(user, importBatchId);
  }

  @Post()
  async create(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateImportBatchRequestDto
  ): Promise<ImportBatchItem> {
    const workspace = requireCurrentWorkspace(user);

    try {
      const created = await this.createImportBatchUseCase.execute(user, dto);

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

  @Post(':id/rows/:rowId/collect-preview')
  async previewCollectRow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') importBatchId: string,
    @Param('rowId') importedRowId: string,
    @Body() dto: CollectImportedRowRequestDto
  ): Promise<CollectImportedRowPreview> {
    return this.previewImportedRowCollectionUseCase.execute(
      user,
      importBatchId,
      importedRowId,
      dto
    );
  }

  @Post(':id/rows/:rowId/collect')
  async collectRow(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') importBatchId: string,
    @Param('rowId') importedRowId: string,
    @Body() dto: CollectImportedRowRequestDto
  ): Promise<CollectImportedRowResponse> {
    const workspace = requireCurrentWorkspace(user);

    try {
      const created = await this.collectImportedRowUseCase.execute(
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
          collectedTransactionId: created.collectedTransaction.id
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
