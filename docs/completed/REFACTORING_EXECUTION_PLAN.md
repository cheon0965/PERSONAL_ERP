# 프로젝트 전반 리팩토링 실행계획

기준일: `2026-04-16`

문서 상태: `completed`

완료일: `2026-04-16`

인코딩 규칙: 모든 파일 조회, 생성, 수정, 삭제는 `UTF-8` 기준으로 처리한다.

연결 문서:

- `docs/ARCHITECTURE.md`
- `docs/domain/business-logic-draft.md`
- `docs/domain/core-entity-definition.md`
- `docs/completed/UI_REORGANIZATION_EXECUTION_PLAN_V2.md`
- `docs/completed/REFACTORING_ROADMAP.md`

## 최종 진행 현황

모든 구조적 승격/분해 작업이 `2026-04-16` 기준으로 완료되었다.

- `P0 complete`: `accounting-periods`, `import-batches`, `journal-entries`, `operations-console`
- `P1 complete`: `auth`, `admin`, `insurance-policies`, `plan-items`, `financial-statements`, `carry-forwards`
- `Web split complete`: `dashboard-page.tsx`, `forecast-page.tsx`, `imports.api.ts`, `admin-members-page.tsx`, `insurance-policy-form.tsx`, `recurring-rules-page.tsx`, `financial-statements-page.tsx`, `financial-statements-page.sections.tsx`, `carry-forwards-page.tsx`, `journal-entries-page.tsx`, `vehicles-page.tsx`, `recurring-rule-form.tsx`, `insurance-policies-page.tsx`, `accounting-periods-page.tsx`, `accounting-periods-page.sections.tsx`

현재까지 반영된 핵심 내용:

- `accounting-periods`: period read/write guard 포트와 Prisma gateway adapter를 도입했고, 다른 모듈의 direct service 의존을 공식 경계로 축소했다.
- `import-batches`: create/preview/collect 흐름을 유스케이스로 분리했고, row collection과 batch write 경계를 포트 기반으로 끊었다.
- `journal-entries`: correction/reversal write 흐름을 저장 포트와 Prisma adapter 기반으로 승격했다.
- `operations-console`: command 경계를 분리했고, read repository를 도입해 mega service를 read-model 중심으로 나누기 시작했다.
- `admin`: 멤버 조회를 query service로 분리했고, 초대/역할/상태/제거를 개별 use-case로 분리했으며, `AdminMemberCommandSupportService`를 통해 검증/토큰/이메일 헬퍼를 공유하고 `admin-members.service.ts`를 제거했다.
- `auth`: register/verify-email/resend-verification/accept-invitation/login/refresh/logout를 개별 use-case로 완전 분리하고 `auth.service.ts`를 제거했다. 계정 보안(조회/프로필/비밀번호/세션)도 포함하여 auth 흐름 전체가 use-case 기반으로 전환됐다.
- `insurance-policies`: CRUD와 recurring linkage를 write port + use-case 구조로 승격했고, query service와 분리했다.
- `plan-items`, `financial-statements`, `carry-forwards`: 생성 흐름을 generation port 기반으로 마감해 direct Prisma 결합을 줄였다.
- `web`: Phase 3 기준 잔여 대형 파일 분해를 마쳤고, `apps/web/src/features` 아래 500줄 이상 파일이 남지 않도록 정리했다.

## 문서 목적

이 문서는 현재 프로젝트 전반을 다시 진단해, 어떤 모듈을 아키텍처 문서의 승격 기준에 따라 `Standard`에서 `Advanced(Hexagonal)`로 올려야 하는지, 어떤 모듈은 `read service -> read repository -> projection`으로 분리해야 하는지, 어떤 파일은 우선적으로 물리 분해해야 하는지를 현재 코드 기준으로 고정하는 실행계획 문서다.

이번 계획의 초점은 새 기능 추가가 아니라 아래 세 가지다.

