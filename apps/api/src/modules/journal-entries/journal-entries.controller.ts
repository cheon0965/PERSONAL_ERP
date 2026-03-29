import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser, JournalEntryItem } from '@personal-erp/contracts';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JournalEntriesService } from './journal-entries.service';

@ApiTags('journal-entries')
@ApiBearerAuth()
@Controller('journal-entries')
export class JournalEntriesController {
  constructor(private readonly journalEntriesService: JournalEntriesService) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<JournalEntryItem[]> {
    return this.journalEntriesService.findRecent(user);
  }
}
