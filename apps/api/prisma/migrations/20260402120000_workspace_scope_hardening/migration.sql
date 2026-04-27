-- 레거시/회계 지원 모델을 필수 워크스페이스 소유권에 맞춥니다.
-- 이 마이그레이션이 NOT NULL 변경에서 실패하면 아직 Tenant/Ledger 소유권이 없는 행을 확인하고
-- phase-1 backbone 백필을 실행합니다.

-- 테이블 변경
ALTER TABLE `InsurancePolicy`
  ADD COLUMN `tenantId` VARCHAR(191) NULL,
  ADD COLUMN `ledgerId` VARCHAR(191) NULL;

-- 테이블 변경
ALTER TABLE `Vehicle`
  ADD COLUMN `tenantId` VARCHAR(191) NULL,
  ADD COLUMN `ledgerId` VARCHAR(191) NULL;

-- 레거시/회계 지원 행의 기존 워크스페이스 소유권을 백필합니다.
UPDATE `Account` AS `a`
SET
  `a`.`tenantId` = COALESCE(
    `a`.`tenantId`,
    (
      SELECT `tm`.`tenantId`
      FROM `TenantMembership` AS `tm`
      WHERE `tm`.`userId` = `a`.`userId`
        AND `tm`.`status` = 'ACTIVE'
      ORDER BY `tm`.`joinedAt` ASC, `tm`.`id` ASC
      LIMIT 1
    )
  ),
  `a`.`ledgerId` = COALESCE(
    `a`.`ledgerId`,
    (
      SELECT COALESCE(
        `t`.`defaultLedgerId`,
        (
          SELECT `l`.`id`
          FROM `Ledger` AS `l`
          WHERE `l`.`tenantId` = `tm`.`tenantId`
          ORDER BY `l`.`createdAt` ASC, `l`.`id` ASC
          LIMIT 1
        )
      )
      FROM `TenantMembership` AS `tm`
      JOIN `Tenant` AS `t`
        ON `t`.`id` = `tm`.`tenantId`
      WHERE `tm`.`userId` = `a`.`userId`
        AND `tm`.`status` = 'ACTIVE'
      ORDER BY `tm`.`joinedAt` ASC, `tm`.`id` ASC
      LIMIT 1
    )
  )
WHERE `a`.`tenantId` IS NULL
   OR `a`.`ledgerId` IS NULL;

UPDATE `Category` AS `c`
SET
  `c`.`tenantId` = COALESCE(
    `c`.`tenantId`,
    (
      SELECT `tm`.`tenantId`
      FROM `TenantMembership` AS `tm`
      WHERE `tm`.`userId` = `c`.`userId`
        AND `tm`.`status` = 'ACTIVE'
      ORDER BY `tm`.`joinedAt` ASC, `tm`.`id` ASC
      LIMIT 1
    )
  ),
  `c`.`ledgerId` = COALESCE(
    `c`.`ledgerId`,
    (
      SELECT COALESCE(
        `t`.`defaultLedgerId`,
        (
          SELECT `l`.`id`
          FROM `Ledger` AS `l`
          WHERE `l`.`tenantId` = `tm`.`tenantId`
          ORDER BY `l`.`createdAt` ASC, `l`.`id` ASC
          LIMIT 1
        )
      )
      FROM `TenantMembership` AS `tm`
      JOIN `Tenant` AS `t`
        ON `t`.`id` = `tm`.`tenantId`
      WHERE `tm`.`userId` = `c`.`userId`
        AND `tm`.`status` = 'ACTIVE'
      ORDER BY `tm`.`joinedAt` ASC, `tm`.`id` ASC
      LIMIT 1
    )
  )
WHERE `c`.`tenantId` IS NULL
   OR `c`.`ledgerId` IS NULL;

UPDATE `Transaction` AS `tx`
SET
  `tx`.`tenantId` = COALESCE(
    `tx`.`tenantId`,
    (
      SELECT `tm`.`tenantId`
      FROM `TenantMembership` AS `tm`
      WHERE `tm`.`userId` = `tx`.`userId`
        AND `tm`.`status` = 'ACTIVE'
      ORDER BY `tm`.`joinedAt` ASC, `tm`.`id` ASC
      LIMIT 1
    )
  ),
  `tx`.`ledgerId` = COALESCE(
    `tx`.`ledgerId`,
    (
      SELECT COALESCE(
        `t`.`defaultLedgerId`,
        (
          SELECT `l`.`id`
          FROM `Ledger` AS `l`
          WHERE `l`.`tenantId` = `tm`.`tenantId`
          ORDER BY `l`.`createdAt` ASC, `l`.`id` ASC
          LIMIT 1
        )
      )
      FROM `TenantMembership` AS `tm`
      JOIN `Tenant` AS `t`
        ON `t`.`id` = `tm`.`tenantId`
      WHERE `tm`.`userId` = `tx`.`userId`
        AND `tm`.`status` = 'ACTIVE'
      ORDER BY `tm`.`joinedAt` ASC, `tm`.`id` ASC
      LIMIT 1
    )
  )