- 아키텍처 문서의 승격 기준을 실제 코드에 다시 맞춘다.
- 돈, 전표, 마감, 감사, 권한 경계처럼 정합성이 강한 흐름을 우선 승격한다.
- 이미 하위 라우트까지는 정리된 Web feature 중 비대해진 화면 파일을 다시 쪼개 유지보수 비용을 낮춘다.

## 판단 기준

### 1. 승격 기준

`docs/ARCHITECTURE.md` 5.1의 승격 기준을 이번 계획의 1차 판단선으로 고정한다.

1. 단일 Service 파일이 `400줄 이상`으로 길어질 때
2. 복잡한 정책이 여러 개 얽혀 깊은 분기와 상태 전이를 만들 때
3. 돈의 흐름, 전표, 감사, 마감처럼 높은 정합성과 증빙이 필요한 데이터를 다룰 때
4. DB 밖 외부 연동이나 다중 협력자가 붙어 DB 없는 순수 테스트 수요가 커질 때

### 2. 구조 선택 기준

- `Advanced(Hexagonal)`:
  쓰기 흐름이 핵심이고, 상태 전이와 정책 검증이 복잡하며, 포트/어댑터/유스케이스 분리가 직접 유지보수 이득으로 이어지는 모듈
- `Read-model split`:
  읽기 조합 컨텍스트가 중심이고, 여러 read model을 한 서비스가 과도하게 끌어안은 모듈
- `Standard 유지 + 내부 분해`:
  CRUD 중심이며 승격 비용보다 파일 분해 이득이 더 큰 모듈
- `UI file split`:
  라우트는 이미 맞지만 feature/page/form 파일이 과대해진 Web 표면

### 3. 금지선

- 다른 모듈의 `repository`, `adapter`, `controller`를 직접 import하지 않는다.
- 승격 대상 모듈 밖에서 공식 진입점은 `public.ts` 또는 HTTP 계약으로 제한한다.
- read context에 불필요하게 write-domain 패턴을 강제하지 않는다.
- MSA 분리, outbox, 브로커, 게이트웨이 추가는 이번 계획 범위에 넣지 않는다.

## 현재 진단 요약

### 1. API 모듈 체크 결과

