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
  JournalEntryItem
} from '@personal-erp/contracts';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { readAllowedWorkspaceRoles } from '../../common/auth/workspace-action.policy';
import { OperationalAuditPublisher } from '../../common/infrastructure/operational/operational-audit-publisher.service';
import { RequestWithContext } from '../../common/infrastructure/operational/request-context';
import { SecurityEventLogger } from '../../common/infrastructure/operational/security-event.logger';
import {
  logWorkspaceActionDenied,
  logWorkspaceActionSucceeded
} from '../../common/infrastructure/operational/workspace-action.audit';
import { CorrectJournalEntryRequestDto } from './dto/correct-journal-entry.dto';
import { ReverseJournalEntryRequestDto } from './dto/reverse-journal-entry.dto';
import { CorrectJournalEntryUseCase } from './correct-journal-entry.use-case';
import { JournalEntriesService } from './journal-entries.service';
import { ReverseJournalEntryUseCase } from './reverse-journal-entry.use-case';

@ApiTags('journal-entries')
@ApiBearerAuth()
@Controller('journal-entries')
export class JournalEntriesController {
  constructor(
    private readonly journalEntriesService: JournalEntriesService,
    private readonly reverseJournalEntryUseCase: ReverseJournalEntryUseCase,
    private readonly correctJournalEntryUseCase: CorrectJournalEntryUseCase,
    private readonly securityEvents: SecurityEventLogger,
    private readonly auditPublisher: OperationalAuditPublisher
  ) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<JournalEntryItem[]> {
    return this.journalEntriesService.findRecent(user);
  }

  @Post(':id/reverse')
  async reverse(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') journalEntryId: string,
    @Body() dto: ReverseJournalEntryRequestDto
  ): Promise<JournalEntryItem> {
    const workspace = requireCurrentWorkspace(user);

    try {
      const journalEntry = await this.reverseJournalEntryUseCase.execute(
        user,
        journalEntryId,
        dto
      );

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'journal_entry.reverse',
        request,
        workspace,
        details: {
          journalEntryId,
          adjustmentJournalEntryId: journalEntry.id
        }
      });
      this.auditPublisher.publish({
        kind: 'JOURNAL_ADJUSTMENT',
        eventName: 'journal_entry.reverse',
        occurredAt: new Date().toISOString(),
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        actorUserId: workspace.userId,
        actorMembershipId: workspace.membershipId,
        resourceType: 'journal-entry',
        resourceId: journalEntryId,
        result: 'SUCCESS',
        payload: {
          adjustmentJournalEntryId: journalEntry.id,
          adjustmentEntryNumber: journalEntry.entryNumber
        }
      });

      return journalEntry;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'journal_entry.reverse',
          request,
          workspace,
          details: {
            journalEntryId,
            requiredRoles: readAllowedWorkspaceRoles(
              'journal_entry.reverse'
            ).join(',')
          }
        });
      }

      throw error;
    }
  }

  @Post(':id/correct')
  async correct(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') journalEntryId: string,
    @Body() dto: CorrectJournalEntryRequestDto
  ): Promise<JournalEntryItem> {
    const workspace = requireCurrentWorkspace(user);

    try {
      const journalEntry = await this.correctJournalEntryUseCase.execute(
        user,
        journalEntryId,
        dto
      );

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'journal_entry.correct',
        request,
        workspace,
        details: {
          journalEntryId,
          adjustmentJournalEntryId: journalEntry.id
        }
      });
      this.auditPublisher.publish({
        kind: 'JOURNAL_ADJUSTMENT',
        eventName: 'journal_entry.correct',
        occurredAt: new Date().toISOString(),
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        actorUserId: workspace.userId,
        actorMembershipId: workspace.membershipId,
        resourceType: 'journal-entry',
        resourceId: journalEntryId,
        result: 'SUCCESS',
        payload: {
          adjustmentJournalEntryId: journalEntry.id,
          adjustmentEntryNumber: journalEntry.entryNumber,
          correctionReason: journalEntry.correctionReason ?? null
        }
      });

      return journalEntry;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'journal_entry.correct',
          request,
          workspace,
          details: {
            journalEntryId,
            requiredRoles: readAllowedWorkspaceRoles(
              'journal_entry.correct'
            ).join(',')
          }
        });
      }

      throw error;
    }
  }
}
