import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllByUserId(userId: string) {
    return this.prisma.category.findMany({
      where: { userId },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }]
    });
  }
}