WHERE `tx`.`tenantId` IS NULL
   OR `tx`.`ledgerId` IS NULL;

UPDATE `RecurringRule` AS `rr`
SET
  `rr`.`tenantId` = COALESCE(
    `rr`.`tenantId`,
    (
      SELECT `tm`.`tenantId`
      FROM `TenantMembership` AS `tm`
      WHERE `tm`.`userId` = `rr`.`userId`
        AND `tm`.`status` = 'ACTIVE'
      ORDER BY `tm`.`joinedAt` ASC, `tm`.`id` ASC
      LIMIT 1
    )
  ),
  `rr`.`ledgerId` = COALESCE(
    `rr`.`ledgerId`,
    (
      SELECT COALESCE(
        `t`.`defaultLedgerId`,
        (
          SELECT `l`.`id`
          FROM `Ledger` AS `l`
          WHERE `l`.`tenantId` = `tm`.`tenantId`
          ORDER BY `l`.`createdAt` ASC, `l`.`id` ASC
          LIMIT 1
        )
      )
      FROM `TenantMembership` AS `tm`
      JOIN `Tenant` AS `t`
        ON `t`.`id` = `tm`.`tenantId`
      WHERE `tm`.`userId` = `rr`.`userId`
        AND `tm`.`status` = 'ACTIVE'
      ORDER BY `tm`.`joinedAt` ASC, `tm`.`id` ASC
      LIMIT 1
    )
  )
WHERE `rr`.`tenantId` IS NULL
   OR `rr`.`ledgerId` IS NULL;

UPDATE `InsurancePolicy` AS `ip`
SET
  `ip`.`tenantId` = COALESCE(
    `ip`.`tenantId`,
    (
      SELECT `tm`.`tenantId`
      FROM `TenantMembership` AS `tm`
      WHERE `tm`.`userId` = `ip`.`userId`
        AND `tm`.`status` = 'ACTIVE'
      ORDER BY `tm`.`joinedAt` ASC, `tm`.`id` ASC
      LIMIT 1
    )
  ),
  `ip`.`ledgerId` = COALESCE(
    `ip`.`ledgerId`,
    (
      SELECT COALESCE(
        `t`.`defaultLedgerId`,
        (
          SELECT `l`.`id`
          FROM `Ledger` AS `l`
          WHERE `l`.`tenantId` = `tm`.`tenantId`
          ORDER BY `l`.`createdAt` ASC, `l`.`id` ASC
          LIMIT 1
        )
      )
      FROM `TenantMembership` AS `tm`
      JOIN `Tenant` AS `t`
        ON `t`.`id` = `tm`.`tenantId`
      WHERE `tm`.`userId` = `ip`.`userId`
        AND `tm`.`status` = 'ACTIVE'
      ORDER BY `tm`.`joinedAt` ASC, `tm`.`id` ASC
      LIMIT 1
    )
  )
WHERE `ip`.`tenantId` IS NULL
   OR `ip`.`ledgerId` IS NULL;

UPDATE `Vehicle` AS `v`
SET
  `v`.`tenantId` = COALESCE(
    `v`.`tenantId`,
    (
      SELECT `tm`.`tenantId`
      FROM `TenantMembership` AS `tm`
      WHERE `tm`.`userId` = `v`.`userId`
        AND `tm`.`status` = 'ACTIVE'
      ORDER BY `tm`.`joinedAt` ASC, `tm`.`id` ASC
      LIMIT 1
    )
  ),
  `v`.`ledgerId` = COALESCE(
    `v`.`ledgerId`,
    (
      SELECT COALESCE(
        `t`.`defaultLedgerId`,
        (
          SELECT `l`.`id`
          FROM `Ledger` AS `l`
          WHERE `l`.`tenantId` = `tm`.`tenantId`
          ORDER BY `l`.`createdAt` ASC, `l`.`id` ASC
          LIMIT 1
        )
      )
      FROM `TenantMembership` AS `tm`
      JOIN `Tenant` AS `t`
        ON `t`.`id` = `tm`.`tenantId`
      WHERE `tm`.`userId` = `v`.`userId`
        AND `tm`.`status` = 'ACTIVE'
      ORDER BY `tm`.`joinedAt` ASC, `tm`.`id` ASC
      LIMIT 1
    )
  )
