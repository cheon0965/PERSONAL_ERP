ALTER TABLE `Account`
  ADD COLUMN `linkedAccountSubjectId` VARCHAR(191) NULL;

ALTER TABLE `Category`
  ADD COLUMN `defaultAccountSubjectId` VARCHAR(191) NULL;

ALTER TABLE `RecurringRule`
  ADD COLUMN `counterpartyFundingAccountId` VARCHAR(191) NULL,
  ADD COLUMN `fundingAccountDirection` ENUM('INFLOW', 'OUTFLOW') NULL;

ALTER TABLE `PlanItem`
  ADD COLUMN `counterpartyFundingAccountId` VARCHAR(191) NULL,
  ADD COLUMN `fundingAccountDirection` ENUM('INFLOW', 'OUTFLOW') NULL;

ALTER TABLE `CollectedTransaction`
  ADD COLUMN `counterpartyFundingAccountId` VARCHAR(191) NULL,
  ADD COLUMN `fundingAccountDirection` ENUM('INFLOW', 'OUTFLOW') NULL;

ALTER TABLE `OpeningBalanceSnapshot`
  ADD COLUMN `equityAdjustmentKind` ENUM(
    'INITIAL_AUTO_BALANCE',
    'PERIOD_PNL_ROLLOVER',
    'LEGACY_REPAIR'
  ) NULL,
  ADD COLUMN `equityAdjustmentAmount` DECIMAL(19, 0) NOT NULL DEFAULT 0;

CREATE INDEX `Account_linkedAccountSubjectId_idx`
  ON `Account`(`linkedAccountSubjectId`);

CREATE INDEX `Category_defaultAccountSubjectId_idx`
  ON `Category`(`defaultAccountSubjectId`);

CREATE INDEX `RecurringRule_counterpartyFundingAccountId_idx`
  ON `RecurringRule`(`counterpartyFundingAccountId`);

CREATE INDEX `PlanItem_counterpartyFundingAccountId_idx`
  ON `PlanItem`(`counterpartyFundingAccountId`);

CREATE INDEX `CollectedTransaction_counterpartyFundingAccountId_idx`
  ON `CollectedTransaction`(`counterpartyFundingAccountId`);

ALTER TABLE `Account`
  ADD CONSTRAINT `Account_linkedAccountSubjectId_fkey`
    FOREIGN KEY (`linkedAccountSubjectId`) REFERENCES `AccountSubject`(`id`)
      ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Category`
  ADD CONSTRAINT `Category_defaultAccountSubjectId_fkey`
    FOREIGN KEY (`defaultAccountSubjectId`) REFERENCES `AccountSubject`(`id`)
      ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `RecurringRule`
  ADD CONSTRAINT `RecurringRule_counterpartyFundingAccountId_fkey`
    FOREIGN KEY (`counterpartyFundingAccountId`) REFERENCES `Account`(`id`)
      ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `RecurringRule_distinct_funding_accounts_chk`
    CHECK (
      `counterpartyFundingAccountId` IS NULL OR
      `counterpartyFundingAccountId` <> `accountId`
    );

ALTER TABLE `PlanItem`
  ADD CONSTRAINT `PlanItem_counterpartyFundingAccountId_fkey`
    FOREIGN KEY (`counterpartyFundingAccountId`) REFERENCES `Account`(`id`)
      ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `PlanItem_distinct_funding_accounts_chk`
    CHECK (
      `counterpartyFundingAccountId` IS NULL OR
      `counterpartyFundingAccountId` <> `fundingAccountId`
    );

ALTER TABLE `CollectedTransaction`
  ADD CONSTRAINT `CollectedTransaction_counterpartyFundingAccountId_fkey`
    FOREIGN KEY (`counterpartyFundingAccountId`) REFERENCES `Account`(`id`)
      ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `CollectedTransaction_distinct_funding_accounts_chk`
    CHECK (
      `counterpartyFundingAccountId` IS NULL OR
      `counterpartyFundingAccountId` <> `fundingAccountId`
    );