| Context                  | Module                                                   | 현재 상태                                                             | 근거                                                                                                                                       | 목표 구조                                                                                                  | 우선순위 |
| ------------------------ | -------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | -------- |
| Ledger                   | `collected-transactions`                                 | 이미 `application/domain/infrastructure` 보유                         | 현재 코드베이스의 Advanced 기준선                                                                                                          | 참조 구현으로 유지, 다른 승격의 템플릿으로 사용                                                            | baseline |
| Recurring Automation     | `recurring-rules`                                        | 이미 `application/domain/infrastructure` 보유                         | 현재 코드베이스의 Advanced 기준선                                                                                                          | 참조 구현으로 유지, 다른 승격의 템플릿으로 사용                                                            | baseline |
| Ledger                   | `accounting-periods`                                     | `use-case`는 있으나 `service + use-case + Prisma`가 혼재              | `accounting-periods.service.ts` 280 lines, `open-accounting-period.use-case.ts` 276 lines, `close-accounting-period.use-case.ts` 272 lines | `controller -> application/use-cases -> application/ports -> domain -> infrastructure/prisma`로 완전 승격  | P0       |
| Ledger                   | `import-batches`                                         | policy/repository는 늘었지만 여전히 Standard 중심                     | `imported-row-collection.repository.ts` 420 lines, `imported-row-collection.service.ts` 308 lines, `AccountingPeriodsService` 직접 의존    | 업로드/preview/collect를 유스케이스 단위로 나누고 period/collect/store 경계를 포트화                       | P0       |
| Ledger                   | `journal-entries`                                        | read service + 일부 use-case만 존재하는 반쪽 승격                     | `correct-journal-entry.use-case.ts` 294 lines, `reverse-journal-entry.use-case.ts` 242 lines, 전표/정정/반전의 증빙 중요도 높음            | 전표 조정 흐름을 완전한 Hexagonal write 모듈로 승격, 조회는 read service 유지                              | P0       |
| Operations Support       | `operations-console`                                     | 단일 mega service에 read/write가 모두 섞임                            | `operations-console.service.ts` 1815 lines                                                                                                 | `read service -> read repository -> projection` + `run-export/create-note` command use-case 분리           | P0       |
| Identity & Access        | `auth`                                                   | 대형 service에 인증, 초대 수락, 이메일 인증, 세션, 보안 이벤트가 집중 | `auth.service.ts` 986 lines, email/clock/session/rate-limit/audit 협력자 다수                                                              | 유스케이스 기준으로 쪼개고 identity/application/domain/infrastructure 구조로 승격                          | P1       |
| Workspace Administration | `admin`                                                  | `admin-members`만 과대해진 상태                                       | `admin-members.service.ts` 419 lines, 초대/역할/상태/제거/메일/감사 혼재                                                                   | `member invitation`, `role change`, `status change`, `remove member` use-case 분리와 선택적 Hexagonal 승격 | P1       |
| Asset & Coverage         | `insurance-policies`                                     | repository는 있으나 service가 과대                                    | `insurance-policies.service.ts` 467 lines, `recurring-rules/public.ts`와 연동                                                              | 보험 계약 CRUD와 반복규칙 동기화를 유스케이스/도메인 정책으로 분리                                         | P1       |
| Recurring Automation     | `plan-items`                                             | `use-case`는 있으나 direct Prisma 의존이 큼                           | `generate-plan-items.use-case.ts` 303 lines                                                                                                | 이미 시작한 Advanced 구조를 완결하고 recurring read/write 포트를 도입                                      | P1       |
| Ledger                   | `financial-statements`                                   | `use-case + service + policy` 조합이나 저장소 포트가 없음             | `generate-financial-statements.use-case.ts` 183 lines, 공식 보고 스냅샷 컨텍스트                                                           | 공식 보고 생성 흐름을 application/ports/infrastructure로 마감                                              | P1       |
| Ledger                   | `carry-forwards`                                         | `use-case + service` 단계                                             | `generate-carry-forward.use-case.ts` 208 lines, 잠금 period와 opening 생성이 강결합                                                        | 이월 생성 흐름을 application/ports/infrastructure로 마감                                                   | P1       |
| Insight & Planning       | `dashboard`                                              | read repository 중심 구조                                             | `dashboard-read.repository.ts` 325 lines                                                                                                   | read repository/projection 내부 분해만 검토                                                                | P2       |
| Insight & Planning       | `forecast`                                               | read repository 중심 구조                                             | `forecast-read.repository.ts` 334 lines                                                                                                    | read repository/projection 내부 분해만 검토                                                                | P2       |
| Workspace Administration | `workspace-settings`                                     | Standard 구조 유지 가능                                               | `workspace-settings.service.ts` 208 lines                                                                                                  | Standard 유지, 파일 분해만 필요 시 수행                                                                    | hold     |
| Ledger                   | `funding-accounts`                                       | Standard 구조 유지 가능                                               | `funding-accounts.service.ts` 157 lines                                                                                                    | Standard 유지                                                                                              | hold     |
| Ledger                   | `categories`                                             | Standard 구조 유지 가능                                               | largest file 124 lines                                                                                                                     | Standard 유지                                                                                              | hold     |
| Ledger                   | `reference-data-readiness`                               | 읽기 점검 용도, 크기 안정                                             | `reference-data-readiness.service.ts` 195 lines                                                                                            | Standard 유지                                                                                              | hold     |
| Asset & Coverage         | `vehicles`                                               | API는 아직 Standard로 충분                                            | largest API file `vehicles.controller.ts` 326 lines                                                                                        | API는 Standard 유지, Web 표면 분해에 집중                                                                  | hold     |
| Workspace Administration | `navigation`                                             | 규칙은 있지만 아직 과승격 아님                                        | `navigation.service.ts` 256 lines                                                                                                          | Standard 유지, 메뉴 규칙 증가 시 재평가                                                                    | hold     |
| Platform                 | `health`, `account-subjects`, `ledger-transaction-types` | 소형/고정 책임                                                        | largest file 60/24/25 lines                                                                                                                | Standard 유지                                                                                              | hold     |

