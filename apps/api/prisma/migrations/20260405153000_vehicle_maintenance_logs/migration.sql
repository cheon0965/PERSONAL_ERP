CREATE TABLE `VehicleMaintenanceLog` (
  `id` VARCHAR(191) NOT NULL,
  `vehicleId` VARCHAR(191) NOT NULL,
  `performedOn` DATETIME(3) NOT NULL,
  `odometerKm` INTEGER NOT NULL,
  `category` ENUM('INSPECTION', 'REPAIR', 'CONSUMABLE', 'TIRE', 'ACCIDENT', 'OTHER') NOT NULL,
  `vendor` VARCHAR(191) NULL,
  `description` VARCHAR(191) NOT NULL,
  `amountWon` INTEGER NOT NULL,
  `memo` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `VehicleMaintenanceLog_vehicleId_performedOn_idx`(`vehicleId`, `performedOn`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `VehicleMaintenanceLog`
  ADD CONSTRAINT `VehicleMaintenanceLog_vehicleId_fkey`
  FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;
