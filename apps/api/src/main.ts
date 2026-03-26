import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { getApiEnv } from './config/api-env';
import { PrismaService } from './common/prisma/prisma.service';

async function bootstrap() {
  const env = getApiEnv();
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: env.APP_ORIGIN,
      credentials: true
    }
  });

  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Personal ERP API')
    .setDescription('Personal cash-flow ERP starter API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  await app.listen(env.PORT);
  console.log(`API running on http://localhost:${env.PORT}/api`);
}

bootstrap();
