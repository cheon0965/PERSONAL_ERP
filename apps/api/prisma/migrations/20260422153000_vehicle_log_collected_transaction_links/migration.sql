ALTER TABLE `FuelLog`
  ADD COLUMN `linkedCollectedTransactionId` VARCHAR(191) NULL,
  ADD UNIQUE INDEX `FuelLog_linkedCollectedTransactionId_key`(`linkedCollectedTransactionId`);

ALTER TABLE `VehicleMaintenanceLog`
  ADD COLUMN `linkedCollectedTransactionId` VARCHAR(191) NULL,
  ADD UNIQUE INDEX `VehicleMaintenanceLog_linkedCollectedTransactionId_key`(`linkedCollectedTransactionId`);

ALTER TABLE `FuelLog`
  ADD CONSTRAINT `FuelLog_linkedCollectedTransactionId_fkey`
  FOREIGN KEY (`linkedCollectedTransactionId`) REFERENCES `CollectedTransaction`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE `VehicleMaintenanceLog`
  ADD CONSTRAINT `VehicleMaintenanceLog_linkedCollectedTransactionId_fkey`
  FOREIGN KEY (`linkedCollectedTransactionId`) REFERENCES `CollectedTransaction`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;
