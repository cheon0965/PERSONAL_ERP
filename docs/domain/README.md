# 도메인 기준 문서

이 폴더는 비즈니스 로직과 핵심 도메인 모델의 기준 문서를 보관한다.

## 읽는 순서

1. `business-logic-draft.md`
   운영 사이클, 권한 모델, 주요 회계 정책, 상태 정의, 아키텍처 선택 근거를 먼저 확인한다.
2. `core-entity-definition.md`
   엔티티 책임, Aggregate Root, 불변조건, 관계, 구현 우선순위를 상세 기준으로 확인한다.

## 문서 역할

- `README.md`: 저장소 진입 설명, 빠른 시작, 상위 문서 맵을 제공한다.
- `docs/domain/README.md`: 도메인 기준 문서의 진입점과 읽는 순서를 제공한다.
- `docs/domain/business-logic-draft.md`: 비즈니스 로직의 시작/끝, 운영 흐름, 권한, 회계 정책의 상위 기준을 유지한다.
- `docs/domain/core-entity-definition.md`: 엔티티 책임, 불변조건, 관계, 구현 우선순위의 상세 기준을 유지한다.
- `docs/ARCHITECTURE.md`: 현재 코드베이스 구조와 모듈 경계를 설명한다.
- `docs/API.md`: API 계약과 인증/쓰기 흐름 요약을 유지한다.
- `docs/PROJECT_PLAN.md`: 중기 로드맵을 유지한다.
- `docs/adr/`: 장기 구조 결정을 기록한다.
- `docs/DEVELOPMENT_GUIDE.md`: 구현 전 확인 순서와 문서 동기화 절차를 유지한다.

## 사용 방식

- 비즈니스 로직, 유스케이스, 상태 흐름, DB 모델링 논의 전 이 폴더의 문서를 먼저 기준으로 본다.
- 루트 문서 진입은 `README.md`에서 시작하고, 도메인 기준 확인은 이 폴더에서 시작한다.
- 구현이 기준과 달라지면 관련 PR에서 이 폴더 문서도 함께 갱신한다.
