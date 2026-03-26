import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class InsurancePoliciesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveByUserId(userId: string) {
    return this.prisma.insurancePolicy.findMany({
      where: { userId, isActive: true },
      orderBy: [{ paymentDay: 'asc' }, { provider: 'asc' }]
    });
  }
}
