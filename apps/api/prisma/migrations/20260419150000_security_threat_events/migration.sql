CREATE TABLE `SecurityThreatEvent` (
  `id` VARCHAR(191) NOT NULL,
  `severity` VARCHAR(30) NOT NULL,
  `eventCategory` VARCHAR(50) NOT NULL,
  `eventName` VARCHAR(100) NOT NULL,
  `source` VARCHAR(50) NOT NULL DEFAULT 'api',
  `requestId` VARCHAR(191) NULL,
  `path` VARCHAR(300) NULL,
  `clientIpHash` VARCHAR(191) NULL,
  `userId` VARCHAR(191) NULL,
  `sessionId` VARCHAR(191) NULL,
  `reason` VARCHAR(191) NULL,
  `metadata` JSON NULL,
  `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `SecurityThreatEvent_occurredAt_idx` ON `SecurityThreatEvent`(`occurredAt`);
CREATE INDEX `SecurityThreatEvent_severity_occurredAt_idx` ON `SecurityThreatEvent`(`severity`, `occurredAt`);
CREATE INDEX `SecurityThreatEvent_eventCategory_occurredAt_idx` ON `SecurityThreatEvent`(`eventCategory`, `occurredAt`);
CREATE INDEX `SecurityThreatEvent_eventName_occurredAt_idx` ON `SecurityThreatEvent`(`eventName`, `occurredAt`);
CREATE INDEX `SecurityThreatEvent_clientIpHash_occurredAt_idx` ON `SecurityThreatEvent`(`clientIpHash`, `occurredAt`);
CREATE INDEX `SecurityThreatEvent_requestId_idx` ON `SecurityThreatEvent`(`requestId`);