### 2. Web 대형 파일 체크 결과

| Area          | File                                                                                          | 현재 상태                                                                                 | 목표                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 월 운영       | `apps/web/src/features/accounting-periods/accounting-periods-page.tsx` 499 lines              | page/workspace/model 분해 완료                                                            | query·mutation orchestration만 남기고 header/domain-help/공통 props/model 계산을 외부로 이동 |
| 월 운영       | `apps/web/src/features/accounting-periods/accounting-periods-page.sections.tsx` 391 lines     | 후속 세분화 완료                                                                          | status presenter를 `accounting-periods-page.status-section.tsx`로 분리                       |
| 재무제표      | `apps/web/src/features/financial-statements/financial-statements-page.tsx` 423 lines          | page/sections 1차 분해 완료                                                               | 유지                                                                                         |
| 재무제표      | `apps/web/src/features/financial-statements/financial-statements-page.sections.tsx` 302 lines | 후속 세분화 완료                                                                          | detail presenter를 `financial-statements-page.detail-sections.tsx`로 분리                    |
| 차량 운영     | `apps/web/src/features/vehicles/vehicles-page.tsx` 441 lines                                  | 후속 분해 완료                                                                            | overview/fleet/fuel/maintenance/drawers를 sections 파일로 이동                               |
| 차기 이월     | `apps/web/src/features/carry-forwards/carry-forwards-page.tsx` 448 lines                      | 후속 분해 완료                                                                            | overview/detail/helper를 `carry-forwards-page.sections.tsx`로 이동                           |
| 전표 조회     | `apps/web/src/features/journal-entries/journal-entries-page.tsx` 298 lines                    | 후속 분해 완료                                                                            | list/detail/action presenter를 `journal-entries-page.sections.tsx`로 이동                    |
| 관리자 멤버   | `apps/web/src/features/admin/admin-members-page.tsx` 278 lines                                | page/sections 1차 분해 완료, `admin-members-page.sections.tsx` 456 lines가 후속 정리 후보 | section presenter, dialog hook, table action model 추가 분해                                 |
| 보험 계약     | `apps/web/src/features/insurance-policies/insurance-policy-form.tsx` 276 lines                | form/model/sections 1차 분해 완료                                                         | 유지                                                                                         |
| 보험 계약     | `apps/web/src/features/insurance-policies/insurance-policies-page.tsx` 264 lines              | 후속 분해 완료                                                                            | table/actions/summary/drawer/dialog를 sections 파일로 이동                                   |
| 반복 규칙     | `apps/web/src/features/recurring-rules/recurring-rules-page.tsx` 293 lines                    | page/sections 1차 분해 완료                                                               | 유지                                                                                         |
| 반복 규칙     | `apps/web/src/features/recurring-rules/recurring-rule-form.tsx` 283 lines                     | 후속 분해 완료                                                                            | validation/defaults/model과 field grid/alerts를 별도 파일로 분리                             |
| 전망          | `apps/web/src/features/forecast/forecast-page.tsx` 144 lines                                  | page/sections 1차 분해 완료, `forecast-page.sections.tsx`가 세부 presenter 역할 유지      | summary, driver chart, narrative panel의 추가 세분화만 검토                                  |
| 계획 항목     | `apps/web/src/features/plan-items/plan-items-page.tsx` 461 lines                              | 아직 허용 범위지만 추가 기능에 취약                                                       | page shell과 action cell/view-model 분리                                                     |
| 수입 배치 API | `apps/web/src/features/imports/imports.api.ts` 58 lines                                       | thin API facade + `imports.api.fallback.ts`로 1차 분해 완료                               | fallback builder와 live mapper 세분화만 후속 검토                                            |
| 대시보드      | `apps/web/src/features/dashboard/dashboard-page.tsx` 124 lines                                | page/sections 1차 분해 완료                                                               | summary cards, insight narrative, quick links 추가 세분화만 검토                             |

