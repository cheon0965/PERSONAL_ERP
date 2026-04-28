import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type {
  AuthenticatedUser,
  BulkCollectImportedRowsResponse,
  CancelImportBatchCollectionResponse,
  CollectImportedRowPreview,
  CollectImportedRowResponse,
  ImportBatchCollectionJobItem,
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
import { BulkCollectImportedRowsUseCase } from './application/use-cases/bulk-collect-imported-rows.use-case';
import { CancelImportBatchCollectionUseCase } from './application/use-cases/cancel-import-batch-collection.use-case';
import { CancelImportBatchCollectionJobUseCase } from './application/use-cases/cancel-import-batch-collection-job.use-case';
import { CreateImportBatchFromFileUseCase } from './application/use-cases/create-import-batch-from-file.use-case';
import { CreateImportBatchUseCase } from './application/use-cases/create-import-batch.use-case';
import { DeleteImportBatchUseCase } from './application/use-cases/delete-import-batch.use-case';
import { GetActiveImportBatchCollectionJobUseCase } from './application/use-cases/get-active-import-batch-collection-job.use-case';
import { GetImportBatchCollectionJobUseCase } from './application/use-cases/get-import-batch-collection-job.use-case';
import { PreviewImportedRowCollectionUseCase } from './application/use-cases/preview-imported-row-collection.use-case';
import { BulkCollectImportedRowsRequestDto } from './dto/bulk-collect-imported-rows.dto';
import { CollectImportedRowRequestDto } from './dto/collect-imported-row.dto';
import { CreateImportBatchFileRequestDto } from './dto/create-import-batch-file.dto';
import { CreateImportBatchRequestDto } from './dto/create-import-batch.dto';
import { ImportBatchQueryService } from './import-batch-query.service';
import { normalizeUploadedFileName } from './uploaded-file-name';

type UploadedImportFile = {
  originalname: string;
  mimetype?: string;
  size: number;
  buffer: Buffer;
};

@ApiTags('import-batches')
@ApiBearerAuth()
@Controller('import-batches')
export class ImportBatchesController {
  constructor(
    private readonly importBatchQueryService: ImportBatchQueryService,
    private readonly createImportBatchUseCase: CreateImportBatchUseCase,
    private readonly createImportBatchFromFileUseCase: CreateImportBatchFromFileUseCase,
    private readonly previewImportedRowCollectionUseCase: PreviewImportedRowCollectionUseCase,
    private readonly collectImportedRowUseCase: CollectImportedRowUseCase,
    private readonly bulkCollectImportedRowsUseCase: BulkCollectImportedRowsUseCase,
    private readonly cancelImportBatchCollectionUseCase: CancelImportBatchCollectionUseCase,
    private readonly cancelImportBatchCollectionJobUseCase: CancelImportBatchCollectionJobUseCase,
    private readonly getImportBatchCollectionJobUseCase: GetImportBatchCollectionJobUseCase,
    private readonly getActiveImportBatchCollectionJobUseCase: GetActiveImportBatchCollectionJobUseCase,
    private readonly deleteImportBatchUseCase: DeleteImportBatchUseCase,
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

  @Post('files')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024
      }
    })
  )
  async createFromFile(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateImportBatchFileRequestDto,
    @UploadedFile() file?: UploadedImportFile
  ): Promise<ImportBatchItem> {
    const workspace = requireCurrentWorkspace(user);

    if (!file) {
      throw new BadRequestException('업로드할 파일을 선택해 주세요.');
    }

    try {
      const created = await this.createImportBatchFromFileUseCase.execute(
        user,
        {
          sourceKind: dto.sourceKind,
          fileName: normalizeUploadedFileName(file.originalname),
          fundingAccountId: dto.fundingAccountId,
          password: dto.password,
          contentType: file.mimetype ?? null,
          buffer: file.buffer
        }
      );

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'import_batch.upload',
        request,
        workspace,
        details: {
          importBatchId: created.id,
          rowCount: created.rowCount,
          parseStatus: created.parseStatus,
          sourceKind: dto.sourceKind,
          fundingAccountId: created.fundingAccountId
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
            sourceKind: dto.sourceKind,
            fundingAccountId: dto.fundingAccountId
          }
        });
      }

      throw error;
    }
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
          parseStatus: created.parseStatus,
          fundingAccountId: created.fundingAccountId
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

  @Post(':id/rows/collect')
  @HttpCode(HttpStatus.ACCEPTED)
  async bulkCollectRows(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') importBatchId: string,
    @Body() dto: BulkCollectImportedRowsRequestDto
  ): Promise<BulkCollectImportedRowsResponse> {
    const workspace = requireCurrentWorkspace(user);

    try {
      const result = await this.bulkCollectImportedRowsUseCase.execute(
        user,
        importBatchId,
        dto
      );

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'collected_transaction.create',
        request,
        workspace,
        details: {
          importBatchId,
          requestedRowCount: result.requestedRowCount,
          jobId: result.id
        }
      });

      return result;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'collected_transaction.create',
          request,
          workspace,
          details: {
            importBatchId,
            requiredRoles: readAllowedWorkspaceRoles(
              'collected_transaction.create'
            ).join(',')
          }
        });
      }

      throw error;
    }
  }

  @Get(':id/collection-jobs/active')
  async findActiveCollectionJob(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') importBatchId: string
  ): Promise<ImportBatchCollectionJobItem | null> {
    return this.getActiveImportBatchCollectionJobUseCase.execute(
      user,
      importBatchId
    );
  }

  @Get(':id/collection-jobs/:jobId')
  async findCollectionJob(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') importBatchId: string,
    @Param('jobId') jobId: string
  ): Promise<ImportBatchCollectionJobItem> {
    return this.getImportBatchCollectionJobUseCase.execute(
      user,
      importBatchId,
      jobId
    );
  }

  @Post(':id/collection-jobs/:jobId/cancel')
  async cancelCollectionJob(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') importBatchId: string,
    @Param('jobId') jobId: string
  ): Promise<ImportBatchCollectionJobItem> {
    const workspace = requireCurrentWorkspace(user);

    try {
      const result = await this.cancelImportBatchCollectionJobUseCase.execute(
        user,
        importBatchId,
        jobId
      );

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'import_batch.cancel',
        request,
        workspace,
        details: {
          importBatchId,
          jobId,
          status: result.status,
          processedRowCount: result.processedRowCount,
          requestedRowCount: result.requestedRowCount
        }
      });

      return result;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'import_batch.cancel',
          request,
          workspace,
          details: {
            importBatchId,
            jobId,
            requiredRoles: readAllowedWorkspaceRoles(
              'import_batch.cancel'
            ).join(',')
          }
        });
      }

      throw error;
    }
  }

  @Post(':id/cancel-collection')
  async cancelCollection(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') importBatchId: string
  ): Promise<CancelImportBatchCollectionResponse> {
    const workspace = requireCurrentWorkspace(user);

    try {
      const result = await this.cancelImportBatchCollectionUseCase.execute(
        user,
        importBatchId
      );

      if (!result) {
        throw new NotFoundException('업로드 배치를 찾을 수 없습니다.');
      }

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'import_batch.cancel',
        request,
        workspace,
        details: {
          importBatchId,
          cancelledTransactionCount: result.cancelledTransactionCount,
          restoredPlanItemCount: result.restoredPlanItemCount,
          restoredLiabilityRepaymentScheduleCount:
            result.restoredLiabilityRepaymentScheduleCount ?? 0
        }
      });

      return result;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'import_batch.cancel',
          request,
          workspace,
          details: {
            importBatchId,
            requiredRoles: readAllowedWorkspaceRoles(
              'import_batch.cancel'
            ).join(',')
          }
        });
      }

      throw error;
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBatch(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') importBatchId: string
  ): Promise<void> {
    const workspace = requireCurrentWorkspace(user);

    try {
      const deleted = await this.deleteImportBatchUseCase.execute(
        user,
        importBatchId
      );

      if (!deleted) {
        throw new NotFoundException('업로드 배치를 찾을 수 없습니다.');
      }

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'import_batch.delete',
        request,
        workspace,
        details: {
          importBatchId
        }
      });
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'import_batch.delete',
          request,
          workspace,
          details: {
            importBatchId,
            requiredRoles: readAllowedWorkspaceRoles(
              'import_batch.delete'
            ).join(',')
          }
        });
      }

      throw error;
    }
  }
}
