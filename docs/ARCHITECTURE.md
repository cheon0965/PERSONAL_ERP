# 아키텍처

## 1. 전체 구성

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

이 저장소는 Web, API, Contracts를 분리한 워크스페이스 구조를 사용합니다.

## 2. 워크스페이스 경계

```text
apps/
  web/
  api/
packages/
  contracts/
  money/
docs/
```

- `apps/web`: 화면, 사용자 상호작용, feature 조합
- `apps/api`: 인증, 검증, 도메인 처리, 데이터 접근
- `packages/contracts`: 요청/응답 타입의 단일 소스
- `packages/money`: `MoneyWon` 파싱/검증/합산/반올림/배분을 담당하는 공용 금액 모듈

## 3. MSA-ready Context Map

이 저장소는 `실제 MSA`가 아니라 `MSA-ready 설명이 가능한 모듈러 모놀리스`입니다.
즉 서비스 분리, 브로커, 서비스별 DB를 도입하지는 않지만, 도메인 책임 경계는 아래처럼 읽히도록 유지합니다.

```text
[ Platform & Contracts ] -> 모든 컨텍스트의 계약/공통 인프라 지원
[ Identity & Access ] -> 모든 컨텍스트의 인증/요청 주체 기준선

[ Recurring Automation ] -- reference only --> [ Ledger ]
[ Ledger ] -------------------- read -------> [ Insight & Planning ]
[ Recurring Automation ] ------- read ------> [ Insight & Planning ]
[ Asset & Coverage ] ----------- read ------> [ Insight & Planning ]
```

| Context              | 현재 모듈                                                                                                                                                                                                                                   | 역할                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Identity & Access    | `auth`, `common/auth`                                                                                                                                                                                                                       | 로그인, 토큰, 요청 주체 인증 기준선                                   |
| Ledger               | `funding-accounts`, `categories`, `account-subjects`, `ledger-transaction-types`, `reference-data-readiness`, `accounting-periods`, `collected-transactions`, `journal-entries`, `import-batches`, `financial-statements`, `carry-forwards` | 기준 데이터, 월 운영, 업로드 수집/전표, 공식 보고, 차기 이월 컨텍스트 |
| Recurring Automation | `recurring-rules`, `plan-items`                                                                                                                                                                                                             | 반복규칙 정의와 기간별 계획 항목 생성/정합성                          |
| Asset & Coverage     | `vehicles`, `insurance-policies`                                                                                                                                                                                                            | 운영비 성격의 자산/보장 도메인                                        |
| Insight & Planning   | `dashboard`, `forecast`                                                                                                                                                                                                                     | 읽기 기반 요약/예측 조합                                              |
| Platform & Contracts | `packages/contracts`, `packages/money`, env, Prisma, health, 공통 외부 의존성 조립                                                                                                                                                          | 계약, 금액 값 기준, 런타임 기반선                                     |

여기서 `Ledger`는 현재 코드베이스의 컨텍스트 이름입니다.  
현재 API 모듈명은 `accounting-periods`, `collected-transactions`, `import-batches`, `journal-entries`, `financial-statements`, `carry-forwards`, `recurring-rules`, `plan-items` 등이고, Web feature/route는 shorthand로 `periods`, `transactions`, `imports`, `recurring`, `insurances` 같은 화면 경로를 함께 사용합니다.  
회계 도메인의 상세 기준은 [business-logic-draft.md](./domain/business-logic-draft.md) 와 [core-entity-definition.md](./domain/core-entity-definition.md) 를 우선하며, 최종 write model은 `Ledger`, `AccountingPeriod`, `CollectedTransaction`, `JournalEntry` 중심으로 수렴합니다.

허용되는 방향:

- Web은 HTTP + `packages/contracts`를 통해서만 API와 연결합니다.
- `Recurring Automation`은 `Ledger`의 참조 상태를 읽을 수 있습니다.
- `Insight & Planning`은 `Ledger`, `Recurring Automation`, `Asset & Coverage`를 읽어 조합합니다.
- `Identity & Access`는 인증과 요청 주체 기준선만 제공하고, 도메인 write 흐름의 `TenantMembership` / `ActorRef` 판정 자체를 소유하지 않습니다.
- `Platform & Contracts`는 공통 지원 계층으로만 동작합니다.