## 승격/분해 대상별 결론

### 1. 즉시 헥사고날 승격해야 하는 P0 쓰기 흐름

#### `accounting-periods`

이 모듈은 단순 CRUD가 아니라 `운영 기간 오픈 -> 검토 -> 마감 -> 잠금 -> 재오픈 차단` 흐름의 기준점이다. 또한 `claimJournalWritePeriodInTransaction`, `allocateJournalEntryNumberInTransaction`처럼 다른 쓰기 흐름의 보호막 역할도 맡고 있어, service 내부 유틸 수준으로 남기기에는 책임이 너무 크다.

목표:

- `OpenAccountingPeriod`
- `CloseAccountingPeriod`
- `ReopenAccountingPeriod`
- `ClaimJournalWritePeriod`
- `AllocateJournalEntryNumber`

위 흐름을 application use-case와 port로 명확히 올리고, 순수 정책은 domain으로 이동한다.

#### `import-batches`

이 모듈은 `ImportedRow -> CollectedTransaction 승격`을 다루는 경계다. 즉, 업로드 원본 보존, 파싱 오류, 중복 후보, 계획 항목 매칭, 현재 운영 기간 허용 여부가 한 흐름에 얽힌다. 여기에 현재 `AccountingPeriodsService` 직접 의존이 있어 모듈 간 결합도도 높은 편이다.

목표:

- `CreateImportBatch`
- `PreviewImportedRowCollection`
- `CollectImportedRow`
- `GetImportBatchDetail`
- `ListImportBatches`

를 application use-case로 나누고, period guard와 collected-transaction sink를 포트/어댑터 또는 안정된 `public.ts` 경계로 정리한다.

#### `journal-entries`

전표는 아키텍처 문서와 도메인 문서가 반복해서 말하는 단일 진실 원천이다. 따라서 `정정`, `반전`, `잠금 기간 보호`, `원거래 정합성`은 Hexagonal 경계로 명확히 드러나야 한다. 현재는 use-case가 존재하지만 아직 저장소 포트와 도메인 규칙이 모듈 경계로 충분히 승격되지 않았다.

목표:

- read는 `journal-entries.service.ts`를 `read service`로 유지
- write는 `ReverseJournalEntry`, `CorrectJournalEntry`를 application use-case로 고정
- 전표 저장, 원전표 조회, 기간 쓰기 보호, 원거래 수정 가능성 검증을 포트화

### 2. P0이지만 Hexagonal이 아닌 read-model 분리가 더 맞는 모듈

#### `operations-console`

`operations-console`은 `checklist`, `exceptions`, `month-end`, `import-status`, `system-status`, `alerts`, `exports`, `notes`까지 한 서비스에 모여 있다. 이 모듈은 본질적으로 `Ledger`, `Workspace Administration`, `health`를 읽어 운영 read model을 조합하는 컨텍스트다. 따라서 전체를 write-domain hexagon으로 만들기보다 아래처럼 쪼개는 편이 아키텍처 문서와 더 잘 맞는다.

목표:

- `HubSummaryReadService`
- `ChecklistReadService`
- `ExceptionsReadService`
- `MonthEndReadService`
- `ImportStatusReadService`
- `SystemStatusReadService`
- `AlertsReadService`
- `RunOperationsExportUseCase`
- `CreateOperationsNoteUseCase`

