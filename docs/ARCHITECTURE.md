# 아키텍처

## 1. 전체 구성

```text
[ Next.js 웹 ]
    |
    | REST + 공용 계약
    v
[ NestJS API ]
    |
    | Prisma
    v
[ MySQL ]
```

이 저장소는 웹, API, 계약 패키지를 분리한 워크스페이스 구조를 사용합니다.

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

- `apps/web`: 화면, 사용자 상호작용, 기능 조합
- `apps/api`: 인증, 검증, 도메인 처리, 데이터 접근
- `packages/contracts`: 요청/응답 타입의 단일 소스
- `packages/money`: `MoneyWon` 파싱/검증/합산/반올림/배분을 담당하는 공용 금액 모듈

## 3. MSA 대비 컨텍스트 맵

이 저장소는 `실제 MSA`가 아니라 `MSA 대비 설명이 가능한 모듈러 모놀리스`입니다.
즉 서비스 분리, 브로커, 서비스별 데이터베이스를 도입하지는 않지만, 도메인 책임 경계는 아래처럼 읽히도록 유지합니다.

```text
[ 공용 기반과 계약 ] -> 모든 컨텍스트의 계약/공통 인프라 지원
[ 인증과 접근 제어 ] -> 모든 컨텍스트의 인증/요청 주체 기준선

[ 사업장 운영 관리 ] -> 사업장 범위 설정/멤버/권한/감사
[ 운영 지원 ] -> 운영 체크리스트/예외/상태/알림/반출/메모 읽기 모델

[ 반복 자동화 ] ------ 참조 전용 -----> [ 원장 ]
[ 원장 ] ---------------- 읽기 -------> [ 보고와 전망 ]
[ 원장 ] ---------------- 읽기 -------> [ 운영 지원 ]
[ 반복 자동화 ] ---------- 읽기 ------> [ 보고와 전망 ]
[ 운영 자산과 보장 ] -- 수집 비용 연계 --> [ 원장 ]
[ 운영 자산과 보장 ] ---- 읽기 -------> [ 보고와 전망 ]
```

| 컨텍스트         | 현재 모듈                                                                                                                                                                                                                                   | 역할                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 인증과 접근 제어 | `auth`, `common/auth`                                                                                                                                                                                                                       | 로그인, 토큰, 계정 보안, 요청 주체 인증 기준선                               |
| 사업장 운영 관리 | `workspace-settings`, `admin`, `navigation`, `common/infrastructure/operational`                                                                                                                                                            | 사업장 설정, 멤버/권한 정책, 감사 이벤트 저장과 조회, 데이터베이스 메뉴 트리 |
| 원장             | `funding-accounts`, `categories`, `account-subjects`, `ledger-transaction-types`, `reference-data-readiness`, `accounting-periods`, `collected-transactions`, `journal-entries`, `import-batches`, `financial-statements`, `carry-forwards` | 기준 데이터, 월 운영, 업로드 수집/전표, 공식 보고, 차기 이월 컨텍스트        |
| 반복 자동화      | `recurring-rules`, `plan-items`                                                                                                                                                                                                             | 반복 규칙 정의와 기간별 계획 항목 생성/정합성                                |
| 운영 자산과 보장 | `vehicles`, `insurance-policies`                                                                                                                                                                                                            | 운영비 성격의 자산/보장 도메인, 차량 연료/정비 기반 수집 거래 진입점         |
| 보고와 전망      | `dashboard`, `forecast`                                                                                                                                                                                                                     | 읽기 기반 요약/예측 조합                                                     |
| 운영 지원        | `operations-console`                                                                                                                                                                                                                        | 운영 체크리스트, 예외, 월 마감/업로드 현황, 시스템 상태, 알림, 반출/메모     |
| 공용 기반과 계약 | `packages/contracts`, `packages/money`, env, Prisma, health, 공통 외부 의존성 조립                                                                                                                                                          | 계약, 금액 값 기준, 런타임 기반선                                            |