금지선:

- `dashboard`, `forecast`가 거래/반복규칙의 쓰기 규칙을 직접 소유하지 않습니다.
- 다른 모듈의 `repository`, `adapter`, `controller`를 직접 import하는 것을 기본 규칙으로 두지 않습니다.
- `packages/contracts`에 앱 구현 코드나 비즈니스 로직을 넣지 않습니다.
- 메시지 브로커, outbox, gateway, service split은 별도 ADR 없이 도입하지 않습니다.

## 3.1 금액 정합성 경계

- HTTP 요청/응답의 금액은 `MoneyWon` 의미의 `number`이며 KRW 원 단위 safe integer만 허용합니다.
- Prisma 영속 금액 컬럼은 `Decimal(19,0)`로 유지하고, business logic 경계에는 mapper/adapter의 `Prisma.Decimal -> MoneyWon(number)` 변환을 거쳐 전달합니다.
- 금액 덧셈, 차감, 합계, `HALF_UP` 반올림, 배분 잔차 보정은 `@personal-erp/money` helper를 우선 사용합니다.
- money package 밖의 금액 필드 raw `Number(...)`, `+/-`, `+=/-=` 유입은 `npm run money:check`와 `npm run check:quick`로 막습니다.

## 4. 프론트엔드 구조

Web은 다음 경계를 유지합니다.

```text
app/       # Next.js 라우트와 레이아웃
features/  # 도메인별 화면과 API 접근
shared/    # 공통 UI, 레이아웃, theme, env, fetch helper
test/      # 브라우저 없이 가능한 스모크 테스트
```

원칙:

- 라우트는 얇게 유지합니다.
- 비즈니스 화면은 `features`에 둡니다.
- 재사용 가능한 조각만 `shared`로 올립니다.
- feature 내부 API 파일이 mock fallback과 실제 fetch를 함께 소유합니다.

## 5. 백엔드 구조

API는 다음 흐름을 기본으로 사용합니다.

```text
기본: controller -> service -> repository -> mapper/calculator
전환 대상 모듈: controller -> use-case -> port -> adapter
Insight Context: controller -> read service -> read repository -> projection
```

공통 전환 규약:

- 외부 의존성 포트는 `apps/api/src/common/application/ports`에 둡니다.
- 공통 어댑터 조립은 `apps/api/src/common/infrastructure`에서 시작합니다.
- `application/domain/infrastructure` 폴더는 실제 전환 대상 모듈에서만 만듭니다.
- `collected-transactions`, `recurring-rules` 는 이미 `use-case/port/adapter` 경계로 전환되었습니다.
- `collected-transactions`, `recurring-rules`, `dashboard`, `forecast`는 모듈 바깥에서 각 모듈의 `public.ts`만 공식 진입점으로 사용합니다.
- `dashboard`, `forecast`는 `read service -> read repository -> projection` 네이밍으로 읽기 조합 컨텍스트임을 코드에서 드러냅니다.
- 나머지 모듈은 설명 가능한 이유가 생길 때만 같은 방향으로 옮깁니다.
- mapper/calculator/helper는 계속 함수 또는 plain class로 두고 provider/token으로 만들지 않습니다.

### 5.1 모듈 승격 기준 (Promotion Triggers)

모듈이 `Standard` 방식(Service 중심)에서 `Advanced` 방식(Hexagonal 중심)으로 승격되는 기준은 다음과 같습니다.

1.  **비즈니스 복잡도 (Complexity):**
    - 단일 Service 파일이 **400줄 이상**으로 길어질 때.
    - 로직 내부에 중괄호 depth가 깊거나 복잡한 정책(`Policy`)이 3개 이상 얽힐 때.
2.  **데이터 중요도 (Criticality):**
    - **돈(현금, 자산)**의 흐름을 직접 계산하거나 변경하는 로직일 때.
    - 법적/회계적 **증빙(Journal Entry, Audit)**이 반드시 필요한 데이터일 때.
