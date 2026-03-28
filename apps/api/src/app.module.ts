import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { validateApiEnv } from './config/api-env';
import { ExternalDependenciesModule } from './common/infrastructure/external-dependencies.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { FundingAccountsModule } from './modules/funding-accounts/funding-accounts.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { CollectedTransactionsModule } from './modules/collected-transactions/public';
import { RecurringRulesModule } from './modules/recurring-rules/public';
import { InsurancePoliciesModule } from './modules/insurance-policies/insurance-policies.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { DashboardModule } from './modules/dashboard/public';
import { ForecastModule } from './modules/forecast/public';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateApiEnv
    }),
    ScheduleModule.forRoot(),
    ExternalDependenciesModule,
    HealthModule,
    AuthModule,
    FundingAccountsModule,
    CategoriesModule,
    CollectedTransactionsModule,
    RecurringRulesModule,
    InsurancePoliciesModule,
    VehiclesModule,
    DashboardModule,
    ForecastModule
  ]
})
export class AppModule {}
