# PERSONAL_ERP Portfolio Architecture Guide

## 이 문서는 무엇인가

이 문서는 이 프로젝트의 작업 목록을 적어두는 TODO 문서가 아니다.
이 프로젝트가 어떤 목적을 가진 포트폴리오인지, 왜 이런 판단을 했는지, 그리고 현재 코드가 그 목적에 얼마나 잘 맞는지를 설명하는 아키텍처 안내서다.

짧게 말하면 이 프로젝트는 `실무형 모듈러 모놀리스`를 기반으로 하고, `핵심 도메인에만 선택적으로 clean/hexagonal 성향`을 적용한 1인 사업자·소상공인용 월별 재무 운영 시스템 포트폴리오다.

## 초보자용 3줄 요약

1. 이 프로젝트는 Web, API, Contracts를 나눈 `모듈러 모놀리스`다.
2. 모든 곳을 복잡하게 분리하지 않고, `거래`와 `반복규칙`처럼 중요한 쓰기 모델에만 경계를 더 엄격하게 세웠다.
3. 목표는 “패턴을 많이 쓴 프로젝트”가 아니라 “왜 이 구조를 선택했는지 설명할 수 있는 프로젝트”다.

## 이 프로젝트가 증명하려는 것

- 1인 개발로도 끝까지 완성 가능한 구조 판단을 할 수 있다.
- 협업을 고려해 기능 경계, 계약, 테스트, 문서 우선순위를 설계할 수 있다.
- 클린 아키텍처를 맹목적으로 적용하지 않고, 필요한 곳에만 선택적으로 적용할 수 있다.
- 외부 의존성은 명확히 다루되, 프로젝트 내부까지 과하게 DI하지 않는 절제된 설계를 할 수 있다.

## 이 프로젝트의 핵심 판단 원칙

| 판단 원칙                        | 쉬운 설명                                                                     | 이 프로젝트에서의 적용                                            |
| -------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 목적이 먼저다                    | “멋있어 보이는 구조”보다 “무엇을 증명할 것인가”를 먼저 본다                   | 포트폴리오 메시지를 더 선명하게 만들 때만 구조를 바꾼다           |
| 설명 가능해야 한다               | 왜 이렇게 했는지 초보자에게도 설명할 수 있어야 한다                           | `Collected Transactions`, `Recurring Rules`만 선택적으로 강화했다 |
| 외부는 명확하게, 내부는 단순하게 | DB, JWT, 시간 같은 바깥 경계만 엄격히 다루고 내부 호출은 과하게 쪼개지 않는다 | port/adapter는 외부 기술 경계에만 최소한으로 사용한다             |
| 실무형이어야 한다                | 제품 완성과 운영을 밀어내는 과설계는 피한다                                   | P0~P3까지만 반영하고, P4 이벤트 계약은 의도적으로 보류했다        |
| 테스트와 문서가 함께 간다        | 코드만 바뀌는 구조 개편은 불완전하다                                          | 요청 단위 테스트, use-case 테스트, 문서 동기화를 같이 유지한다    |

## 용어를 쉬운 말로 바꾸면

- `모듈러 모놀리스`
  하나의 저장소와 하나의 배포 단위 안에 있지만, 기능별 경계가 분명한 구조
- `shared contracts`
  Web과 API가 같은 요청/응답 타입을 함께 쓰는 방식
- `selective clean/hexagonal`
  모든 모듈을 똑같이 바꾸지 않고, 중요한 곳에만 use-case/port/adapter 경계를 도입하는 방식
- `external dependency boundary`
  DB, JWT, argon2, 시간 공급처럼 “프로젝트 바깥 기술”과 만나는 지점

## 한눈에 보는 현재 구조

```text
apps/
  web/         -> Next.js App Router 기반 프런트엔드
  api/         -> NestJS + Prisma 기반 백엔드
packages/
  contracts/   -> Web/API 공유 타입 계약
docs/          -> 개발, 운영, ADR, 아키텍처 문서
```

```text
[ Next.js Web ]
      |
      | REST + shared contracts
      v
[ NestJS API ]
      |
      | Prisma
      v
[ MySQL ]
```

## 현재 아키텍처를 한 문장으로 정의하면

`기본은 레이어드 모듈 구조를 유지하고, 핵심 쓰기 모델에서만 use-case/port/adapter 경계를 추가한 실무형 모듈러 모놀리스`

## MSA-ready Context Map

