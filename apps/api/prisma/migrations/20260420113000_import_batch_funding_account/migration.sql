ALTER TABLE `ImportBatch`
  ADD COLUMN `fundingAccountId` VARCHAR(191) NULL;

CREATE INDEX `ImportBatch_fundingAccountId_idx`
  ON `ImportBatch`(`fundingAccountId`);

ALTER TABLE `ImportBatch`
  ADD CONSTRAINT `ImportBatch_fundingAccountId_fkey`
  FOREIGN KEY (`fundingAccountId`) REFERENCES `Account`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
