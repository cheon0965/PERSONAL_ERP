import {
  Controller,
  Get,
  Req,
  ServiceUnavailableException
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ClockPort } from '../../common/application/ports/clock.port';
import { Public } from '../../common/auth/public.decorator';
import {
  readRequestId,
  readRequestPath,
  RequestWithContext
} from '../../common/infrastructure/operational/request-context';
import { SecurityEventLogger } from '../../common/infrastructure/operational/security-event.logger';
import { PrismaService } from '../../common/prisma/prisma.service';

@Public()
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly clock: ClockPort,
    private readonly prisma: PrismaService,
    private readonly securityEvents: SecurityEventLogger
  ) {}

  @Get()
  getHealth() {
    return {
      status: 'ok',
      timestamp: this.clock.now().toISOString()
    };
  }

  @Get('ready')
  async getReadiness(@Req() request: RequestWithContext) {
    const timestamp = this.clock.now().toISOString();

    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'ready',
        timestamp,
        checks: {
          database: 'ok'
        }
      };
    } catch {
      this.securityEvents.error('system.readiness_failed', {
        requestId: readRequestId(request),
        path: readRequestPath(request),
        check: 'database'
      });
      throw new ServiceUnavailableException({
        status: 'not_ready',
        timestamp,
        checks: {
          database: 'error'
        }
      });
    }
  }
}