3.  **테스트 요구사항 (Testability):**
    - DB 없이 순수 로직만으로 **단위 테스트(Unit Test)**를 20개 이상 작성해야 할 만큼 검증이 중요할 때.
4.  **외부 결합도 (External Integration):**
    - Prisma 외에 외부 API(뱅킹, 세무 API 등)를 2개 이상 연동해야 할 때.

원칙:

- controller는 요청/응답과 인증 컨텍스트만 다룹니다.
- service 또는 use-case는 모듈 상태에 맞는 비즈니스 흐름을 조합합니다.
- repository 또는 adapter는 Prisma 접근을 담당합니다.
- mapper/calculator는 응답 변환과 계산을 분리합니다.

## 6. 인증과 접근 경계

- `health`, `health/ready`, `auth/login`, `auth/refresh`, `auth/logout`을 제외한 API는 기본적으로 보호됩니다.
- 컨트롤러와 서비스는 인증된 `user.currentWorkspace`를 받고, 도메인 write 흐름에서는 이를 `tenantId`, `ledgerId`, `TenantMembership`, `ActorRef` 기준으로 해석해야 합니다.
- 현재 HTTP surface와 요청 단위 검증은 user-scoped 전단계가 아니라 workspace-scoped tenant/ledger 접근 판정을 기준으로 유지합니다.
- 계좌, 카테고리, 장부, 기간, 업로드 배치, 전표 등 참조 대상은 tenant/ledger 접근 범위 안에서 검증합니다.

## 7. 환경변수 정책

- 루트 공용 `.env`를 기본값으로 쓰지 않습니다.
- 기본 권장 방식은 `PERSONAL_ERP_SECRET_DIR`가 가리키는 외부 SECRET 폴더를 사용하는 것입니다.
- 현재 문서의 기본 경로 예시는 [`.secret-dir.local`](../.secret-dir.local) 에 정의된 `C:\secrets\personal-erp` 입니다.
- 현재 실제 기준 파일은 `C:\secrets\personal-erp\api.env`, `C:\secrets\personal-erp\web.env` 입니다.
- 로컬 fallback으로 API는 `apps/api/.env`, Web은 `apps/web/.env.local`도 읽을 수 있습니다.
- 앱 시작 시 env를 검증합니다.
- env 구조가 바뀌면 관련 문서와 검증 코드를 함께 수정합니다.

## 8. fallback 정책

- demo fallback은 기본적으로 꺼져 있습니다.
- 개발 환경에서 `NEXT_PUBLIC_ENABLE_DEMO_FALLBACK=true`일 때만 허용됩니다.
- 현재 권장 위치는 `C:\secrets\personal-erp\web.env` 입니다.
- fallback이 꺼져 있으면 Web은 쿼리 오류를 화면에 직접 표시합니다.

자세한 내용은 [FALLBACK_POLICY.md](./FALLBACK_POLICY.md) 를 참고합니다.

## 9. 테스트 전략

현재 테스트는 아래 네 층으로 나뉩니다.

- use-case / service 테스트
  인증, 접근 범위 검증, 대시보드/기간 전망 계산, 핵심 쓰기 흐름 규칙
- 요청 단위 API 테스트
  guard, ValidationPipe, 인증 실패, DTO validation, 응답 shape, readiness, `x-request-id`
- Web 런타임 정책 테스트
  env 파싱, fallback 동작, Bearer 토큰 주입, `401` 처리
- 대표 경계 검증
  브라우저 E2E와 Prisma 통합 테스트

기본 개발 루프는 `npm run check:quick`, `npm run test`이고,
`npm run test:e2e`, `npm run test:prisma`는 대표 사용자 흐름과 실DB 경계를 따로 보는 심화 검증입니다.

## 10. 운영 신호

- 모든 API 응답에는 `x-request-id` 헤더가 들어갑니다.
- 클라이언트가 보낸 `x-request-id`가 있으면 그대로 이어받고, 없으면 서버가 새로 만듭니다.
- API 경계 로그는 `[module] METHOD path status duration requestId=...` 형태로 남깁니다.
- `GET /health`는 liveness, `GET /health/ready`는 DB 연결 포함 readiness를 나타냅니다.