읽기와 쓰기 command를 분리하고, Prisma read repository/projection 계층을 명확히 둔다.

### 3. P1 헥사고날 승격 대상

#### `auth`

`register`, `verifyEmail`, `resendVerificationEmail`, `acceptInvitation`, `login`, `refresh`, `getAccountSecurity`, `updateAccountProfile`, `changePassword`, `revokeOtherSession`, `logout`가 하나의 service에 몰려 있다. 또한 email sender, clock, session service, rate limit, security event, workspace bootstrap, audit event 등 협력자가 많아 승격 기준을 여러 개 충족한다.

목표:

- 인증/가입/초대/세션/계정보안 유스케이스를 분리
- token/verification/session/user store를 포트화
- 보안 이벤트와 메일 발송을 application boundary 밖으로 격리

#### `admin`

`admin-members.service.ts`는 멤버 조회, 초대, 역할 변경, 상태 변경, 제거, 메일 발송, 감사 기록까지 다룬다. Workspace Administration 컨텍스트에서 권한/멤버십은 핵심 규칙이므로, 최소한 `members` 하위 흐름은 승격하는 편이 안전하다.

목표:

- `InviteTenantMember`
- `UpdateTenantMemberRole`
- `UpdateTenantMemberStatus`
- `RemoveTenantMember`

를 개별 use-case로 분리하고, invitation token/email/audit/clock을 포트화한다.

#### `insurance-policies`

보험 계약은 Asset & Coverage 컨텍스트이지만, 실제로는 `monthlyPremiumWon`, 납부주기, 반복규칙 연동, 계약 활성 상태가 얽혀 있다. 파일 크기 기준도 넘겼고, 반복규칙과의 연동이 이미 `public.ts` 경계를 사용 중이라 승격에 필요한 연결선도 어느 정도 준비돼 있다.

목표:

- 계약 CRUD와 반복규칙 동기화 분리
- schedule 계산과 입력 정규화는 domain policy로 이동
- repository/adapter 경계 명시

#### `plan-items`, `financial-statements`, `carry-forwards`

세 모듈 모두 이미 use-case 방향으로 이동했지만 아직 direct Prisma/service 의존이 남아 있다. 이들은 각각 `계획 생성`, `공식 보고 스냅샷`, `차기 이월`이라는 중요한 경계라서 P1에서 구조를 완결하는 편이 좋다.

목표:

- `plan-items`: recurring read/write, existing item check, transaction type resolution 포트화
- `financial-statements`: snapshot read, journal aggregation, payload builder를 application/domain/infrastructure로 분리
- `carry-forwards`: source closing snapshot read, target opening create, duplicate guard를 포트화

### 4. 당장은 승격보다 내부 분해가 맞는 모듈

- `workspace-settings`
- `funding-accounts`
- `categories`
- `reference-data-readiness`
- `vehicles` API
- `navigation`
- `dashboard`
- `forecast`

이 모듈들은 지금 시점에서는 `대형 service 400+`, `돈/전표 write의 중심`, `복수 외부 협력자`, `복잡한 상태 전이`를 동시에 충족하지 않는다. 따라서 이번 라운드에서는 과도한 아키텍처 승격 대신, 읽기 저장소 분해나 UI 표면 분해 쪽이 더 효과적이다.

## 목표 구조 템플릿

### 1. Advanced(Hexagonal) 모듈 템플릿

```text
module/
  dto/
  public.ts
  module.ts
  controller.ts
  application/
    use-cases/
    ports/
  domain/
    policies/
    entities-or-value-objects/
  infrastructure/
    prisma/
    adapters/
```

원칙:

- controller는 요청/응답과 권한 컨텍스트만 다룬다.
- use-case는 하나의 비즈니스 작업만 조합한다.
- 순수 정책은 domain으로 보낸다.
- Prisma 접근은 infrastructure adapter로만 모은다.
- 모듈 밖 공식 진입점은 `public.ts`만 허용한다.

