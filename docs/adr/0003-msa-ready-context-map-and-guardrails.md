# ADR 0003. MSA-Ready Context Map and Guardrails

## 상태

승인됨

## 맥락

이 프로젝트는 실제 마이크로서비스로 운영되는 시스템이 아니라, `실무형 모듈러 모놀리스`를 목표로 하는 포트폴리오입니다.
하지만 포트폴리오 관점에서는 아래 질문에 답할 수 있어야 합니다.

- 왜 지금은 모놀리스가 맞는가
- 나중에 분리한다면 어디부터 나눌 수 있는가
- 어떤 모듈이 어떤 책임을 소유하는가
- 왜 실제 MSA 기술은 아직 도입하지 않았는가

이 기준이 공식적으로 고정되어 있지 않으면, 시간이 지날수록 문서와 코드에서 경계 설명이 흐려지고 “MSA처럼 보이기 위한 구조”가 섞일 위험이 있습니다.

## 결정

- 이 프로젝트는 계속 `하나의 저장소`, `하나의 배포 단위`, `하나의 DB`를 유지하는 모듈러 모놀리스로 둡니다.
- 공식 context map은 아래 여섯 개로 읽습니다.
  - `Identity & Access`
  - `Ledger`
  - `Recurring Automation`
  - `Asset & Coverage`
  - `Insight & Planning`
  - `Platform & Contracts`
- `Ledger`는 계정/카테고리/거래 원장을 소유합니다.
- `Recurring Automation`은 반복규칙을 소유하고, `Ledger`의 참조 상태를 읽을 수 있습니다.
- `Insight & Planning`은 `Ledger`, `Recurring Automation`, `Asset & Coverage`를 읽어 조합하지만 쓰기 규칙을 소유하지 않습니다.
- `Identity & Access`는 인증과 요청 주체 기준선만 제공하는 cross-cutting context로 둡니다.
- `Platform & Contracts`는 공통 인프라와 계약만 소유하고, 비즈니스 규칙을 소유하지 않습니다.
- 여기서 `Ledger`는 현재 코드베이스의 회계 쓰기 컨텍스트 이름이며, 세부 도메인 엔티티/상태/권한 기준은 `docs/domain/business-logic-draft.md`, `docs/domain/core-entity-definition.md`를 우선합니다.

다음은 기본 금지선으로 둡니다.

- `dashboard`, `forecast`가 거래/반복규칙 쓰기 규칙을 직접 소유하지 않습니다.
- 다른 모듈의 `repository`, `adapter`, `controller`를 직접 import하는 것을 기본 규칙으로 삼지 않습니다.
- `packages/contracts`에는 앱 구현 코드나 비즈니스 로직을 넣지 않습니다.
- 메시지 브로커, outbox, gateway, service split은 별도 ADR 없이 도입하지 않습니다.
- 설명 가치가 없는 `shared domain`, `common business` 폴더로 서로 다른 도메인 규칙을 섞지 않습니다.

포트폴리오 설명을 위한 자연스러운 분리 순서는 아래처럼 봅니다.

1. `Ledger`
2. `Recurring Automation`
3. `Insight & Planning`

## 결과

좋은 점:

- 현재 프로젝트가 왜 모놀리스인지와, 나중에 어디서부터 분리 가능한지를 한 번에 설명할 수 있습니다.
- `transactions`, `recurring-rules`, `dashboard`, `forecast`의 역할 차이가 더 선명해집니다.
- 이후 구조 보강이 `의미 있는 경계 강화`인지 `과한 MSA 흉내`인지 판정하기 쉬워집니다.

비용:

- 새로운 구조 시도를 할 때마다 이 context map과 충돌하는지 확인해야 합니다.
- 일부 구현은 편하더라도, 다른 모듈 내부 구현을 직접 참조하는 빠른 우회가 제한됩니다.

## 후속 원칙

- context map이 바뀌면 `PORTFOLIO_ARCHITECTURE_GUIDE.md`와 `docs/ARCHITECTURE.md`를 함께 갱신합니다.
- 서비스 분리, 브로커, outbox, gateway 같은 실제 MSA 기술 도입은 별도 ADR 없이는 진행하지 않습니다.
- `dashboard`, `forecast`를 읽기/조합 컨텍스트 이상으로 확장하려면 먼저 책임 재정의 이유를 문서화합니다.
