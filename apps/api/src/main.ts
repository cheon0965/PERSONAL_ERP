import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApiApp } from './bootstrap/configure-api-app';
import { getApiEnv } from './config/api-env';
import { PrismaConflictExceptionFilter } from './common/prisma/prisma-conflict-exception.filter';
import { PrismaService } from './common/prisma/prisma.service';

async function bootstrap() {
  const env = getApiEnv();
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  configureApiApp(app, env, { logger });
  app.useGlobalFilters(new PrismaConflictExceptionFilter());

  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  await app.listen(env.PORT);
  logger.log(`API running on http://localhost:${env.PORT}/api`);
}

bootstrap();
