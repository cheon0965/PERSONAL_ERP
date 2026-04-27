-- 애플리케이션이 임시 Prisma 브리지 모델을 더 이상 노출하지 않게 된 뒤
-- 폐기된 레거시 Transaction 테이블을 제거합니다.
DROP TABLE `Transaction`;
