ALTER TABLE `InsurancePolicy`
  ADD COLUMN `accountId` VARCHAR(191) NULL,
  ADD COLUMN `categoryId` VARCHAR(191) NULL,
  ADD COLUMN `recurringStartDate` DATETIME(3) NULL,
  ADD COLUMN `linkedRecurringRuleId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `InsurancePolicy_linkedRecurringRuleId_key`
  ON `InsurancePolicy`(`linkedRecurringRuleId`);

CREATE INDEX `InsurancePolicy_accountId_idx`
  ON `InsurancePolicy`(`accountId`);

CREATE INDEX `InsurancePolicy_categoryId_idx`
  ON `InsurancePolicy`(`categoryId`);

ALTER TABLE `InsurancePolicy`
  ADD CONSTRAINT `InsurancePolicy_accountId_fkey`
    FOREIGN KEY (`accountId`) REFERENCES `Account`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `InsurancePolicy_categoryId_fkey`
    FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `InsurancePolicy_linkedRecurringRuleId_fkey`
    FOREIGN KEY (`linkedRecurringRuleId`) REFERENCES `RecurringRule`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
