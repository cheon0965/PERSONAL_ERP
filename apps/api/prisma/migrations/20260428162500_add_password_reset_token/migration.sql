-- AlterTable
ALTER TABLE `Account` ALTER COLUMN `normalizedName` DROP DEFAULT;

-- AlterTable
ALTER TABLE `AuthSession` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `Category` ALTER COLUMN `normalizedName` DROP DEFAULT;

-- AlterTable
ALTER TABLE `FinancialStatementSnapshot` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `ImportBatch` MODIFY `sourceKind` ENUM('CARD_EXCEL', 'BANK_CSV', 'MANUAL_UPLOAD', 'IM_BANK_PDF', 'WOORI_BANK_HTML') NOT NULL;

-- AlterTable
ALTER TABLE `InsurancePolicy` ALTER COLUMN `normalizedProvider` DROP DEFAULT,
    ALTER COLUMN `normalizedProductName` DROP DEFAULT;

-- AlterTable
ALTER TABLE `PeriodStatusHistory` ALTER COLUMN `eventType` DROP DEFAULT;

-- AlterTable
ALTER TABLE `Vehicle` ALTER COLUMN `normalizedName` DROP DEFAULT;

-- CreateTable
CREATE TABLE `PasswordResetToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PasswordResetToken_tokenHash_key`(`tokenHash`),
    INDEX `PasswordResetToken_userId_expiresAt_idx`(`userId`, `expiresAt`),
    INDEX `PasswordResetToken_userId_consumedAt_idx`(`userId`, `consumedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PasswordResetToken` ADD CONSTRAINT `PasswordResetToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
