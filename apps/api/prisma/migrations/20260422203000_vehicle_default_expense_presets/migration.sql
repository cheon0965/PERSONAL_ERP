ALTER TABLE `Vehicle`
  ADD COLUMN `defaultFundingAccountId` VARCHAR(191) NULL,
  ADD COLUMN `defaultFuelCategoryId` VARCHAR(191) NULL,
  ADD COLUMN `defaultMaintenanceCategoryId` VARCHAR(191) NULL,
  ADD COLUMN `operatingExpensePlanOptIn` BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX `Vehicle_defaultFundingAccountId_idx`
  ON `Vehicle`(`defaultFundingAccountId`);

CREATE INDEX `Vehicle_defaultFuelCategoryId_idx`
  ON `Vehicle`(`defaultFuelCategoryId`);

CREATE INDEX `Vehicle_defaultMaintenanceCategoryId_idx`
  ON `Vehicle`(`defaultMaintenanceCategoryId`);

ALTER TABLE `Vehicle`
  ADD CONSTRAINT `Vehicle_defaultFundingAccountId_fkey`
  FOREIGN KEY (`defaultFundingAccountId`) REFERENCES `Account`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE `Vehicle`
  ADD CONSTRAINT `Vehicle_defaultFuelCategoryId_fkey`
  FOREIGN KEY (`defaultFuelCategoryId`) REFERENCES `Category`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE `Vehicle`
  ADD CONSTRAINT `Vehicle_defaultMaintenanceCategoryId_fkey`
  FOREIGN KEY (`defaultMaintenanceCategoryId`) REFERENCES `Category`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;
