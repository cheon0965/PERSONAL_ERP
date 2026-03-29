import { Injectable } from '@nestjs/common';
import type {
  AccountSubjectItem,
  AuthenticatedUser
} from '@personal-erp/contracts';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { mapAccountSubjectRecordToItem } from './account-subject.mapper';

@Injectable()
export class AccountSubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthenticatedUser): Promise<AccountSubjectItem[]> {
    const workspace = requireCurrentWorkspace(user);
    const accountSubjects = await this.prisma.accountSubject.findMany({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        isActive: true
      },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }]
    });

    return accountSubjects.map(mapAccountSubjectRecordToItem);
  }
}