중요한 점은 이것이다.  
이 context map은 `서비스 분리 설계도`가 아니라 `책임 지도`다.

즉, 지금도 여전히 이 프로젝트는 아래 기준을 유지한다.

- 하나의 저장소
- 하나의 배포 단위
- 하나의 DB
- 빠른 로컬 개발 루프

대신 “나중에 분리한다면 어디를 기준으로 나눌 수 있는가”를 지금부터 설명 가능한 상태로 고정한다.

```text
[ Platform & Contracts ] -> 모든 컨텍스트의 계약/공통 인프라 지원
[ Identity & Access ] -> 모든 컨텍스트의 인증/요청 주체 기준선

[ Recurring Automation ] -- reference only --> [ Ledger ]
[ Ledger ] -------------------- read -------> [ Insight & Planning ]
[ Recurring Automation ] ------- read ------> [ Insight & Planning ]
[ Asset & Coverage ] ----------- read ------> [ Insight & Planning ]
```

| Context              | 현재 모듈                                                                                                                                                                                                                                   | 소유 책임                                                     | 읽기/쓰기 성격     | 나중에 분리한다면                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------ | --------------------------------- |
| Identity & Access    | `auth`, `common/auth`                                                                                                                                                                                                                       | 로그인, 토큰, 요청 주체 인증 경계                             | cross-cutting      | 공통 인증 계층                    |
| Ledger               | `funding-accounts`, `categories`, `account-subjects`, `ledger-transaction-types`, `reference-data-readiness`, `accounting-periods`, `collected-transactions`, `journal-entries`, `import-batches`, `financial-statements`, `carry-forwards` | 기준 데이터, 월 운영, 수집/전표, 업로드, 공식 보고, 차기 이월 | 핵심 쓰기          | 가장 강한 후보                    |
| Recurring Automation | `recurring-rules`, `plan-items`                                                                                                                                                                                                             | 반복규칙 정의, 계획 항목 생성과 추적성                        | 쓰기 + Ledger 참조 | Ledger 다음 후보                  |
| Asset & Coverage     | `vehicles`, `insurance-policies`                                                                                                                                                                                                            | 운영비 성격의 자산/보장 도메인                                | 현재는 조회 중심   | 별도 도메인 후보                  |
| Insight & Planning   | `dashboard`, `forecast`                                                                                                                                                                                                                     | 여러 컨텍스트를 읽어 요약/예측                                | 읽기/조합 중심     | 나중에 BFF 또는 read service 후보 |
| Platform & Contracts | `packages/contracts`, env, Prisma, health, 공통 외부 의존성 조립                                                                                                                                                                            | 계약 원천, 런타임 기반선                                      | 지원 계층          | 공통 플랫폼 성격                  |

여기서 `Ledger`는 현재 코드베이스의 컨텍스트 이름입니다.  
현재 API 모듈명은 `funding-accounts`, `accounting-periods`, `collected-transactions`, `import-batches`, `journal-entries`, `financial-statements`, `carry-forwards`, `plan-items` 등이 있고, Web 화면/라우트는 사용자 경험 관점의 shorthand로 `transactions`, `periods`, `imports`, `reference-data` 등을 함께 사용합니다.  
회계 도메인의 상세 엔티티/상태/권한 기준은 `docs/domain/business-logic-draft.md`, `docs/domain/core-entity-definition.md`를 우선합니다.

면접이나 포트폴리오 설명에서는 이렇게 정리하면 된다.

- 지금은 `모듈러 모놀리스`가 맞다.
- 하지만 경계는 이미 `Ledger`, `Recurring Automation`, `Insight & Planning` 기준으로 읽히게 설계했다.
- 따라서 실제 MSA로 가지 않더라도 `MSA-ready 판단`은 설명할 수 있다.

## 여기서 고정하는 금지선

### 허용되는 의존 방향

- Web은 HTTP와 `packages/contracts`를 통해서만 API와 연결한다.
- `Identity & Access`는 인증과 요청 주체 기준선만 제공하고, 다른 비즈니스 도메인의 규칙 소유자가 되지 않는다.
- `Recurring Automation`은 `Ledger`의 계정/카테고리 참조 상태를 읽을 수 있다.
- `Insight & Planning`은 `Ledger`, `Recurring Automation`, `Asset & Coverage`를 읽어 요약과 예측을 만든다.
- `Platform & Contracts`는 공통 인프라와 계약을 제공하지만 도메인 규칙을 소유하지 않는다.

