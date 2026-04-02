import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import {
  applyBrowserBoundaryHeaders,
  createCorsOriginDelegate
} from '../common/infrastructure/security/browser-boundary';
import type { ApiEnv } from '../config/api-env';

type ConfigureApiAppOptions = {
  logger?: {
    log(message: string): void;
  };
};

export function configureApiApp(
  app: INestApplication,
  env: ApiEnv,
  options: ConfigureApiAppOptions = {}
): void {
  app.enableCors({
    origin: createCorsOriginDelegate(env.CORS_ALLOWED_ORIGINS),
    credentials: true
  });
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.use((request: Request, response: Response, next: NextFunction) => {
    applyBrowserBoundaryHeaders(request, response, env);
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true
    })
  );

  if (env.SWAGGER_ENABLED) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Owner ERP API')
      .setDescription(
        'Monthly operations ERP starter API for sole proprietors and small businesses'
      )
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
    return;
  }

  options.logger?.log('Swagger docs are disabled for this environment.');
}
