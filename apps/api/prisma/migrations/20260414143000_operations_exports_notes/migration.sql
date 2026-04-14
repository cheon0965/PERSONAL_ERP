CREATE TABLE `WorkspaceOperationalNote` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `ledgerId` VARCHAR(191) NOT NULL,
  `periodId` VARCHAR(191) NULL,
  `authorMembershipId` VARCHAR(191) NOT NULL,
  `kind` ENUM('GENERAL', 'MONTH_END', 'EXCEPTION', 'ALERT', 'FOLLOW_UP') NOT NULL DEFAULT 'GENERAL',
  `title` VARCHAR(191) NOT NULL,
  `body` TEXT NOT NULL,
  `relatedHref` VARCHAR(300) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `WorkspaceOperationalNote_tenantId_ledgerId_createdAt_idx`(`tenantId`, `ledgerId`, `createdAt`),
  INDEX `WorkspaceOperationalNote_tenantId_periodId_createdAt_idx`(`tenantId`, `periodId`, `createdAt`),
  INDEX `WorkspaceOperationalNote_tenantId_kind_createdAt_idx`(`tenantId`, `kind`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `WorkspaceOperationalNote`
  ADD CONSTRAINT `WorkspaceOperationalNote_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `WorkspaceOperationalNote`
  ADD CONSTRAINT `WorkspaceOperationalNote_ledgerId_fkey`
  FOREIGN KEY (`ledgerId`) REFERENCES `Ledger`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `WorkspaceOperationalNote`
  ADD CONSTRAINT `WorkspaceOperationalNote_periodId_fkey`
  FOREIGN KEY (`periodId`) REFERENCES `AccountingPeriod`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