여기서 `원장(Ledger)`은 현재 코드베이스의 컨텍스트 이름입니다.  
현재 API 모듈명은 `accounting-periods`, `collected-transactions`, `import-batches`, `journal-entries`, `financial-statements`, `carry-forwards`, `recurring-rules`, `plan-items` 등이고, 웹 화면/라우트는 축약 이름으로 `periods`, `transactions`, `imports`, `recurring`, `insurances` 같은 경로를 함께 사용합니다.  
회계 도메인의 상세 기준은 [business-logic-draft.md](./domain/business-logic-draft.md) 와 [core-entity-definition.md](./domain/core-entity-definition.md) 를 우선하며, 최종 쓰기 모델은 `Ledger`, `AccountingPeriod`, `CollectedTransaction`, `JournalEntry` 중심으로 수렴합니다.

허용되는 방향:

- 웹은 HTTP + `packages/contracts`를 통해서만 API와 연결합니다.
- `반복 자동화`는 `원장`의 참조 상태를 읽을 수 있습니다.
- `운영 자산과 보장`은 차량 연료/정비 기록의 선택적 회계 연동을 위해 `원장`의 표준 수집 거래(`CollectedTransaction`) 쓰기 흐름을 사용합니다.
- `보고와 전망`은 `원장`, `반복 자동화`, `운영 자산과 보장`을 읽어 조합합니다.
- `운영 지원`은 `원장`, `사업장 운영 관리`, `health` 경계를 읽어 운영자가 처리할 위험 신호와 인수인계 기록을 조합합니다.
- `인증과 접근 제어`는 인증과 요청 주체 기준선만 제공하고, 도메인 쓰기 흐름의 `TenantMembership` / `ActorRef` 판정 자체를 소유하지 않습니다.
- `공용 기반과 계약`은 공통 지원 계층으로만 동작합니다.

금지선:

- `dashboard`, `forecast`가 거래/반복규칙의 쓰기 규칙을 직접 소유하지 않습니다.
- 다른 모듈의 저장소, 어댑터, 컨트롤러를 직접 가져다 쓰는 것을 기본 규칙으로 두지 않습니다.
- `packages/contracts`에 앱 구현 코드나 비즈니스 로직을 넣지 않습니다.
- 메시지 브로커, 아웃박스, 게이트웨이, 서비스 분리는 별도 ADR 없이 도입하지 않습니다.

## 3.1 금액 정합성 경계

- HTTP 요청/응답의 금액은 `MoneyWon` 의미의 `number`이며 KRW 원 단위 안전한 정수만 허용합니다.
- Prisma 영속 금액 컬럼은 `Decimal(19,0)`로 유지하고, 비즈니스 로직 경계에는 변환기/어댑터의 `Prisma.Decimal -> MoneyWon(number)` 변환을 거쳐 전달합니다.
- 금액 덧셈, 차감, 합계, `HALF_UP` 반올림, 배분 잔차 보정은 `@personal-erp/money` 도우미 함수를 우선 사용합니다.
- `money` 패키지 밖의 금액 필드에서 직접 `Number(...)`, `+/-`, `+=/-=`를 새로 쓰는 흐름은 `npm run money:check`와 `npm run check:quick`로 막습니다.

## 4. 프론트엔드 구조

웹은 다음 경계를 유지합니다.

```text
app/       # Next.js 라우트와 레이아웃
features/  # 도메인별 화면과 API 접근
shared/    # 공통 UI, 레이아웃, 테마, env, fetch 도우미 함수
test/      # 브라우저 없이 가능한 스모크 테스트
```

원칙:

- 라우트는 얇게 유지합니다.
- 비즈니스 화면은 `features`에 둡니다.
- 재사용 가능한 조각만 `shared`로 올립니다.
- 기능 내부 API 파일이 모의 대체 응답과 실제 fetch 호출을 함께 소유합니다.

