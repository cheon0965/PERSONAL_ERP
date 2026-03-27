CREATE TABLE `User` (
  `id` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `passwordHash` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `User_email_key`(`email`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `UserSetting` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `minimumReserveWon` INTEGER NOT NULL DEFAULT 400000,
  `monthlySinkingFundWon` INTEGER NOT NULL DEFAULT 140000,
  `timezone` VARCHAR(191) NOT NULL DEFAULT 'Asia/Seoul',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `UserSetting_userId_key`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Account` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `type` ENUM('BANK', 'CASH', 'CARD') NOT NULL,
  `balanceWon` INTEGER NOT NULL DEFAULT 0,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `Account_userId_sortOrder_idx`(`userId`, `sortOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Category` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `kind` ENUM('INCOME', 'EXPENSE', 'TRANSFER') NOT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `Category_userId_kind_sortOrder_idx`(`userId`, `kind`, `sortOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Transaction` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `type` ENUM('INCOME', 'EXPENSE', 'TRANSFER') NOT NULL,
  `amountWon` INTEGER NOT NULL,
  `businessDate` DATETIME(3) NOT NULL,
  `accountId` VARCHAR(191) NOT NULL,
  `categoryId` VARCHAR(191) NULL,
  `origin` ENUM('MANUAL', 'RECURRING', 'IMPORT') NOT NULL DEFAULT 'MANUAL',
  `status` ENUM('POSTED', 'PENDING', 'CANCELLED') NOT NULL DEFAULT 'POSTED',
  `memo` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `Transaction_userId_businessDate_idx`(`userId`, `businessDate`),
  INDEX `Transaction_userId_type_businessDate_idx`(`userId`, `type`, `businessDate`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RecurringRule` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `accountId` VARCHAR(191) NOT NULL,
  `categoryId` VARCHAR(191) NULL,
  `title` VARCHAR(191) NOT NULL,
  `amountWon` INTEGER NOT NULL,
  `frequency` ENUM('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY') NOT NULL,
  `dayOfMonth` INTEGER NULL,
  `startDate` DATETIME(3) NOT NULL,
  `endDate` DATETIME(3) NULL,
  `nextRunDate` DATETIME(3) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `RecurringRule_userId_isActive_nextRunDate_idx`(`userId`, `isActive`, `nextRunDate`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `InsurancePolicy` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `provider` VARCHAR(191) NOT NULL,
  `productName` VARCHAR(191) NOT NULL,
  `monthlyPremiumWon` INTEGER NOT NULL,
  `paymentDay` INTEGER NOT NULL,
  `cycle` ENUM('MONTHLY', 'YEARLY') NOT NULL DEFAULT 'MONTHLY',
  `renewalDate` DATETIME(3) NULL,
  `maturityDate` DATETIME(3) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `InsurancePolicy_userId_isActive_idx`(`userId`, `isActive`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Vehicle` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `manufacturer` VARCHAR(191) NULL,
  `fuelType` ENUM('GASOLINE', 'DIESEL', 'LPG', 'HYBRID', 'ELECTRIC') NOT NULL,
  `initialOdometerKm` INTEGER NOT NULL,
  `monthlyExpenseWon` INTEGER NOT NULL DEFAULT 0,
  `estimatedFuelEfficiencyKmPerLiter` DECIMAL(10, 2) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `Vehicle_userId_name_idx`(`userId`, `name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `FuelLog` (
  `id` VARCHAR(191) NOT NULL,
  `vehicleId` VARCHAR(191) NOT NULL,
  `filledOn` DATETIME(3) NOT NULL,
  `odometerKm` INTEGER NOT NULL,
  `liters` DECIMAL(10, 3) NOT NULL,
  `amountWon` INTEGER NOT NULL,
  `unitPriceWon` INTEGER NOT NULL,
  `isFullTank` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `FuelLog_vehicleId_filledOn_idx`(`vehicleId`, `filledOn`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `UserSetting`
  ADD CONSTRAINT `UserSetting_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE `Account`
  ADD CONSTRAINT `Account_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE `Category`
  ADD CONSTRAINT `Category_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE `Transaction`
  ADD CONSTRAINT `Transaction_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE `Transaction`
  ADD CONSTRAINT `Transaction_accountId_fkey`
  FOREIGN KEY (`accountId`) REFERENCES `Account`(`id`)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE `Transaction`
  ADD CONSTRAINT `Transaction_categoryId_fkey`
  FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE `RecurringRule`
  ADD CONSTRAINT `RecurringRule_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE `RecurringRule`
  ADD CONSTRAINT `RecurringRule_accountId_fkey`
  FOREIGN KEY (`accountId`) REFERENCES `Account`(`id`)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE `RecurringRule`
  ADD CONSTRAINT `RecurringRule_categoryId_fkey`
  FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE `InsurancePolicy`
  ADD CONSTRAINT `InsurancePolicy_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE `Vehicle`
  ADD CONSTRAINT `Vehicle_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE `FuelLog`
  ADD CONSTRAINT `FuelLog_vehicleId_fkey`
  FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;
