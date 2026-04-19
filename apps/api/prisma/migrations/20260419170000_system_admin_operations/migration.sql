ALTER TABLE `User`
  ADD COLUMN `status` ENUM('ACTIVE', 'LOCKED', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN `lockedReason` VARCHAR(191) NULL,
  ADD COLUMN `lockedAt` DATETIME(3) NULL;

ALTER TABLE `AuthSession`
  ADD COLUMN `supportTenantId` VARCHAR(191) NULL,
  ADD COLUMN `supportLedgerId` VARCHAR(191) NULL,
  ADD COLUMN `supportStartedAt` DATETIME(3) NULL;

CREATE INDEX `User_status_idx` ON `User`(`status`);
CREATE INDEX `AuthSession_supportTenantId_supportLedgerId_idx` ON `AuthSession`(`supportTenantId`, `supportLedgerId`);