## 5. 백엔드 구조

API는 다음 흐름을 기본으로 사용합니다.

```text
기본: 컨트롤러 -> 서비스 -> 저장소 -> 변환기/계산기
전환 대상 모듈: 컨트롤러 -> 유스케이스 -> 포트 -> 어댑터
보고와 전망 컨텍스트: 컨트롤러 -> 읽기 서비스 -> 읽기 저장소 -> 투영
```

공통 전환 규약:

- 외부 의존성 포트는 `apps/api/src/common/application/ports`에 둡니다.
- 공통 어댑터 조립은 `apps/api/src/common/infrastructure`에서 시작합니다.
- `application/domain/infrastructure` 폴더는 실제 전환 대상 모듈에서만 만듭니다.
- 현재 승격 완료 모듈: `collected-transactions`, `recurring-rules`, `accounting-periods`, `import-batches`, `journal-entries`, `auth`, `admin`, `insurance-policies`, `plan-items`, `financial-statements`, `carry-forwards`, `operations-console` — `docs/completed/REFACTORING_EXECUTION_PLAN.md` 참조
- `import-batches`는 업로드 배치/행 보존, IM뱅크 PDF 파싱, 최신 진행월 기준 단건 수집, 일괄 등록 작업/행별 결과/사업장 잠금을 같은 `원장(Ledger)` 경계 안에서 조율합니다. 업로드도 월별 열기/마감 흐름을 따르며, 운영월 자동 생성은 거래 입력 예외가 아니라 최초 시작월 또는 최신 잠금월 바로 다음 월의 신규 계좌/카드 초기화로 제한합니다.
- `vehicles`는 연료/정비 운영 기록을 소유하되, 회계 연동을 켠 기록은 표준 `CollectedTransaction`을 생성/동기화하고 전표 확정 이후에는 차량 기록 덮어쓰기를 막습니다.
- `collected-transactions`, `recurring-rules`, `dashboard`, `forecast`는 모듈 바깥에서 각 모듈의 `public.ts`만 공식 진입점으로 사용합니다.
- `dashboard`, `forecast`는 `읽기 서비스 -> 읽기 저장소 -> 투영` 네이밍으로 읽기 조합 컨텍스트임을 코드에서 드러냅니다.
- `auth`는 10개 유스케이스 + `SupportService` 기반 "얇은 헥사고날" 구조, `admin`은 4개 유스케이스 + `CommandSupport`/`QueryService` 기반 구조를 채택했습니다.
- 나머지 모듈은 설명 가능한 이유가 생길 때만 같은 방향으로 옮깁니다.
- 변환기/계산기/도우미 함수는 계속 함수 또는 단순 클래스로 두고 provider/token으로 만들지 않습니다.

### 5.1 모듈 승격 기준

모듈이 `기본 방식`(서비스 중심)에서 `고급 방식`(헥사고날 중심)으로 승격되는 기준은 다음과 같습니다.

1.  **비즈니스 복잡도**
    - 단일 서비스 파일이 **400줄 이상**으로 길어질 때.
    - 로직 내부에 중괄호 깊이가 깊거나 복잡한 정책(`Policy`)이 3개 이상 얽힐 때.
2.  **데이터 중요도**
    - **돈(현금, 자산)**의 흐름을 직접 계산하거나 변경하는 로직일 때.
    - 법적/회계적 **증빙(전표, 감사 기록)**이 반드시 필요한 데이터일 때.
3.  **테스트 요구사항**
    - 데이터베이스 없이 순수 로직만으로 **단위 테스트**를 20개 이상 작성해야 할 만큼 검증이 중요할 때.
4.  **외부 결합도**
    - Prisma 외에 외부 API(뱅킹, 세무 API 등)를 2개 이상 연동해야 할 때.

원칙:

