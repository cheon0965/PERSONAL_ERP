ALTER TABLE `User`
  ADD COLUMN `emailVerifiedAt` DATETIME(3) NULL;

UPDATE `User`
SET `emailVerifiedAt` = `createdAt`
WHERE `emailVerifiedAt` IS NULL;

CREATE TABLE `EmailVerificationToken` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `tokenHash` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `consumedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `EmailVerificationToken_tokenHash_key`(`tokenHash`),
  INDEX `EmailVerificationToken_userId_expiresAt_idx`(`userId`, `expiresAt`),
  INDEX `EmailVerificationToken_userId_consumedAt_idx`(`userId`, `consumedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `EmailVerificationToken`
  ADD CONSTRAINT `EmailVerificationToken_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