### 2. Read-model 모듈 템플릿

```text
module/
  dto/
  public.ts
  module.ts
  controller.ts
  application/
    read-services/
    use-cases/
  infrastructure/
    prisma/
      read-repositories/
    projections/
```

원칙:

- 요약/예외/상태/대시보드성 화면은 read service 중심으로 유지한다.
- write command만 별도 use-case로 분리한다.
- projection은 표현용 계산을 담당하고 write 규칙을 소유하지 않는다.

### 3. Web feature 분해 템플릿

```text
feature/
  page.tsx
  shell/
  sections/
  forms/
  dialogs/
  hooks/
  columns/
  api/
```

원칙:

- route 파일은 얇게 유지한다.
- feature shell은 화면 조립만 맡긴다.
- 표 컬럼, 폼 파생값, mutation/query orchestration은 별도 파일로 뺀다.

## 단계별 실행 순서

### Phase 0. 기준선 고정

- 이 문서를 프로젝트 전반 리팩토링 기준선으로 고정한다.
- `collected-transactions`, `recurring-rules`를 Advanced 참조 모듈로 삼는다.
- 새 구조 도입 시 `UTF-8`, `public.ts`, cross-module direct import 금지 원칙을 함께 고정한다.

### Phase 1. P0 핵심 경계 승격

1. `accounting-periods`
2. `import-batches`
3. `journal-entries`
4. `operations-console`

현재 상태: `완료`

이 순서를 고정했던 이유:

- `accounting-periods`는 나머지 write 흐름의 기간 보호막이기 때문이다.
- `import-batches`와 `journal-entries`는 실제 승격/전표/정정의 핵심 경계이기 때문이다.
- `operations-console`은 읽기 운영 표면의 복잡도를 가장 크게 낮출 수 있기 때문이다.

### Phase 2. P1 플랫폼/보조 도메인 승격

1. `auth`
2. `admin`
3. `insurance-policies`
4. `plan-items`
5. `financial-statements`
6. `carry-forwards`

현재 상태: `완료`

- 완료: `auth`, `admin`, `insurance-policies`, `plan-items`, `financial-statements`, `carry-forwards`

### Phase 3. Web 대형 파일 분해

1. `accounting-periods-page.tsx`
2. `financial-statements-page.tsx`
3. `carry-forwards-page.tsx`
4. `journal-entries-page.tsx`
5. `insurance-policy-form.tsx`
6. `recurring-rules-page.tsx`
7. `admin-members-page.tsx`
8. `forecast-page.tsx`
9. `imports.api.ts`
10. `dashboard-page.tsx`

기존 `docs/completed/UI_REORGANIZATION_EXECUTION_PLAN_V2.md`가 하위 라우트 책임 분리를 다뤘다면, 이번 단계는 route 내부의 page shell, section, form, dialog, query orchestration을 다시 분해하는 작업이다.

현재 상태: `완료`

- 완료: `dashboard-page.tsx`, `forecast-page.tsx`, `imports.api.ts`, `admin-members-page.tsx`, `insurance-policy-form.tsx`, `recurring-rules-page.tsx`, `financial-statements-page.tsx`, `financial-statements-page.sections.tsx`, `carry-forwards-page.tsx`, `journal-entries-page.tsx`, `vehicles-page.tsx`, `recurring-rule-form.tsx`, `insurance-policies-page.tsx`, `accounting-periods-page.tsx`, `accounting-periods-page.sections.tsx`
- 검증 기준: `apps/web/src/features` 아래 500줄 이상 파일 없음

### Phase 4. 검증/정착

현재 상태: `후속 과제`

이 단계는 구조적 승격/분해와 다른 검증/정착 단계로, 별도 계획에서 관리한다.

