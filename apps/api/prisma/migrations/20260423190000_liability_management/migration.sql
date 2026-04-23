CREATE TABLE `LiabilityAgreement` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `ledgerId` VARCHAR(191) NOT NULL,
  `defaultFundingAccountId` VARCHAR(191) NOT NULL,
  `liabilityAccountSubjectId` VARCHAR(191) NULL,
  `interestExpenseCategoryId` VARCHAR(191) NULL,
  `feeExpenseCategoryId` VARCHAR(191) NULL,
  `lenderName` VARCHAR(191) NOT NULL,
  `normalizedLenderName` VARCHAR(191) NOT NULL,
  `productName` VARCHAR(191) NOT NULL,
  `normalizedProductName` VARCHAR(191) NOT NULL,
  `loanNumberLast4` VARCHAR(4) NULL,
  `principalAmount` DECIMAL(19, 0) NOT NULL,
  `borrowedAt` DATETIME(3) NOT NULL,
  `maturityDate` DATETIME(3) NULL,
  `interestRate` DECIMAL(7, 4) NULL,
  `interestRateType` ENUM('FIXED', 'VARIABLE') NOT NULL DEFAULT 'FIXED',
  `repaymentMethod` ENUM(
    'EQUAL_PRINCIPAL',
    'EQUAL_PAYMENT',
    'INTEREST_ONLY',
    'BULLET',
    'MANUAL'
  ) NOT NULL DEFAULT 'MANUAL',
  `paymentDay` INTEGER NULL,
  `status` ENUM('ACTIVE', 'PAID_OFF', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
  `memo` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LiabilityRepaymentSchedule` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `ledgerId` VARCHAR(191) NOT NULL,
  `liabilityAgreementId` VARCHAR(191) NOT NULL,
  `dueDate` DATETIME(3) NOT NULL,
  `principalAmount` DECIMAL(19, 0) NOT NULL DEFAULT 0,
  `interestAmount` DECIMAL(19, 0) NOT NULL DEFAULT 0,
  `feeAmount` DECIMAL(19, 0) NOT NULL DEFAULT 0,
  `totalAmount` DECIMAL(19, 0) NOT NULL,
  `status` ENUM(
    'SCHEDULED',
    'PLANNED',
    'MATCHED',
    'POSTED',
    'SKIPPED',
    'CANCELLED'
  ) NOT NULL DEFAULT 'SCHEDULED',
  `linkedPlanItemId` VARCHAR(191) NULL,
  `postedJournalEntryId` VARCHAR(191) NULL,
  `memo` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `LiabilityAgreement_ledger_normlender_normproduct_key`
  ON `LiabilityAgreement`(`ledgerId`, `normalizedLenderName`, `normalizedProductName`);

CREATE INDEX `LiabilityAgreement_tenantId_ledgerId_status_idx`
  ON `LiabilityAgreement`(`tenantId`, `ledgerId`, `status`);

CREATE INDEX `LiabilityAgreement_defaultFundingAccountId_idx`
  ON `LiabilityAgreement`(`defaultFundingAccountId`);

CREATE INDEX `LiabilityAgreement_liabilityAccountSubjectId_idx`
  ON `LiabilityAgreement`(`liabilityAccountSubjectId`);

CREATE INDEX `LiabilityAgreement_interestExpenseCategoryId_idx`
  ON `LiabilityAgreement`(`interestExpenseCategoryId`);

CREATE INDEX `LiabilityAgreement_feeExpenseCategoryId_idx`
  ON `LiabilityAgreement`(`feeExpenseCategoryId`);

CREATE UNIQUE INDEX `LiabilityRepaymentSchedule_linkedPlanItemId_key`
  ON `LiabilityRepaymentSchedule`(`linkedPlanItemId`);

CREATE UNIQUE INDEX `LiabilityRepaymentSchedule_postedJournalEntryId_key`
  ON `LiabilityRepaymentSchedule`(`postedJournalEntryId`);

CREATE UNIQUE INDEX `LiabilityRepayment_agreement_due_key`
  ON `LiabilityRepaymentSchedule`(`liabilityAgreementId`, `dueDate`);

CREATE INDEX `LiabilityRepayment_tenant_ledger_due_status_idx`
  ON `LiabilityRepaymentSchedule`(`tenantId`, `ledgerId`, `dueDate`, `status`);

CREATE INDEX `LiabilityRepayment_ledger_due_idx`
  ON `LiabilityRepaymentSchedule`(`ledgerId`, `dueDate`);

ALTER TABLE `LiabilityAgreement`
  ADD CONSTRAINT `LiabilityAgreement_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `LiabilityAgreement_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `LiabilityAgreement_ledgerId_fkey`
    FOREIGN KEY (`ledgerId`) REFERENCES `Ledger`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `LiabilityAgreement_defaultFundingAccountId_fkey`
    FOREIGN KEY (`defaultFundingAccountId`) REFERENCES `Account`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `LiabilityAgreement_liabilityAccountSubjectId_fkey`
    FOREIGN KEY (`liabilityAccountSubjectId`) REFERENCES `AccountSubject`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `LiabilityAgreement_interestExpenseCategoryId_fkey`
    FOREIGN KEY (`interestExpenseCategoryId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `LiabilityAgreement_feeExpenseCategoryId_fkey`
    FOREIGN KEY (`feeExpenseCategoryId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `LiabilityRepaymentSchedule`
  ADD CONSTRAINT `LiabilityRepaymentSchedule_liabilityAgreementId_fkey`
    FOREIGN KEY (`liabilityAgreementId`) REFERENCES `LiabilityAgreement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `LiabilityRepaymentSchedule_linkedPlanItemId_fkey`
    FOREIGN KEY (`linkedPlanItemId`) REFERENCES `PlanItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `LiabilityRepaymentSchedule_postedJournalEntryId_fkey`
    FOREIGN KEY (`postedJournalEntryId`) REFERENCES `JournalEntry`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
