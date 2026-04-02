import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class InsurancePoliciesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveInWorkspace(tenantId: string, ledgerId: string) {
    return this.prisma.insurancePolicy.findMany({
      where: { tenantId, ledgerId, isActive: true },
      orderBy: [{ paymentDay: 'asc' }, { provider: 'asc' }]
    });
  }
}
