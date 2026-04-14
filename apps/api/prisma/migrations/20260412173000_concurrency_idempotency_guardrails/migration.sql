ALTER TABLE `AccountingPeriod`
  ADD COLUMN `nextJournalEntrySequence` INT NOT NULL DEFAULT 1;

UPDATE `AccountingPeriod` period
LEFT JOIN (
  SELECT
    `periodId`,
    COALESCE(MAX(CAST(SUBSTRING_INDEX(`entryNumber`, '-', -1) AS UNSIGNED)), 0) + 1 AS `nextSequence`
  FROM `JournalEntry`
  GROUP BY `periodId`
) sequence_by_period
  ON sequence_by_period.`periodId` = period.`id`
SET period.`nextJournalEntrySequence` = COALESCE(sequence_by_period.`nextSequence`, 1);

ALTER TABLE `Account`
  ADD COLUMN `normalizedName` VARCHAR(191) NOT NULL DEFAULT '';

UPDATE `Account`
SET `normalizedName` = LOWER(TRIM(`name`));

CREATE UNIQUE INDEX `Account_ledgerId_normalizedName_key`
  ON `Account`(`ledgerId`, `normalizedName`);

ALTER TABLE `Category`
  ADD COLUMN `normalizedName` VARCHAR(191) NOT NULL DEFAULT '';

UPDATE `Category`
SET `normalizedName` = LOWER(TRIM(`name`));

CREATE UNIQUE INDEX `Category_ledgerId_kind_normalizedName_key`
  ON `Category`(`ledgerId`, `kind`, `normalizedName`);

ALTER TABLE `PlanItem`
  ADD CONSTRAINT `PlanItem_periodId_recurringRuleId_plannedDate_key`
  UNIQUE (`periodId`, `recurringRuleId`, `plannedDate`);

ALTER TABLE `InsurancePolicy`
  ADD COLUMN `normalizedProvider` VARCHAR(191) NOT NULL DEFAULT '',
  ADD COLUMN `normalizedProductName` VARCHAR(191) NOT NULL DEFAULT '';

UPDATE `InsurancePolicy`
SET
  `normalizedProvider` = LOWER(TRIM(`provider`)),
  `normalizedProductName` = LOWER(TRIM(`productName`));

CREATE UNIQUE INDEX `InsurancePolicy_ledger_normprov_normprod_key`
  ON `InsurancePolicy`(`ledgerId`, `normalizedProvider`, `normalizedProductName`);

ALTER TABLE `Vehicle`
  ADD COLUMN `normalizedName` VARCHAR(191) NOT NULL DEFAULT '';

UPDATE `Vehicle`
SET `normalizedName` = LOWER(TRIM(`name`));

CREATE UNIQUE INDEX `Vehicle_ledgerId_normalizedName_key`
  ON `Vehicle`(`ledgerId`, `normalizedName`);
