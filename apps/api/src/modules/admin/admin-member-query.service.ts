import { Injectable } from '@nestjs/common';
import type { AdminMemberItem } from '@personal-erp/contracts';
import type { RequiredWorkspaceContext } from '../../common/auth/required-workspace.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { mapAdminMemberToItem } from './admin.mapper';

@Injectable()
export class AdminMemberQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(workspace: RequiredWorkspaceContext): Promise<AdminMemberItem[]> {
    const memberships = await this.prisma.tenantMembership.findMany({
      where: {
        tenantId: workspace.tenantId
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            emailVerifiedAt: true
          }
        }
      },
      orderBy: [{ status: 'asc' }, { role: 'asc' }, { joinedAt: 'asc' }]
    });

    return memberships.map(mapAdminMemberToItem);
  }
}
