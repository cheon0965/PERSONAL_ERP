CREATE TABLE `CarryForwardRecord` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `ledgerId` VARCHAR(191) NOT NULL,
    `fromPeriodId` VARCHAR(191) NOT NULL,
    `toPeriodId` VARCHAR(191) NOT NULL,
    `sourceClosingSnapshotId` VARCHAR(191) NOT NULL,
    `createdJournalEntryId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdByActorType` ENUM('TENANT_MEMBERSHIP', 'SYSTEM') NOT NULL,
    `createdByMembershipId` VARCHAR(191) NULL,

    UNIQUE INDEX `CarryForwardRecord_fromPeriodId_key`(`fromPeriodId`),
    UNIQUE INDEX `CarryForwardRecord_toPeriodId_key`(`toPeriodId`),
    UNIQUE INDEX `CarryForwardRecord_sourceClosingSnapshotId_key`(`sourceClosingSnapshotId`),
    UNIQUE INDEX `CarryForwardRecord_createdJournalEntryId_key`(`createdJournalEntryId`),
    INDEX `CarryForwardRecord_tenantId_ledgerId_createdAt_idx`(`tenantId`, `ledgerId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CarryForwardRecord`
    ADD CONSTRAINT `CarryForwardRecord_tenantId_fkey`
        FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`)
        ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `CarryForwardRecord`
    ADD CONSTRAINT `CarryForwardRecord_ledgerId_fkey`
        FOREIGN KEY (`ledgerId`) REFERENCES `Ledger`(`id`)
        ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `CarryForwardRecord`
    ADD CONSTRAINT `CarryForwardRecord_fromPeriodId_fkey`
        FOREIGN KEY (`fromPeriodId`) REFERENCES `AccountingPeriod`(`id`)
        ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `CarryForwardRecord`
    ADD CONSTRAINT `CarryForwardRecord_toPeriodId_fkey`
        FOREIGN KEY (`toPeriodId`) REFERENCES `AccountingPeriod`(`id`)
        ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `CarryForwardRecord`
    ADD CONSTRAINT `CarryForwardRecord_sourceClosingSnapshotId_fkey`
        FOREIGN KEY (`sourceClosingSnapshotId`) REFERENCES `ClosingSnapshot`(`id`)
        ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `CarryForwardRecord`
    ADD CONSTRAINT `CarryForwardRecord_createdJournalEntryId_fkey`
        FOREIGN KEY (`createdJournalEntryId`) REFERENCES `JournalEntry`(`id`)
        ON DELETE SET NULL ON UPDATE CASCADE;