### 금지되는 직접 참조

- `dashboard`, `forecast`는 `collected-transactions`, `recurring-rules`의 생성/검증 규칙을 직접 소유하지 않는다.
- 어떤 모듈도 다른 모듈의 `repository`, `adapter`, `controller`를 직접 import하는 것을 기본 규칙으로 삼지 않는다.
- `packages/contracts`에는 앱 전용 구현 코드나 비즈니스 로직을 넣지 않는다.
- 새로운 메시지 브로커, outbox, gateway, service split은 별도 ADR 없이 도입하지 않는다.
- 설명 가치가 없는 `shared domain`, `common business` 폴더로 서로 다른 도메인 규칙을 섞지 않는다.

### 왜 이 금지선이 중요한가

- 경계가 문서에만 있고 코드에서는 무너지는 상황을 막을 수 있다.
- 과한 MSA 흉내 없이도 “어디까지 준비돼 있는가”를 분명하게 보여줄 수 있다.
- 이후 P1, P2 작업이 `의미 있는 경계 강화`인지 `보기 좋은 추상화`인지 쉽게 판정할 수 있다.

## 현재 코드가 실제로 어떻게 구성되어 있는가

### 1. Web은 `app / features / shared` 구조를 사용한다

- `app/`은 라우팅과 페이지 엔트리를 담당한다.
- `features/`는 기능별 화면과 API 호출 로직을 묶는다.
- `shared/`는 공용 UI, 인증 상태, fetch helper, 레이아웃, theme를 담당한다.

이 구조는 프런트엔드에서 지나친 아키텍처 실험보다 `기능 응집도`와 `재사용 가능한 공통 계층`을 우선한 선택이다.

### 2. API는 기본적으로 기능별 모듈 구조를 사용한다

대부분의 모듈은 아래 흐름을 따른다.

```text
controller -> service -> repository -> mapper/calculator
```

이 구조는 `funding-accounts`, `categories`, `reference-data-readiness`, `vehicles`, `insurance-policies`, `auth`, `accounting-periods`, `journal-entries`, `dashboard`, `forecast` 같은 영역에서 여전히 유효하다.
특히 CRUD 성격이 강하거나, 계산 로직만 분리하면 충분한 영역에서는 이 방식이 더 읽기 쉽고 유지보수도 쉽다.

### 3. 핵심 쓰기 모델만 선택적으로 더 엄격한 구조를 쓴다

`collected-transactions`와 `recurring-rules`는 현재 아래 흐름을 사용한다.

```text
controller -> use-case -> port -> adapter
```

그리고 내부 규칙은 별도 `domain` 파일이나 순수 함수로 분리한다.

이렇게 한 이유는 간단하다.

- 두 모듈은 프로젝트의 핵심 쓰기 모델이다.
- 접근 범위 검증, 입력 규칙, 생성 흐름이 중요하다.
- 테스트와 설명 가치가 높다.
- 다른 모든 모듈에 같은 복잡도를 강요할 필요는 없다.

### 4. 대상 모듈은 `public.ts`를 공식 공개 경계로 둔다

`collected-transactions`, `recurring-rules`, `dashboard`, `forecast`는 이제 모듈 바깥에서
직접 내부 파일을 가져다 쓰지 않고 각 모듈의 `public.ts`를 통해서만 접근한다.

이 선택의 의미는 단순하다.

- `collected-transactions.module.ts`, `dashboard-read.service.ts` 같은 파일은 내부 구현이다.
- 모듈 조립이나 미래의 확장 포인트는 `public.ts`를 기준으로 설명한다.
- 아직 facade, interface, token을 과하게 늘리지 않고도 “공개 경계”를 코드에서 보여줄 수 있다.

## 현재 구조를 영역별로 평가하면

