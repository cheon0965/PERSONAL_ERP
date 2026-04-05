# 문서 인덱스

이 폴더는 현재 기준 문서와 이력성 문서를 구분해서 관리한다.

## 먼저 읽을 문서

1. `../README.md`
   저장소 진입점, 빠른 시작, 상위 문서 링크를 확인한다.
2. `domain/README.md`
   도메인 기준 문서의 읽는 순서와 경계를 확인한다.
3. `ARCHITECTURE.md`
   현재 코드베이스 구조와 모듈 경계를 확인한다.
4. `API.md`
   현재 노출된 HTTP surface와 인증 흐름을 빠르게 확인한다.

## 현재 기준 문서

- `API.md`: 구현된 엔드포인트와 인증/쓰기 흐름 요약
- `ARCHITECTURE.md`: 워크스페이스 구조와 컨텍스트 경계
- `SCREEN_FLOW_GUIDE.md`: 현재 화면 기준 운영 흐름과 추천 진행 순서
- `ACCOUNTING_MODEL_BOUNDARY.md`: 레거시 `Transaction`과 신규 회계 흐름 경계 및 제거 로드맵
- `DEVELOPMENT_GUIDE.md`: 구현 순서와 문서 동기화 절차
- `OPERATIONS_CHECKLIST.md`: 배포와 운영 점검 절차
- `ERROR_HANDLING_AND_LOGGING.md`: 예외 처리와 최소 로깅 기준
- `VALIDATION_NOTES.md`: 실제 검증 범위와 남은 공백
- `PROJECT_PLAN.md`: 중기 제품 로드맵
- `ASVS_L2_EXECUTION_PLAN.md`: 보안 기준 실행 계획
- `ASVS_L2_BASELINE_MATRIX.md`: 보안 기준선과 근거 매트릭스
- `FALLBACK_POLICY.md`: 데모 fallback 사용 기준
- `DESIGN_SYSTEM.md`: UI 기준
- `domain/`: 도메인 기준 문서
- `adr/`: 장기 구조 결정을 기록한 ADR

## 아카이브

- `archive/`: 이미 수행했거나 특정 단계의 실행 기준으로 사용했던 문서를 보관한다.
- `archive/BUSINESS_FLOW_IMPROVEMENT_EXECUTION_PLAN.md`: 완료된 메인 비즈니스 흐름 고도화 실행 계획 및 반영 현황
- 아카이브 문서는 배경 맥락과 의사결정 이력을 남기기 위한 용도이며, 현재 기준 문서를 대체하지 않는다.

현재 `phase-1` 실행 계획 문서는 `archive/phase-1/`로 분리해 두었다.
