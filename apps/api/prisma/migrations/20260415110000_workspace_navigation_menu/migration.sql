CREATE TABLE `WorkspaceNavigationMenuItem` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `parentId` VARCHAR(191) NULL,
  `key` VARCHAR(100) NOT NULL,
  `itemType` ENUM('GROUP', 'PAGE') NOT NULL DEFAULT 'PAGE',
  `label` VARCHAR(100) NOT NULL,
  `description` VARCHAR(191) NULL,
  `href` VARCHAR(300) NULL,
  `iconKey` VARCHAR(50) NULL,
  `matchMode` ENUM('EXACT', 'PREFIX') NOT NULL DEFAULT 'PREFIX',
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `isVisible` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `WorkspaceNavigationMenuItem_tenantId_key_key`(`tenantId`, `key`),
  INDEX `WorkspaceNavigationMenuItem_tenantId_parentId_sortOrder_idx`(`tenantId`, `parentId`, `sortOrder`),
  INDEX `WorkspaceNavigationMenuItem_tenantId_isVisible_idx`(`tenantId`, `isVisible`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WorkspaceNavigationMenuRole` (
  `id` VARCHAR(191) NOT NULL,
  `menuItemId` VARCHAR(191) NOT NULL,
  `role` ENUM('OWNER', 'MANAGER', 'EDITOR', 'VIEWER') NOT NULL,

  UNIQUE INDEX `WorkspaceNavigationMenuRole_menuItemId_role_key`(`menuItemId`, `role`),
  INDEX `WorkspaceNavigationMenuRole_role_idx`(`role`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `WorkspaceNavigationMenuItem`
  ADD CONSTRAINT `WorkspaceNavigationMenuItem_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `WorkspaceNavigationMenuItem`
  ADD CONSTRAINT `WorkspaceNavigationMenuItem_parentId_fkey`
  FOREIGN KEY (`parentId`) REFERENCES `WorkspaceNavigationMenuItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `WorkspaceNavigationMenuRole`
  ADD CONSTRAINT `WorkspaceNavigationMenuRole_menuItemId_fkey`
  FOREIGN KEY (`menuItemId`) REFERENCES `WorkspaceNavigationMenuItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