- 컨트롤러는 요청/응답과 인증 컨텍스트만 다룹니다.
- 서비스 또는 유스케이스는 모듈 상태에 맞는 비즈니스 흐름을 조합합니다.
- 저장소 또는 어댑터는 Prisma 접근을 담당합니다.
- 변환기/계산기는 응답 변환과 계산을 분리합니다.

## 6. 인증과 접근 경계

- `health`, `health/ready`, `auth/register`, `auth/verify-email`, `auth/resend-verification`, `auth/accept-invitation`, `auth/login`, `auth/refresh`, `auth/logout`을 제외한 API는 기본적으로 보호됩니다.
- 컨트롤러와 서비스는 인증된 `user.currentWorkspace`를 받고, 도메인 쓰기 흐름에서는 이를 `tenantId`, `ledgerId`, `TenantMembership`, `ActorRef` 기준으로 해석해야 합니다.
- 현재 HTTP 표면과 요청 단위 검증은 사용자 단위 전단계가 아니라 사업장 단위 tenant/ledger 접근 판정을 기준으로 유지합니다.
- 계좌, 카테고리, 장부, 기간, 업로드 배치, 전표 등 참조 대상은 tenant/ledger 접근 범위 안에서 검증합니다.

## 7. 환경변수 정책

- 루트 공용 `.env`를 기본값으로 쓰지 않습니다.
- 기본 권장 방식은 `PERSONAL_ERP_SECRET_DIR`가 가리키는 외부 SECRET 폴더를 사용하는 것입니다.
- 현재 문서의 기본 경로 예시는 [`.secret-dir.local`](../.secret-dir.local) 에 정의된 `C:\secrets\personal-erp` 입니다.
- 현재 실제 기준 파일은 `C:\secrets\personal-erp\api.env`, `C:\secrets\personal-erp\web.env` 입니다.
- 로컬 대체 응답 설정으로 API는 `apps/api/.env`, 웹은 `apps/web/.env.local`도 읽을 수 있습니다.
- 앱 시작 시 env를 검증합니다.
- env 구조가 바뀌면 관련 문서와 검증 코드를 함께 수정합니다.

## 8. 대체 응답 정책

- 데모 대체 응답은 기본적으로 꺼져 있습니다.
- 개발 환경에서 `NEXT_PUBLIC_ENABLE_DEMO_FALLBACK=true`일 때만 허용됩니다.
- 현재 권장 위치는 `C:\secrets\personal-erp\web.env` 입니다.
- 대체 응답이 꺼져 있으면 웹은 쿼리 오류를 화면에 직접 표시합니다.

자세한 내용은 [FALLBACK_POLICY.md](./FALLBACK_POLICY.md) 를 참고합니다.

## 9. 테스트 전략

현재 테스트는 아래 네 층으로 나뉩니다.

- 유스케이스 / 서비스 테스트
  인증, 접근 범위 검증, 대시보드/기간 전망 계산, 핵심 쓰기 흐름 규칙
- 요청 단위 API 테스트
  가드, `ValidationPipe`, 인증 실패, DTO 검증, 응답 형태, 준비 상태 응답, `x-request-id`
- 웹 런타임 정책 테스트
  env 파싱, 대체 응답 동작, Bearer 토큰 주입, `401` 처리
- 대표 경계 검증
  브라우저 E2E와 Prisma 통합 테스트

기본 개발 루프는 `npm run check:quick`, `npm run test`이고,
`npm run test:e2e`, `npm run test:prisma`는 대표 사용자 흐름과 실제 데이터베이스 경계를 따로 보는 심화 검증입니다.

## 10. 운영 신호

- 모든 API 응답에는 `x-request-id` 헤더가 들어갑니다.
- 클라이언트가 보낸 `x-request-id`가 있으면 그대로 이어받고, 없으면 서버가 새로 만듭니다.
- API 경계 로그는 `[module] METHOD path status duration requestId=...` 형태로 남깁니다.
- `GET /health`는 생존 확인, `GET /health/ready`는 데이터베이스 연결을 포함한 준비 상태를 나타냅니다.
