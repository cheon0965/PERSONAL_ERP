# 문서 인덱스

이 폴더는 현재 기준 문서와 이력성 문서를 구분해서 관리합니다.
현재 구현 범위, 운영 흐름, 아키텍처, API, 검증 기준을 먼저 읽고, 완료 문서는 배경 맥락과 실행 이력을 확인할 때만 내려갑니다.

## 먼저 읽을 문서

1. `../README.md`
   저장소 진입점, 빠른 시작, 주요 명령, 상위 문서 링크를 확인합니다.
2. `CURRENT_CAPABILITIES.md`
   현재 코드베이스에 실제로 구현된 기능과 운영 지원 범위를 한 번에 확인합니다.
3. `DEMO_GUIDE.md`
   데모 계정 기준 월 운영 사이클과 추천 화면 순서를 확인합니다.
4. `ARCHITECTURE.md`
   워크스페이스 구조, 모듈 경계, 컨텍스트 지도를 확인합니다.
5. `API.md`
   현재 노출된 HTTP surface와 인증/쓰기 흐름을 빠르게 확인합니다.

## 현재 기준 문서

### 제품 현재 상태

- `CURRENT_CAPABILITIES.md`: 현재 구현된 화면, API 모듈, 운영 지원 기능, 검증 가드 요약
- `DEMO_GUIDE.md`: 데모 계정 기준 월 운영 한 사이클과 추천 메뉴 진행 순서
- `ACCOUNTING_MODEL_BOUNDARY.md`: 레거시 `Transaction` 제거 이후 회계 경계와 현재 기준 원장
- 최신 진행월 기준 월 운영 정책, 업로드 배치 bootstrap, 차량 운영비 회계 연동 기준은 `CURRENT_CAPABILITIES.md`, `DEMO_GUIDE.md`, `API.md`, `domain/business-logic-draft.md`, `domain/core-entity-definition.md`를 우선합니다.

### 아키텍처와 도메인

- `ARCHITECTURE.md`: 워크스페이스 구조와 컨텍스트 경계
- `domain/README.md`: 도메인 기준 문서 읽는 순서와 경계
- `domain/business-logic-draft.md`: 운영 사이클, 상태, 권한 정책 상위 기준
- `domain/core-entity-definition.md`: 핵심 엔티티, 불변조건, 관계, 구현 우선순위
- `adr/`: 장기 구조 결정을 기록한 ADR

### 개발, 운영, 품질

- `API.md`: 구현된 엔드포인트와 인증/쓰기 흐름 요약
- `DEVELOPMENT_GUIDE.md`: 구현 순서와 문서 동기화 절차
- `OPERATIONS_CHECKLIST.md`: 배포, 수동 스모크 체크, 운영 장애 대응 절차
- `ERROR_HANDLING_AND_LOGGING.md`: 예외 처리와 최소 로깅 기준
- `VALIDATION_NOTES.md`: 실제 검증 범위와 남은 공백
- `PROJECT_PLAN.md`: 중기 제품 로드맵
- `FALLBACK_POLICY.md`: demo fallback 사용 기준
- `DESIGN_SYSTEM.md`: UI 기준

### 보안 기준

- `ASVS_L2_EXECUTION_PLAN.md`: 보안 기준 실행 계획
- `ASVS_L2_BASELINE_MATRIX.md`: 보안 기준선과 근거 매트릭스

## 완료 문서

- [`completed/README.md`](./completed/README.md): 완료된 실행 계획, 설계 기록, 단계별 기준선 인덱스
- `completed/`: 이미 수행했거나 특정 단계의 실행 기준으로 사용했던 이력성 문서를 보관합니다.

완료 문서는 배경 맥락과 의사결정 이력을 남기기 위한 용도이며, 현재 기준 문서를 대체하지 않습니다.
