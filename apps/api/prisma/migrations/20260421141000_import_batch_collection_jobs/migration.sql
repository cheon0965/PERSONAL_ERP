CREATE TABLE `ImportBatchCollectionJob` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `ledgerId` VARCHAR(191) NOT NULL,
  `importBatchId` VARCHAR(191) NOT NULL,
  `requestedByMembershipId` VARCHAR(191) NOT NULL,
  `status` ENUM('PENDING', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  `requestedRowCount` INTEGER NOT NULL DEFAULT 0,
  `processedRowCount` INTEGER NOT NULL DEFAULT 0,
  `succeededCount` INTEGER NOT NULL DEFAULT 0,
  `failedCount` INTEGER NOT NULL DEFAULT 0,
  `requestPayload` JSON NOT NULL,
  `errorMessage` TEXT NULL,
  `startedAt` DATETIME(3) NULL,
  `finishedAt` DATETIME(3) NULL,
  `heartbeatAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `ImportBatchCollectionJob_tenantId_ledgerId_importBatchId_createdAt_idx`(`tenantId`, `ledgerId`, `importBatchId`, `createdAt`),
  INDEX `ImportBatchCollectionJob_tenantId_ledgerId_status_idx`(`tenantId`, `ledgerId`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ImportBatchCollectionJobRow` (
  `id` VARCHAR(191) NOT NULL,
  `jobId` VARCHAR(191) NOT NULL,
  `importedRowId` VARCHAR(191) NOT NULL,
  `rowNumber` INTEGER NOT NULL,
  `status` ENUM('PENDING', 'RUNNING', 'COLLECTED', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
  `collectedTransactionId` VARCHAR(191) NULL,
  `message` TEXT NULL,
  `startedAt` DATETIME(3) NULL,
  `finishedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `ImportBatchCollectionJobRow_jobId_importedRowId_key`(`jobId`, `importedRowId`),
  INDEX `ImportBatchCollectionJobRow_importedRowId_idx`(`importedRowId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ImportBatchCollectionLock` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `ledgerId` VARCHAR(191) NOT NULL,
  `importBatchId` VARCHAR(191) NOT NULL,
  `jobId` VARCHAR(191) NOT NULL,
  `lockedByMembershipId` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `ImportBatchCollectionLock_tenantId_ledgerId_key`(`tenantId`, `ledgerId`),
  UNIQUE INDEX `ImportBatchCollectionLock_jobId_key`(`jobId`),
  INDEX `ImportBatchCollectionLock_expiresAt_idx`(`expiresAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ImportBatchCollectionJobRow`
  ADD CONSTRAINT `ImportBatchCollectionJobRow_jobId_fkey`
  FOREIGN KEY (`jobId`) REFERENCES `ImportBatchCollectionJob`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