WHERE `v`.`tenantId` IS NULL
   OR `v`.`ledgerId` IS NULL;

-- Tenant/Ledger 소유권이 필수가 되고 워크스페이스 경계에 따라 연쇄 처리되도록
-- 레거시 회계 모델의 외래 키를 다시 구성합니다.
ALTER TABLE `Account`
  DROP FOREIGN KEY `Account_tenantId_fkey`,
  DROP FOREIGN KEY `Account_ledgerId_fkey`;

ALTER TABLE `Category`
  DROP FOREIGN KEY `Category_tenantId_fkey`,
  DROP FOREIGN KEY `Category_ledgerId_fkey`;

ALTER TABLE `Transaction`
  DROP FOREIGN KEY `Transaction_tenantId_fkey`,
  DROP FOREIGN KEY `Transaction_ledgerId_fkey`;

ALTER TABLE `RecurringRule`
  DROP FOREIGN KEY `RecurringRule_tenantId_fkey`,
  DROP FOREIGN KEY `RecurringRule_ledgerId_fkey`;

ALTER TABLE `Account`
  MODIFY `tenantId` VARCHAR(191) NOT NULL,
  MODIFY `ledgerId` VARCHAR(191) NOT NULL;

ALTER TABLE `Category`
  MODIFY `tenantId` VARCHAR(191) NOT NULL,
  MODIFY `ledgerId` VARCHAR(191) NOT NULL;

ALTER TABLE `Transaction`
  MODIFY `tenantId` VARCHAR(191) NOT NULL,
  MODIFY `ledgerId` VARCHAR(191) NOT NULL;

ALTER TABLE `RecurringRule`
  MODIFY `tenantId` VARCHAR(191) NOT NULL,
  MODIFY `ledgerId` VARCHAR(191) NOT NULL;

ALTER TABLE `InsurancePolicy`
  MODIFY `tenantId` VARCHAR(191) NOT NULL,
  MODIFY `ledgerId` VARCHAR(191) NOT NULL;

ALTER TABLE `Vehicle`
  MODIFY `tenantId` VARCHAR(191) NOT NULL,
  MODIFY `ledgerId` VARCHAR(191) NOT NULL;

-- 인덱스 생성
CREATE INDEX `InsurancePolicy_tenantId_ledgerId_isActive_idx`
  ON `InsurancePolicy`(`tenantId`, `ledgerId`, `isActive`);

-- 인덱스 생성
CREATE INDEX `Vehicle_tenantId_ledgerId_name_idx`
  ON `Vehicle`(`tenantId`, `ledgerId`, `name`);

-- 외래 키 추가
ALTER TABLE `Account`
  ADD CONSTRAINT `Account_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `Account`
  ADD CONSTRAINT `Account_ledgerId_fkey`
  FOREIGN KEY (`ledgerId`) REFERENCES `Ledger`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `Category`
  ADD CONSTRAINT `Category_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `Category`
  ADD CONSTRAINT `Category_ledgerId_fkey`
  FOREIGN KEY (`ledgerId`) REFERENCES `Ledger`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `Transaction`
  ADD CONSTRAINT `Transaction_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `Transaction`
  ADD CONSTRAINT `Transaction_ledgerId_fkey`
  FOREIGN KEY (`ledgerId`) REFERENCES `Ledger`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `RecurringRule`
  ADD CONSTRAINT `RecurringRule_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `RecurringRule`
  ADD CONSTRAINT `RecurringRule_ledgerId_fkey`
  FOREIGN KEY (`ledgerId`) REFERENCES `Ledger`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `InsurancePolicy`
  ADD CONSTRAINT `InsurancePolicy_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `InsurancePolicy`
  ADD CONSTRAINT `InsurancePolicy_ledgerId_fkey`
  FOREIGN KEY (`ledgerId`) REFERENCES `Ledger`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `Vehicle`
  ADD CONSTRAINT `Vehicle_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 외래 키 추가
ALTER TABLE `Vehicle`
  ADD CONSTRAINT `Vehicle_ledgerId_fkey`
  FOREIGN KEY (`ledgerId`) REFERENCES `Ledger`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;