- 승격된 write 모듈은 순수 정책 단위 테스트를 우선 늘린다.
- request API 테스트는 controller/use-case 경계를 기준으로 다시 정리한다.
- 대표 E2E 시나리오는 `periods -> imports -> transactions -> journal-entries -> financial-statements -> carry-forwards` 흐름을 유지한다.

## 모듈별 실행 체크리스트

### `accounting-periods`

- `service`에 남은 period write 보호 로직을 use-case/port로 이동
- journal number 할당과 period claim을 명시적 application capability로 승격
- `close/open/reopen` 공통 검증을 domain policy로 이동
- 잠금/재오픈/이력 생성 테스트를 강화

### `import-batches`

- upload/list/detail/preview/collect 유스케이스 분리
- `ImportedRow` 정규화, auto-preparation, duplicate candidate 판단을 domain policy로 이동
- period/date 허용 검증을 모듈 경계 밖 service 직접 참조에서 분리
- preview와 collect가 동일한 평가 모델을 재사용하도록 정리

### `journal-entries`

- correction/reversal 생성 로직을 저장소 포트 기반으로 정리
- 잠금 기간 쓰기 보호를 전표 모듈에서 명시적으로 의존
- source collected transaction 수정 가능성 검증을 안정된 공식 경계로만 사용
- read service와 write use-case를 분리 유지

### `operations-console`

- hub/checklist/exceptions/month-end/import-status/system-status/alerts read service 분리
- export payload builder를 scope별 projection으로 분리
- notes/create export는 command use-case로 이동
- mega service 제거 후 모듈 public surface를 단순화

### `auth`

- register/verify/login/refresh/logout/accept-invitation/change-password/profile/session revoke 분리
- verification token, session, user lookup, audit, email, rate-limit 경계를 포트로 정리
- 보안 이벤트와 계정 상태 변경 테스트를 use-case 기준으로 재정렬

### `admin`

- invitation lifecycle와 membership lifecycle 분리
- Owner 최소 인원 보장, 중복 active membership 차단, blocking invitation 차단 정책을 domain policy로 이동
- 메일 발송/토큰 생성/감사 기록은 포트화

### `insurance-policies`

- 입력 정규화와 주기 계산 분리
- 보험 계약 CRUD와 recurring rule linkage 분리
- 중복 판정과 활성 상태 정책을 domain policy로 이동

### Web

- page 파일은 화면 조립만 남기고, query/mutation state와 파생 계산을 hook 파일로 분리
- table column, drawer/dialog content, form section을 독립 파일로 분리
- 긴 설명 블록은 `DomainHelpDrawer` 또는 보조 section으로 이동

## 완료 정의

아래 항목을 만족해야 한 모듈의 리팩토링이 끝난 것으로 본다.

- controller가 얇아지고 유스케이스 단위가 명확하다.
- cross-module direct import가 제거되거나 공식 경계로 축소됐다.
- Prisma 접근이 service 곳곳에 흩어지지 않고 adapter/repository로 모였다.
- 순수 정책은 DB 없는 테스트가 가능하다.
- 대형 page/service 파일이 더 이상 단일 변경 병목이 아니다.
- 문서, 테스트, public surface가 새 구조와 일치한다.

## 이번 계획의 최종 우선순위

1. `accounting-periods`, `import-batches`, `journal-entries`를 Core Ledger P0 승격 대상으로 고정한다.
2. `operations-console`은 Hexagonal이 아니라 read-model 분리 대상으로 고정한다.
3. `auth`, `admin`, `insurance-policies`, `plan-items`, `financial-statements`, `carry-forwards`를 P1 승격 대상으로 묶는다.
4. Web은 기존 라우트 재정리 이후 남은 대형 page/form/api 파일 분해 라운드로 진행한다.
5. `collected-transactions`, `recurring-rules`는 참조 구현으로 유지하며 새 승격의 기준점으로 사용한다.
