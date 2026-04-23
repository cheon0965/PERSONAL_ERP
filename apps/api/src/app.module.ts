import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { validateApiEnv } from './config/api-env';
import { ExternalDependenciesModule } from './common/infrastructure/external-dependencies.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdminModule } from './modules/admin/admin.module';
import { AccountSubjectsModule } from './modules/account-subjects/account-subjects.module';
import { FundingAccountsModule } from './modules/funding-accounts/funding-accounts.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { LedgerTransactionTypesModule } from './modules/ledger-transaction-types/ledger-transaction-types.module';
import { AccountingPeriodsModule } from './modules/accounting-periods/public';
import { CollectedTransactionsModule } from './modules/collected-transactions/public';
import { JournalEntriesModule } from './modules/journal-entries/public';
import { PlanItemsModule } from './modules/plan-items/public';
import { FinancialStatementsModule } from './modules/financial-statements/public';
import { CarryForwardsModule } from './modules/carry-forwards/public';
import { ImportBatchesModule } from './modules/import-batches/public';
import { RecurringRulesModule } from './modules/recurring-rules/public';
import { InsurancePoliciesModule } from './modules/insurance-policies/insurance-policies.module';
import { LiabilitiesModule } from './modules/liabilities/public';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { DashboardModule } from './modules/dashboard/public';
import { ForecastModule } from './modules/forecast/public';
import { ReferenceDataReadinessModule } from './modules/reference-data-readiness/reference-data-readiness.module';
import { WorkspaceSettingsModule } from './modules/workspace-settings/workspace-settings.module';
import { OperationsConsoleModule } from './modules/operations-console/operations-console.module';
import { NavigationModule } from './modules/navigation/public';

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
    NavigationModule,
    WorkspaceSettingsModule,
    AdminModule,
    ReferenceDataReadinessModule,
    OperationsConsoleModule,
    AccountSubjectsModule,
    FundingAccountsModule,
    CategoriesModule,
    LedgerTransactionTypesModule,
    AccountingPeriodsModule,
    CollectedTransactionsModule,
    JournalEntriesModule,
    PlanItemsModule,
    FinancialStatementsModule,
    CarryForwardsModule,
    ImportBatchesModule,
    RecurringRulesModule,
    InsurancePoliciesModule,
    LiabilitiesModule,
    VehiclesModule,
    DashboardModule,
    ForecastModule
  ]
})
export class AppModule {}
