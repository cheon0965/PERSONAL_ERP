ALTER TABLE `PeriodStatusHistory`
  ADD COLUMN `eventType` ENUM(
    'OPEN',
    'MOVE_TO_REVIEW',
    'START_CLOSING',
    'LOCK',
    'REOPEN',
    'FORCE_LOCK'
  ) NOT NULL DEFAULT 'OPEN' AFTER `toStatus`;