| 영역                                                                  | 현재 구조                                                    | 왜 이렇게 두었나                                            | 목적 부합도 |
| --------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------- | ----------- |
| Web                                                                   | `app / features / shared` + Provider 패턴                    | 화면 개발과 사용자 흐름이 중심이기 때문                     | 매우 부합   |
| Contracts                                                             | `packages/contracts` 단일 계약 원천                          | Web/API 계약 충돌을 줄이기 위해                             | 매우 부합   |
| Funding Accounts / Categories / Reference Data / Vehicles / Insurance | controller-service-repository-mapper                         | 규칙보다 CRUD 성격이 더 강함                                | 매우 부합   |
| Collected Transactions                                                | use-case/port/adapter + pure policy                          | 핵심 쓰기 모델, 설명 가치와 테스트 가치가 큼                | 매우 부합   |
| Recurring Rules                                                       | use-case/port/adapter + 최소 recurrence policy               | Collected Transactions 패턴을 재사용하면서도 과설계는 피함  | 매우 부합   |
| Dashboard / Forecast                                                  | read service + read repository + projection                  | 읽기 조합 컨텍스트라는 역할을 코드 이름에서도 드러내기 위해 | 매우 부합   |
| Auth                                                                  | global module + guard + service, Prisma/JWT/argon2 직접 사용 | 중요하지만 cross-cutting concern이라 지금은 실용성이 우선   | 부분 부합   |
| Common external dependencies                                          | `ClockPort`, `ExternalDependenciesModule` 도입               | 외부 의존성 추상화의 최소 예시를 먼저 고정                  | 부합        |

## 의존성 주입은 어디까지 하고 어디서 멈췄는가

이 프로젝트는 “DI를 많이 썼다”가 목표가 아니다.
`외부 의존성을 깔끔하게 주입하고, 내부는 단순하게 유지한다`가 목표다.

### 명확하게 분리한 것

- DB 접근 경계
- 접근 범위 확인 경계
- 시간 공급 경계
- 일부 모듈의 저장소 접근 경계

### 일부러 과하게 분리하지 않은 것

- controller가 use-case를 부르는 단순 내부 호출
- use-case가 순수 policy/helper를 호출하는 흐름
- mapper, formatter, validator helper
- 모든 service/repository 쌍의 1:1 인터페이스화

### 이 판단이 중요한 이유

초보자도 읽을 수 있고, 협업자도 의도를 이해할 수 있으며, 1인 개발자가 끝까지 유지할 수 있어야 하기 때문이다.

## 왜 전체를 순수 클린/헥사고날로 가지 않았는가

이 프로젝트는 처음부터 끝까지 모든 모듈을 완전히 클린/헥사고날 구조로 바꾸지 않았다.
그 이유는 아래와 같다.

- 현재 저장소는 이미 건강한 모듈형 레이어드 구조를 갖고 있다.
- 모든 모듈을 같은 강도로 분리하면 코드량과 조립 복잡도가 빠르게 늘어난다.
- 포트폴리오에서 더 중요한 것은 “패턴 사용량”보다 “판단의 적절성”이다.
- 실제 제품 완성과 운영 준비를 밀어내면 오히려 실무형 포트폴리오로서 약해진다.

즉, 이 프로젝트는 `무조건 클린 아키텍처`를 보여주는 프로젝트가 아니라 `상황에 맞는 구조 선택`을 보여주는 프로젝트다.

## 테스트 전략도 이 판단과 맞물려 있다

현재 테스트는 구조 선택을 설명할 수 있게 설계되어 있다.

### use-case 테스트

- `collected-transactions.use-case.test.ts`
- `recurring-rules.use-case.test.ts`

이 테스트는 Nest 없이도 핵심 쓰기 모델 규칙을 검증할 수 있다는 점을 보여준다.

### 요청 단위 API 테스트

- `*.request-api.test.ts`

이 테스트는 실제 controller, guard, ValidationPipe, HTTP 계약이 연결된 상태를 확인한다.

### service / calculator 테스트

- `auth.service.test.ts`
- `dashboard-read.service.test.ts`
- `forecast-read.service.test.ts`

이 테스트는 read context도 write domain과 다르게 충분히 검증 가능하다는 점을 보여준다.

### Web 테스트

- `fetch-json.test.ts`
- `env.test.ts`

이 테스트는 인증 실패 처리, fallback 정책, 런타임 환경 구성을 프런트엔드 관점에서 검증한다.

### Browser E2E

- `auth-and-transactions.spec.ts`

이 테스트는 보호 라우트, 로그인/세션 복원, 거래 저장, 기준 데이터 관리, 반복 규칙 관리, 운영 체크리스트 empty state와 fallback CTA까지 대표 흐름을 한 번에 확인한다.
즉, 이 프로젝트가 강조하는 `인증 + 핵심 쓰기 모델 + 준비 경로/운영 가이드` 흐름을 브라우저 관점에서 대표 검증하고, 백엔드 계약 자체는 요청 단위/API 테스트가 담당한다.

### Prisma integration 테스트

- `collected-transactions.prisma.integration.test.ts`

