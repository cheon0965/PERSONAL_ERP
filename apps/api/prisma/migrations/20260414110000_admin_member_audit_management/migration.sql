CREATE TABLE `TenantMembershipInvitation` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `normalizedEmail` VARCHAR(191) NOT NULL,
  `role` ENUM('OWNER', 'MANAGER', 'EDITOR', 'VIEWER') NOT NULL,
  `tokenHash` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `acceptedAt` DATETIME(3) NULL,
  `revokedAt` DATETIME(3) NULL,
  `invitedByMembershipId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `TenantMembershipInvitation_tokenHash_key`(`tokenHash`),
  INDEX `TenantMembershipInvitation_tenantId_normalizedEmail_idx`(`tenantId`, `normalizedEmail`),
  INDEX `TenantMembershipInvitation_tenantId_expiresAt_idx`(`tenantId`, `expiresAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WorkspaceAuditEvent` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `ledgerId` VARCHAR(191) NULL,
  `actorUserId` VARCHAR(191) NULL,
  `actorMembershipId` VARCHAR(191) NULL,
  `actorRole` VARCHAR(50) NULL,
  `eventCategory` VARCHAR(50) NOT NULL,
  `eventName` VARCHAR(100) NOT NULL,
  `action` VARCHAR(100) NULL,
  `resourceType` VARCHAR(100) NULL,
  `resourceId` VARCHAR(191) NULL,
  `result` VARCHAR(30) NOT NULL,
  `reason` VARCHAR(191) NULL,
  `requestId` VARCHAR(191) NULL,
  `path` VARCHAR(300) NULL,
  `clientIpHash` VARCHAR(191) NULL,
  `metadata` JSON NULL,
  `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `WorkspaceAuditEvent_tenantId_occurredAt_idx`(`tenantId`, `occurredAt`),
  INDEX `WorkspaceAuditEvent_tenantId_eventCategory_occurredAt_idx`(`tenantId`, `eventCategory`, `occurredAt`),
  INDEX `WorkspaceAuditEvent_tenantId_action_occurredAt_idx`(`tenantId`, `action`, `occurredAt`),
  INDEX `WorkspaceAuditEvent_tenantId_actorMembershipId_occurredAt_idx`(`tenantId`, `actorMembershipId`, `occurredAt`),
  INDEX `WorkspaceAuditEvent_tenantId_requestId_idx`(`tenantId`, `requestId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
