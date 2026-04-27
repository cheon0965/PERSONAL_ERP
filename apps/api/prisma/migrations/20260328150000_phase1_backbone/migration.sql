-- 1단계 백본 스키마 마이그레이션입니다.
-- 기존 User -> Tenant / Membership / Ledger 매핑의 데이터 백필은 다음 명령으로 처리합니다:
-- `npm run db:backfill:phase1`

-- 테이블 변경
ALTER TABLE `Account`
  ADD COLUMN `ledgerId` VARCHAR(191) NULL,
  ADD COLUMN `status` ENUM('ACTIVE', 'INACTIVE', 'CLOSED') NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN `tenantId` VARCHAR(191) NULL;

-- 테이블 변경
ALTER TABLE `Category`
  ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `ledgerId` VARCHAR(191) NULL,
  ADD COLUMN `tenantId` VARCHAR(191) NULL;

-- 테이블 변경
ALTER TABLE `Transaction`
  ADD COLUMN `ledgerId` VARCHAR(191) NULL,
  ADD COLUMN `tenantId` VARCHAR(191) NULL;

-- 테이블 변경
ALTER TABLE `RecurringRule`
  ADD COLUMN `ledgerId` VARCHAR(191) NULL,
  ADD COLUMN `ledgerTransactionTypeId` VARCHAR(191) NULL,
  ADD COLUMN `tenantId` VARCHAR(191) NULL;

