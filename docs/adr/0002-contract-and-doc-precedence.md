# ADR 0002. Contract and Documentation Precedence

## 상태

승인됨

## 맥락

요청/응답 shape는 `packages/contracts`, 실제 구현 노출 상태는 Swagger, 저장소 진입 설명은 `README.md`처럼 문서 역할이 이미 나뉘어 있습니다.
하지만 이 우선순위가 문서마다 약하게만 흩어져 있으면 시간이 지날수록 “무엇을 먼저 믿어야 하는가”가 흐려질 수 있습니다.

## 결정

- Web과 API가 함께 쓰는 요청/응답 shape의 1차 기준은 `packages/contracts`로 둡니다.
- 현재 구현된 엔드포인트 목록, DTO validation, 인증 노출 상태의 1차 기준은 Swagger(`/api/docs`)로 둡니다.
- `docs/API.md`는 사람이 빠르게 읽는 API 요약과 인증/쓰기 흐름 설명만 유지합니다.
- `README.md`는 저장소 진입 설명과 빠른 시작만 유지하고, 상세 API 기준 문서 역할은 맡기지 않습니다.
- `docs/VALIDATION_NOTES.md`는 현재 실제 검증 범위와 남은 공백만 유지합니다.
- `docs/PROJECT_PLAN.md`는 중기 로드맵, `PORTFOLIO_ARCHITECTURE_GUIDE.md`는 프로젝트 목적, 판단 원칙, 현재 아키텍처 설명을 유지합니다.
- API shape, validation, env, fallback 정책이 바뀌면 관련 문서를 같은 PR에서 함께 갱신합니다.

## 결과

좋은 점:

- 계약 드리프트가 생겨도 어디서 먼저 확인해야 하는지 즉시 판단할 수 있습니다.
- README, API 문서, 검증 메모, 계획 문서가 서로 역할 충돌을 일으키지 않습니다.
- PR 리뷰에서 문서 누락을 체크하기 쉬워집니다.

비용:

- 작은 변경도 계약, Swagger, 테스트, 문서를 함께 보는 습관이 필요합니다.
- 문서 역할 경계를 지키지 않으면 중복 설명을 의식적으로 정리해야 합니다.

## 후속 원칙

- 공유 요청/응답 shape 변경은 `packages/contracts`부터 시작합니다.
- 구현 변경 후에는 Swagger 노출 상태를 확인합니다.
- 검증 범위가 달라졌다면 `docs/VALIDATION_NOTES.md`를 갱신합니다.
- 이 우선순위 체계 자체가 바뀌면 새 ADR을 추가합니다.
