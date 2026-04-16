# 완료 문서

이 폴더는 완료된 실행 계획, 단계별 기준선, 완료된 설계 기록을 보관한다.

- 완료 문서는 삭제 대상이 아니라 이력 보존 대상이다.
- 현재 구현 기준이나 정책 판단은 상위 `docs/` 문서를 우선한다.
- 특정 단계의 실행 순서나 당시의 판단 근거가 필요할 때만 참고한다.
- 같은 주제의 문서가 상위 `docs/`에도 있더라도, 그 문서가 `current-baseline` 또는 현재 운영 기준 문서라면 이동 대상이 아니라 현재 기준 문서로 유지한다.

## 하위 폴더

- [`phase-1/`](./phase-1/README.md): 1차 설계와 실행 기준 문서

## 완료 문서

- [`ALIGNMENT_PATCH_EXECUTION_PLAN.md`](./ALIGNMENT_PATCH_EXECUTION_PLAN.md): 내부 정합성 패치와 설계 모델 분리를 완료하고 보관한 실행 계획
- [`ADMIN_MEMBER_LOG_MANAGEMENT_PLAN.md`](./ADMIN_MEMBER_LOG_MANAGEMENT_PLAN.md): workspace-scoped 관리자 회원관리, 감사 로그, 초대 수락 흐름, 공통 감사 저장 경계를 완료하고 보관한 실행 계획
- [`AUTH_REGISTRATION_GMAIL_PLAN.md`](./AUTH_REGISTRATION_GMAIL_PLAN.md): 회원가입, 이메일 인증, Gmail API/console mail sender 경계, Web 가입/인증 화면, 관련 테스트와 문서 동기화를 완료하고 보관한 실행 계획
- [`BUSINESS_FLOW_IMPROVEMENT_EXECUTION_PLAN.md`](./BUSINESS_FLOW_IMPROVEMENT_EXECUTION_PLAN.md): 현재 범위 완료 후 보관한 메인 비즈니스 흐름 개선 실행 계획 및 반영 현황
- [`CONCURRENCY_AND_IDEMPOTENCY_EXECUTION_PLAN.md`](./CONCURRENCY_AND_IDEMPOTENCY_EXECUTION_PLAN.md): 전표 번호 allocator, 업로드 행 흡수 claim, 계획 항목 DB 멱등화, 주요 마스터 normalized unique까지 반영 후 보관한 실행 계획
- [`IN_REPO_EXECUTION_PLAN.md`](./IN_REPO_EXECUTION_PLAN.md): 저장소 안에서 선별한 후속 작업을 모두 완료한 뒤 보관한 실행계획
- [`LEGACY_TRANSACTION_REMOVAL_PREP.md`](./LEGACY_TRANSACTION_REMOVAL_PREP.md): 구형 `Transaction` 제거 직전 인벤토리, backfill/rollback, 삭제 순서를 남긴 준비 메모
- [`LEGACY_TRANSACTION_SCHEMA_REMOVAL_CHECKLIST.md`](./LEGACY_TRANSACTION_SCHEMA_REMOVAL_CHECKLIST.md): 구형 `Transaction` 물리 제거에서 정리한 schema/code touchpoint 체크리스트
- [`MONEY_INTEGRITY_EXECUTION_PLAN.md`](./MONEY_INTEGRITY_EXECUTION_PLAN.md): `MoneyWon`, 금액 컬럼 `Decimal(19,0)` 승격, exact arithmetic, 금액 raw 연산 가드까지 완료 후 보관한 실행 계획
- [`OPERATIONS_SUPPORT_SURFACES_EXECUTION_PLAN.md`](./OPERATIONS_SUPPORT_SURFACES_EXECUTION_PLAN.md): 사업장 설정, 내 계정/보안, 권한 정책 요약, 운영 허브/체크리스트/예외/마감/업로드 현황, 시스템 상태/알림, 수동 CSV 반출, 운영 메모/인수인계까지 완료 후 보관한 실행 계획
- [`REFACTORING_EXECUTION_PLAN.md`](./REFACTORING_EXECUTION_PLAN.md): P0/P1 모듈 Hexagonal 승격, operations-console read-model 분리, Web 대형 파일 분해, auth/admin use-case 완전 분리를 포함한 프로젝트 전반 리팩토링 실행 계획을 완료 후 보관
- [`REFACTORING_ROADMAP.md`](./REFACTORING_ROADMAP.md): 대형 테스트, API mock/state, 서비스/UI 파일 분리 3단계 리팩토링 완료 후 보관한 실행 로드맵
- [`UI_REORGANIZATION_EXECUTION_PLAN.md`](./UI_REORGANIZATION_EXECUTION_PLAN.md): 1차 ERP 화면 가시성, 헤더 구조, 내비게이션 통일, 화면 밀도 재정리를 완료하고 보관한 실행 계획
- [`UI_REORGANIZATION_EXECUTION_PLAN_V2.md`](./UI_REORGANIZATION_EXECUTION_PLAN_V2.md): 2차 화면 책임 분리, 라우트 재조정, DB 메뉴 트리 기반 정보구조, 간결 화면/도메인 가이드 원칙을 완료하고 보관한 실행 계획
- [`VEHICLE_OPERATIONS_MODEL_PLAN.md`](./VEHICLE_OPERATIONS_MODEL_PLAN.md): 차량 운영 모델 분리 작업 완료 후 보관한 설계 문서
