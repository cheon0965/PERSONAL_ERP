import { Inject, type Provider } from '@nestjs/common';
import { getApiEnv, type ApiEnv } from './api-env';

export const API_ENV = Symbol('API_ENV');

export const apiEnvProvider: Provider<ApiEnv> = {
  provide: API_ENV,
  useFactory: getApiEnv
};

export const InjectApiEnv = () => Inject(API_ENV);
