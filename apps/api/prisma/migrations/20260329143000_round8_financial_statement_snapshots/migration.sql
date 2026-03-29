CREATE TABLE `FinancialStatementSnapshot` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `ledgerId` VARCHAR(191) NOT NULL,
  `periodId` VARCHAR(191) NOT NULL,
  `statementKind` ENUM(
    'STATEMENT_OF_FINANCIAL_POSITION',
    'MONTHLY_PROFIT_AND_LOSS',
    'CASH_FLOW_SUMMARY',
    'NET_WORTH_MOVEMENT'
  ) NOT NULL,
  `currency` VARCHAR(3) NOT NULL,
  `payload` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `FinancialStatementSnapshot_periodId_statementKind_key`(`periodId`, `statementKind`),
  INDEX `FinancialStatementSnapshot_tenantId_ledgerId_createdAt_idx`(`tenantId`, `ledgerId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `FinancialStatementSnapshot`
  ADD CONSTRAINT `FinancialStatementSnapshot_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `FinancialStatementSnapshot`
  ADD CONSTRAINT `FinancialStatementSnapshot_ledgerId_fkey`
  FOREIGN KEY (`ledgerId`) REFERENCES `Ledger`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `FinancialStatementSnapshot`
  ADD CONSTRAINT `FinancialStatementSnapshot_periodId_fkey`
  FOREIGN KEY (`periodId`) REFERENCES `AccountingPeriod`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
