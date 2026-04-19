ALTER TABLE `User` ADD COLUMN `isSystemAdmin` BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX `User_isSystemAdmin_idx` ON `User`(`isSystemAdmin`);
