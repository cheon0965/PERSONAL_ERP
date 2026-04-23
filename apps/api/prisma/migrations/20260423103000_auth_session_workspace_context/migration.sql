ALTER TABLE `AuthSession`
  ADD COLUMN `currentTenantId` VARCHAR(191) NULL,
  ADD COLUMN `currentLedgerId` VARCHAR(191) NULL;

CREATE INDEX `AuthSession_currentTenantId_currentLedgerId_idx` ON `AuthSession`(`currentTenantId`, `currentLedgerId`);
