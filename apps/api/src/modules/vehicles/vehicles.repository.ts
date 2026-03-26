import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class VehiclesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllByUserId(userId: string) {
    return this.prisma.vehicle.findMany({
      where: { userId },
      include: { fuelLogs: { orderBy: { filledOn: 'asc' } } },
      orderBy: { createdAt: 'asc' }
    });
  }
}
