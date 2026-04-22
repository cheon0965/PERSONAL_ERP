-- Add an explicit lifecycle marker for account/card opening-balance uploads.
ALTER TABLE `Account`
  ADD COLUMN `bootstrapStatus` ENUM('NOT_REQUIRED', 'PENDING', 'COMPLETED') NOT NULL DEFAULT 'NOT_REQUIRED';
