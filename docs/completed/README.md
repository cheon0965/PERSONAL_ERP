# 완료 문서

이 폴더는 완료된 실행 계획, 단계별 기준선, 완료된 설계 기록을 보관한다.

- 완료 문서는 삭제 대상이 아니라 이력 보존 대상이다.
- 현재 구현 기준이나 정책 판단은 상위 `docs/` 문서를 우선한다.
- 특정 단계의 실행 순서나 당시의 판단 근거가 필요할 때만 참고한다.

## 하위 폴더

- `phase-1/`: 1차 설계와 실행 기준 문서

## 완료 문서

- `ALIGNMENT_PATCH_EXECUTION_PLAN.md`: 내부 정합성 패치와 설계 모델 분리를 완료하고 보관한 실행 계획
- `BUSINESS_FLOW_IMPROVEMENT_EXECUTION_PLAN.md`: 현재 범위 완료 후 보관한 메인 비즈니스 흐름 개선 실행 계획 및 반영 현황
- `IN_REPO_EXECUTION_PLAN.md`: 저장소 안에서 선별한 후속 작업을 모두 완료한 뒤 보관한 실행계획
- `LEGACY_TRANSACTION_REMOVAL_PREP.md`: 구형 `Transaction` 제거 직전 인벤토리, backfill/rollback, 삭제 순서를 남긴 준비 메모
- `LEGACY_TRANSACTION_SCHEMA_REMOVAL_CHECKLIST.md`: 구형 `Transaction` 물리 제거에서 정리한 schema/code touchpoint 체크리스트
- `MONEY_INTEGRITY_EXECUTION_PLAN.md`: `MoneyWon`, 금액 컬럼 `Decimal(19,0)` 승격, exact arithmetic, 금액 raw 연산 가드까지 완료 후 보관한 실행 계획
- `VEHICLE_OPERATIONS_MODEL_PLAN.md`: 차량 운영 모델 분리 작업 완료 후 보관한 설계 문서
