import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class VehiclesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllInWorkspace(tenantId: string, ledgerId: string) {
    return this.prisma.vehicle.findMany({
      where: { tenantId, ledgerId },
      include: { fuelLogs: { orderBy: { filledOn: 'asc' } } },
      orderBy: { createdAt: 'asc' }
    });
  }
}