-- 테이블 생성
CREATE TABLE `Tenant` (
  `id` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `status` ENUM('TRIAL', 'ACTIVE', 'SUSPENDED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
  `defaultLedgerId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `Tenant_slug_key`(`slug`),
  UNIQUE INDEX `Tenant_defaultLedgerId_key`(`defaultLedgerId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 테이블 생성
CREATE TABLE `TenantMembership` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `role` ENUM('OWNER', 'MANAGER', 'EDITOR', 'VIEWER') NOT NULL,
  `status` ENUM('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED') NOT NULL DEFAULT 'ACTIVE',
  `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `invitedByMembershipId` VARCHAR(191) NULL,
  `lastAccessAt` DATETIME(3) NULL,

  INDEX `TenantMembership_userId_status_idx`(`userId`, `status`),
  UNIQUE INDEX `TenantMembership_tenantId_userId_key`(`tenantId`, `userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 테이블 생성
CREATE TABLE `Ledger` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `baseCurrency` VARCHAR(3) NOT NULL DEFAULT 'KRW',
  `timezone` VARCHAR(191) NOT NULL DEFAULT 'Asia/Seoul',
  `status` ENUM('ACTIVE', 'SUSPENDED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
  `openedFromYearMonth` VARCHAR(7) NOT NULL,
  `closedThroughYearMonth` VARCHAR(7) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `Ledger_tenantId_status_idx`(`tenantId`, `status`),
  UNIQUE INDEX `Ledger_tenantId_name_key`(`tenantId`, `name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 테이블 생성
CREATE TABLE `AccountingPeriod` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `ledgerId` VARCHAR(191) NOT NULL,
  `year` INTEGER NOT NULL,
  `month` INTEGER NOT NULL,
  `startDate` DATETIME(3) NOT NULL,
  `endDate` DATETIME(3) NOT NULL,
  `status` ENUM('OPEN', 'IN_REVIEW', 'CLOSING', 'LOCKED') NOT NULL DEFAULT 'OPEN',
  `openedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lockedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `AccountingPeriod_tenantId_ledgerId_status_idx`(`tenantId`, `ledgerId`, `status`),
  UNIQUE INDEX `AccountingPeriod_ledgerId_year_month_key`(`ledgerId`, `year`, `month`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 테이블 생성
CREATE TABLE `PeriodStatusHistory` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `ledgerId` VARCHAR(191) NOT NULL,
  `periodId` VARCHAR(191) NOT NULL,
  `fromStatus` ENUM('OPEN', 'IN_REVIEW', 'CLOSING', 'LOCKED') NULL,
  `toStatus` ENUM('OPEN', 'IN_REVIEW', 'CLOSING', 'LOCKED') NOT NULL,
  `reason` TEXT NULL,
  `actorType` ENUM('TENANT_MEMBERSHIP', 'SYSTEM') NOT NULL,
  `actorMembershipId` VARCHAR(191) NULL,
  `changedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `PeriodStatusHistory_periodId_changedAt_idx`(`periodId`, `changedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 테이블 생성
CREATE TABLE `AccountSubject` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `ledgerId` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `statementType` ENUM('BALANCE_SHEET', 'PROFIT_AND_LOSS') NOT NULL,
  `normalSide` ENUM('DEBIT', 'CREDIT') NOT NULL,
  `subjectKind` ENUM('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE') NOT NULL,
  `isSystem` BOOLEAN NOT NULL DEFAULT false,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `AccountSubject_tenantId_ledgerId_sortOrder_idx`(`tenantId`, `ledgerId`, `sortOrder`),
  UNIQUE INDEX `AccountSubject_ledgerId_code_key`(`ledgerId`, `code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 테이블 생성
CREATE TABLE `LedgerTransactionType` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `ledgerId` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `flowKind` ENUM('INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT', 'OPENING_BALANCE', 'CARRY_FORWARD') NOT NULL,
  `postingPolicyKey` ENUM('INCOME_BASIC', 'EXPENSE_BASIC', 'TRANSFER_BASIC', 'CARD_SPEND', 'CARD_PAYMENT', 'OPENING_BALANCE', 'CARRY_FORWARD', 'MANUAL_ADJUSTMENT') NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `LedgerTransactionType_tenantId_ledgerId_sortOrder_idx`(`tenantId`, `ledgerId`, `sortOrder`),
  UNIQUE INDEX `LedgerTransactionType_ledgerId_code_key`(`ledgerId`, `code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 테이블 생성
CREATE TABLE `PlanItem` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `ledgerId` VARCHAR(191) NOT NULL,
  `periodId` VARCHAR(191) NOT NULL,
  `recurringRuleId` VARCHAR(191) NULL,
  `ledgerTransactionTypeId` VARCHAR(191) NOT NULL,
  `fundingAccountId` VARCHAR(191) NOT NULL,
  `categoryId` VARCHAR(191) NULL,
  `title` VARCHAR(191) NOT NULL,
  `plannedAmount` INTEGER NOT NULL,
  `plannedDate` DATETIME(3) NOT NULL,
  `status` ENUM('DRAFT', 'MATCHED', 'CONFIRMED', 'SKIPPED', 'EXPIRED') NOT NULL DEFAULT 'DRAFT',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `PlanItem_periodId_status_plannedDate_idx`(`periodId`, `status`, `plannedDate`),
  INDEX `PlanItem_tenantId_ledgerId_plannedDate_idx`(`tenantId`, `ledgerId`, `plannedDate`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 테이블 생성
CREATE TABLE `ImportBatch` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `ledgerId` VARCHAR(191) NOT NULL,
  `periodId` VARCHAR(191) NULL,
  `sourceKind` ENUM('CARD_EXCEL', 'BANK_CSV', 'MANUAL_UPLOAD') NOT NULL,
  `fileName` VARCHAR(191) NOT NULL,
  `fileHash` VARCHAR(191) NOT NULL,
  `rowCount` INTEGER NOT NULL DEFAULT 0,
  `parseStatus` ENUM('PENDING', 'COMPLETED', 'PARTIAL', 'FAILED') NOT NULL DEFAULT 'PENDING',
  `uploadedByMembershipId` VARCHAR(191) NOT NULL,
  `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `ImportBatch_ledgerId_uploadedAt_idx`(`ledgerId`, `uploadedAt`),
  INDEX `ImportBatch_fileHash_idx`(`fileHash`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 테이블 생성
CREATE TABLE `ImportedRow` (
  `id` VARCHAR(191) NOT NULL,
  `batchId` VARCHAR(191) NOT NULL,
  `rowNumber` INTEGER NOT NULL,
  `rawPayload` JSON NOT NULL,
  `parseStatus` ENUM('PENDING', 'PARSED', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
  `parseError` TEXT NULL,
  `sourceFingerprint` VARCHAR(191) NULL,

  INDEX `ImportedRow_sourceFingerprint_idx`(`sourceFingerprint`),
  UNIQUE INDEX `ImportedRow_batchId_rowNumber_key`(`batchId`, `rowNumber`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 테이블 생성
CREATE TABLE `CollectedTransaction` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `ledgerId` VARCHAR(191) NOT NULL,
  `periodId` VARCHAR(191) NULL,
  `importBatchId` VARCHAR(191) NULL,
  `importedRowId` VARCHAR(191) NULL,
  `ledgerTransactionTypeId` VARCHAR(191) NOT NULL,
  `fundingAccountId` VARCHAR(191) NOT NULL,
  `categoryId` VARCHAR(191) NULL,
  `matchedPlanItemId` VARCHAR(191) NULL,
  `title` VARCHAR(191) NOT NULL,
  `occurredOn` DATETIME(3) NOT NULL,
  `amount` INTEGER NOT NULL,
  `status` ENUM('COLLECTED', 'REVIEWED', 'READY_TO_POST', 'POSTED', 'CORRECTED', 'LOCKED') NOT NULL DEFAULT 'COLLECTED',
  `sourceFingerprint` VARCHAR(191) NULL,
  `memo` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `CollectedTransaction_importedRowId_key`(`importedRowId`),
  UNIQUE INDEX `CollectedTransaction_matchedPlanItemId_key`(`matchedPlanItemId`),
  INDEX `CollectedTransaction_ledgerId_status_occurredOn_idx`(`ledgerId`, `status`, `occurredOn`),
  INDEX `CollectedTransaction_ledgerId_sourceFingerprint_idx`(`ledgerId`, `sourceFingerprint`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 테이블 생성
CREATE TABLE `JournalEntry` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `ledgerId` VARCHAR(191) NOT NULL,
  `periodId` VARCHAR(191) NOT NULL,
  `entryNumber` VARCHAR(50) NOT NULL,
  `entryDate` DATETIME(3) NOT NULL,
  `sourceKind` ENUM('COLLECTED_TRANSACTION', 'PLAN_SETTLEMENT', 'OPENING_BALANCE', 'CARRY_FORWARD', 'MANUAL_ADJUSTMENT') NOT NULL,
  `sourceCollectedTransactionId` VARCHAR(191) NULL,
  `sourcePlanItemId` VARCHAR(191) NULL,
  `status` ENUM('POSTED', 'REVERSED', 'SUPERSEDED') NOT NULL DEFAULT 'POSTED',
  `memo` TEXT NULL,
  `reversesJournalEntryId` VARCHAR(191) NULL,
  `correctsJournalEntryId` VARCHAR(191) NULL,
  `correctionReason` TEXT NULL,
  `createdByActorType` ENUM('TENANT_MEMBERSHIP', 'SYSTEM') NOT NULL,
  `createdByMembershipId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `JournalEntry_sourceCollectedTransactionId_key`(`sourceCollectedTransactionId`),
  UNIQUE INDEX `JournalEntry_sourcePlanItemId_key`(`sourcePlanItemId`),
  UNIQUE INDEX `JournalEntry_reversesJournalEntryId_key`(`reversesJournalEntryId`),
  INDEX `JournalEntry_periodId_entryDate_idx`(`periodId`, `entryDate`),
  INDEX `JournalEntry_correctsJournalEntryId_idx`(`correctsJournalEntryId`),
  UNIQUE INDEX `JournalEntry_ledgerId_entryNumber_key`(`ledgerId`, `entryNumber`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 테이블 생성
CREATE TABLE `JournalLine` (
  `id` VARCHAR(191) NOT NULL,
  `journalEntryId` VARCHAR(191) NOT NULL,
  `lineNumber` INTEGER NOT NULL,
  `accountSubjectId` VARCHAR(191) NOT NULL,
  `fundingAccountId` VARCHAR(191) NULL,
  `debitAmount` INTEGER NOT NULL DEFAULT 0,
  `creditAmount` INTEGER NOT NULL DEFAULT 0,
  `description` TEXT NULL,

  INDEX `JournalLine_accountSubjectId_idx`(`accountSubjectId`),
  UNIQUE INDEX `JournalLine_journalEntryId_lineNumber_key`(`journalEntryId`, `lineNumber`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 테이블 생성
CREATE TABLE `OpeningBalanceSnapshot` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `ledgerId` VARCHAR(191) NOT NULL,
  `effectivePeriodId` VARCHAR(191) NOT NULL,
  `sourceKind` ENUM('INITIAL_SETUP', 'CARRY_FORWARD') NOT NULL DEFAULT 'INITIAL_SETUP',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdByActorType` ENUM('TENANT_MEMBERSHIP', 'SYSTEM') NOT NULL,
  `createdByMembershipId` VARCHAR(191) NULL,

  UNIQUE INDEX `OpeningBalanceSnapshot_effectivePeriodId_key`(`effectivePeriodId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 테이블 생성
CREATE TABLE `ClosingSnapshot` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `ledgerId` VARCHAR(191) NOT NULL,
  `periodId` VARCHAR(191) NOT NULL,
  `lockedAt` DATETIME(3) NOT NULL,
  `totalAssetAmount` INTEGER NOT NULL,
  `totalLiabilityAmount` INTEGER NOT NULL,
  `totalEquityAmount` INTEGER NOT NULL,
  `periodPnLAmount` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `ClosingSnapshot_periodId_key`(`periodId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 테이블 생성
CREATE TABLE `BalanceSnapshotLine` (
  `id` VARCHAR(191) NOT NULL,
  `snapshotKind` ENUM('OPENING', 'CLOSING') NOT NULL,
  `openingSnapshotId` VARCHAR(191) NULL,
  `closingSnapshotId` VARCHAR(191) NULL,
  `accountSubjectId` VARCHAR(191) NOT NULL,
  `fundingAccountId` VARCHAR(191) NULL,
  `balanceAmount` INTEGER NOT NULL,

  INDEX `BalanceSnapshotLine_openingSnapshotId_accountSubjectId_idx`(`openingSnapshotId`, `accountSubjectId`),
  INDEX `BalanceSnapshotLine_closingSnapshotId_accountSubjectId_idx`(`closingSnapshotId`, `accountSubjectId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 인덱스 생성
CREATE INDEX `Account_tenantId_ledgerId_sortOrder_idx` ON `Account`(`tenantId`, `ledgerId`, `sortOrder`);

-- 인덱스 생성
CREATE INDEX `Category_tenantId_ledgerId_kind_sortOrder_idx` ON `Category`(`tenantId`, `ledgerId`, `kind`, `sortOrder`);

-- 인덱스 생성
CREATE INDEX `Transaction_tenantId_ledgerId_businessDate_idx` ON `Transaction`(`tenantId`, `ledgerId`, `businessDate`);

-- 인덱스 생성
CREATE INDEX `RecurringRule_tenantId_ledgerId_isActive_idx` ON `RecurringRule`(`tenantId`, `ledgerId`, `isActive`);

-- 외래 키 추가
ALTER TABLE `Tenant`
  ADD CONSTRAINT `Tenant_defaultLedgerId_fkey`
  FOREIGN KEY (`defaultLedgerId`) REFERENCES `Ledger`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `TenantMembership`
  ADD CONSTRAINT `TenantMembership_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `TenantMembership`
  ADD CONSTRAINT `TenantMembership_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `TenantMembership`
  ADD CONSTRAINT `TenantMembership_invitedByMembershipId_fkey`
  FOREIGN KEY (`invitedByMembershipId`) REFERENCES `TenantMembership`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `Ledger`
  ADD CONSTRAINT `Ledger_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `Account`
  ADD CONSTRAINT `Account_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `Account`
  ADD CONSTRAINT `Account_ledgerId_fkey`
  FOREIGN KEY (`ledgerId`) REFERENCES `Ledger`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `Category`
  ADD CONSTRAINT `Category_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `Category`
  ADD CONSTRAINT `Category_ledgerId_fkey`
  FOREIGN KEY (`ledgerId`) REFERENCES `Ledger`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `Transaction`
  ADD CONSTRAINT `Transaction_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `Transaction`
  ADD CONSTRAINT `Transaction_ledgerId_fkey`
  FOREIGN KEY (`ledgerId`) REFERENCES `Ledger`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `RecurringRule`
  ADD CONSTRAINT `RecurringRule_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `RecurringRule`
  ADD CONSTRAINT `RecurringRule_ledgerId_fkey`
  FOREIGN KEY (`ledgerId`) REFERENCES `Ledger`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `RecurringRule`
  ADD CONSTRAINT `RecurringRule_ledgerTransactionTypeId_fkey`
  FOREIGN KEY (`ledgerTransactionTypeId`) REFERENCES `LedgerTransactionType`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `AccountingPeriod`
  ADD CONSTRAINT `AccountingPeriod_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `AccountingPeriod`
  ADD CONSTRAINT `AccountingPeriod_ledgerId_fkey`
  FOREIGN KEY (`ledgerId`) REFERENCES `Ledger`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `PeriodStatusHistory`
  ADD CONSTRAINT `PeriodStatusHistory_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `PeriodStatusHistory`
  ADD CONSTRAINT `PeriodStatusHistory_ledgerId_fkey`
  FOREIGN KEY (`ledgerId`) REFERENCES `Ledger`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `PeriodStatusHistory`
  ADD CONSTRAINT `PeriodStatusHistory_periodId_fkey`
  FOREIGN KEY (`periodId`) REFERENCES `AccountingPeriod`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `AccountSubject`
  ADD CONSTRAINT `AccountSubject_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `AccountSubject`
  ADD CONSTRAINT `AccountSubject_ledgerId_fkey`
  FOREIGN KEY (`ledgerId`) REFERENCES `Ledger`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `LedgerTransactionType`
  ADD CONSTRAINT `LedgerTransactionType_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `LedgerTransactionType`
  ADD CONSTRAINT `LedgerTransactionType_ledgerId_fkey`
  FOREIGN KEY (`ledgerId`) REFERENCES `Ledger`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `PlanItem`
  ADD CONSTRAINT `PlanItem_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `PlanItem`
  ADD CONSTRAINT `PlanItem_ledgerId_fkey`
  FOREIGN KEY (`ledgerId`) REFERENCES `Ledger`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `PlanItem`
  ADD CONSTRAINT `PlanItem_periodId_fkey`
  FOREIGN KEY (`periodId`) REFERENCES `AccountingPeriod`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `PlanItem`
  ADD CONSTRAINT `PlanItem_recurringRuleId_fkey`
  FOREIGN KEY (`recurringRuleId`) REFERENCES `RecurringRule`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `PlanItem`
  ADD CONSTRAINT `PlanItem_ledgerTransactionTypeId_fkey`
  FOREIGN KEY (`ledgerTransactionTypeId`) REFERENCES `LedgerTransactionType`(`id`)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `PlanItem`
  ADD CONSTRAINT `PlanItem_fundingAccountId_fkey`
  FOREIGN KEY (`fundingAccountId`) REFERENCES `Account`(`id`)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `PlanItem`
  ADD CONSTRAINT `PlanItem_categoryId_fkey`
  FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `ImportBatch`
  ADD CONSTRAINT `ImportBatch_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `ImportBatch`
  ADD CONSTRAINT `ImportBatch_ledgerId_fkey`
  FOREIGN KEY (`ledgerId`) REFERENCES `Ledger`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `ImportBatch`
  ADD CONSTRAINT `ImportBatch_periodId_fkey`
  FOREIGN KEY (`periodId`) REFERENCES `AccountingPeriod`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `ImportedRow`
  ADD CONSTRAINT `ImportedRow_batchId_fkey`
  FOREIGN KEY (`batchId`) REFERENCES `ImportBatch`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `CollectedTransaction`
  ADD CONSTRAINT `CollectedTransaction_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `CollectedTransaction`
  ADD CONSTRAINT `CollectedTransaction_ledgerId_fkey`
  FOREIGN KEY (`ledgerId`) REFERENCES `Ledger`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `CollectedTransaction`
  ADD CONSTRAINT `CollectedTransaction_periodId_fkey`
  FOREIGN KEY (`periodId`) REFERENCES `AccountingPeriod`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `CollectedTransaction`
  ADD CONSTRAINT `CollectedTransaction_importBatchId_fkey`
  FOREIGN KEY (`importBatchId`) REFERENCES `ImportBatch`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `CollectedTransaction`
  ADD CONSTRAINT `CollectedTransaction_importedRowId_fkey`
  FOREIGN KEY (`importedRowId`) REFERENCES `ImportedRow`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `CollectedTransaction`
  ADD CONSTRAINT `CollectedTransaction_ledgerTransactionTypeId_fkey`
  FOREIGN KEY (`ledgerTransactionTypeId`) REFERENCES `LedgerTransactionType`(`id`)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `CollectedTransaction`
  ADD CONSTRAINT `CollectedTransaction_fundingAccountId_fkey`
  FOREIGN KEY (`fundingAccountId`) REFERENCES `Account`(`id`)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `CollectedTransaction`
  ADD CONSTRAINT `CollectedTransaction_categoryId_fkey`
  FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `CollectedTransaction`
  ADD CONSTRAINT `CollectedTransaction_matchedPlanItemId_fkey`
  FOREIGN KEY (`matchedPlanItemId`) REFERENCES `PlanItem`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `JournalEntry`
  ADD CONSTRAINT `JournalEntry_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `JournalEntry`
  ADD CONSTRAINT `JournalEntry_ledgerId_fkey`
  FOREIGN KEY (`ledgerId`) REFERENCES `Ledger`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `JournalEntry`
  ADD CONSTRAINT `JournalEntry_periodId_fkey`
  FOREIGN KEY (`periodId`) REFERENCES `AccountingPeriod`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `JournalEntry`
  ADD CONSTRAINT `JournalEntry_sourceCollectedTransactionId_fkey`
  FOREIGN KEY (`sourceCollectedTransactionId`) REFERENCES `CollectedTransaction`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `JournalEntry`
  ADD CONSTRAINT `JournalEntry_sourcePlanItemId_fkey`
  FOREIGN KEY (`sourcePlanItemId`) REFERENCES `PlanItem`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `JournalEntry`
  ADD CONSTRAINT `JournalEntry_reversesJournalEntryId_fkey`
  FOREIGN KEY (`reversesJournalEntryId`) REFERENCES `JournalEntry`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `JournalEntry`
  ADD CONSTRAINT `JournalEntry_correctsJournalEntryId_fkey`
  FOREIGN KEY (`correctsJournalEntryId`) REFERENCES `JournalEntry`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `JournalLine`
  ADD CONSTRAINT `JournalLine_journalEntryId_fkey`
  FOREIGN KEY (`journalEntryId`) REFERENCES `JournalEntry`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `JournalLine`
  ADD CONSTRAINT `JournalLine_accountSubjectId_fkey`
  FOREIGN KEY (`accountSubjectId`) REFERENCES `AccountSubject`(`id`)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `JournalLine`
  ADD CONSTRAINT `JournalLine_fundingAccountId_fkey`
  FOREIGN KEY (`fundingAccountId`) REFERENCES `Account`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `OpeningBalanceSnapshot`
  ADD CONSTRAINT `OpeningBalanceSnapshot_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `OpeningBalanceSnapshot`
  ADD CONSTRAINT `OpeningBalanceSnapshot_ledgerId_fkey`
  FOREIGN KEY (`ledgerId`) REFERENCES `Ledger`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `OpeningBalanceSnapshot`
  ADD CONSTRAINT `OpeningBalanceSnapshot_effectivePeriodId_fkey`
  FOREIGN KEY (`effectivePeriodId`) REFERENCES `AccountingPeriod`(`id`)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `ClosingSnapshot`
  ADD CONSTRAINT `ClosingSnapshot_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `ClosingSnapshot`
  ADD CONSTRAINT `ClosingSnapshot_ledgerId_fkey`
  FOREIGN KEY (`ledgerId`) REFERENCES `Ledger`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `ClosingSnapshot`
  ADD CONSTRAINT `ClosingSnapshot_periodId_fkey`
  FOREIGN KEY (`periodId`) REFERENCES `AccountingPeriod`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `BalanceSnapshotLine`
  ADD CONSTRAINT `BalanceSnapshotLine_openingSnapshotId_fkey`
  FOREIGN KEY (`openingSnapshotId`) REFERENCES `OpeningBalanceSnapshot`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `BalanceSnapshotLine`
  ADD CONSTRAINT `BalanceSnapshotLine_closingSnapshotId_fkey`
  FOREIGN KEY (`closingSnapshotId`) REFERENCES `ClosingSnapshot`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `BalanceSnapshotLine`
  ADD CONSTRAINT `BalanceSnapshotLine_accountSubjectId_fkey`
  FOREIGN KEY (`accountSubjectId`) REFERENCES `AccountSubject`(`id`)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `BalanceSnapshotLine`
  ADD CONSTRAINT `BalanceSnapshotLine_fundingAccountId_fkey`
  FOREIGN KEY (`fundingAccountId`) REFERENCES `Account`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;
