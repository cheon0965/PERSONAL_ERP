-- 계좌/카드 기초 잔액 업로드를 위한 명시적 생명주기 표시를 추가합니다.
ALTER TABLE `Account`
  ADD COLUMN `bootstrapStatus` ENUM('NOT_REQUIRED', 'PENDING', 'COMPLETED') NOT NULL DEFAULT 'NOT_REQUIRED';
