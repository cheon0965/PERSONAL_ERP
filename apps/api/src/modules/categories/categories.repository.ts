import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllInWorkspace(tenantId: string, ledgerId: string) {
    return this.prisma.category.findMany({
      where: {
        tenantId,
        ledgerId,
        isActive: true
      },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }]
    });
  }
}