이 테스트는 `collected-transactions` 모듈이 실제 MySQL 경계에서 `use-case -> port -> Prisma adapter -> DB` 흐름으로 동작하는지 대표적으로 보여준다.
즉, 이 프로젝트가 말하는 `외부 의존성은 분리하되, 내부는 과하게 추상화하지 않는다`는 원칙이 테스트에서도 보이도록 만든 증거다.

## 현재 프로젝트는 목적과 판단 원칙에 얼마나 부합하는가

### 전체 판정

`전반적으로 매우 잘 부합한다.`

### 잘 부합하는 이유

- Web, API, Contracts 경계가 명확하다.
- 핵심 쓰기 모델 두 개에만 선택적으로 더 엄격한 구조를 적용했다.
- 대상 모듈의 cross-module import는 `public.ts` 진입점으로 고정해 공개 경계가 코드에서도 드러난다.
- `dashboard`, `forecast`는 `read service`, `read repository`, `projection` 네이밍으로 Insight Context 성격을 코드에서 설명할 수 있다.
- 모든 API 응답에 `x-request-id`를 붙이고 `health/ready`를 제공해 최소 운영 신호도 설명할 수 있다.
- 외부 의존성 경계만 분리하고 내부 과잉 DI를 피했다.
- 테스트가 구조 의도를 뒷받침한다.
- 운영, 계약, 개발, ADR 문서 체계가 이미 갖춰져 있다.
- 예외 처리와 최소 로깅 기준도 짧은 규칙 문서로 고정해 두었다.

### 아직 완전히 끝나지 않은 부분

- `Auth`는 아직 Prisma, JWT, argon2에 직접 결합되어 있다.
- GitHub 저장소 보호 규칙은 문서화되어 있지만, private repository 플랜이나 실제 설정 상태에 따라 서버 강제가 바로 적용되지 않을 수 있다.
- 운영 레벨 세부 정책은 문서화되어 있지만, 실제 배포 환경에서 끝까지 검증한 상태는 아니다.

이 부분들은 “실패”가 아니라 `현재 단계에서 의도적으로 남겨 둔 현실적인 한계`에 가깝다.

## 이 프로젝트에서 의도적으로 하지 않은 것

- 모든 모듈의 일괄적인 clean architecture 전환
- 모든 service/repository 쌍의 인터페이스화
- 프런트엔드 전체의 억지스러운 hexagonal화
- 조기 CQRS, 이벤트 버스, 마이크로서비스 전환
- 보기 좋은 이름만 붙인 과도한 port/adapter 추가

이 문서에서 중요한 것은 “무엇을 했는가”만이 아니라 “무엇을 하지 않았는가”도 설명하는 것이다.

## 포트폴리오에서 이렇게 설명하면 좋다

- 이 프로젝트는 Next.js, NestJS, Prisma, MySQL 기반의 1인 사업자·소상공인용 월별 재무 운영 시스템이다.
- 기본 구조는 모듈러 모놀리스이며, Web/API 계약은 `packages/contracts`로 통합했다.
- 모든 모듈을 같은 방식으로 과하게 추상화하지 않고, 핵심 쓰기 모델인 `Collected Transactions`와 `Recurring Rules`에만 use-case/port/adapter 경계를 도입했다.
- DI는 외부 기술 경계에만 최소한으로 적용했고, 내부 helper와 mapper는 순수 함수로 유지했다.
- 이 선택 덕분에 테스트성과 설명력은 높이고, 1인 개발 복잡도는 통제할 수 있었다.

## 현재 단계 결론

2026-04-05 기준으로 이 프로젝트는 다음 상태로 보는 것이 가장 정확하다.

- MSA-ready P0 `Context Map와 금지선`: 완료
- MSA-ready P1 `Module Public API / Internal Implementation 경계`: 완료
- MSA-ready P2 `Dashboard / Forecast를 Insight Context로 재정의`: 완료
- MSA-ready P3 `운영 신호 보강`: 완료
- MSA-ready P4 `내부 Integration Event 계약`: 의도적으로 보류

즉, 지금은 `MSA처럼 보이기 위한 구조 추가`보다 `현재 경계를 명확히 유지한 채 제품 완성도와 운영 준비를 높이는 단계`다.

## 최종 한 줄 결론

이 프로젝트는 `설명 가능한 이유가 있는 구조 선택`을 보여주는 포트폴리오이며, 현재 아키텍처는 그 목적과 판단 원칙에 전반적으로 잘 부합한다.
