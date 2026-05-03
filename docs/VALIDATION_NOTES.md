# 검증 메모

이 문서는 **현재 구현 상태의 검증 범위**를 기록합니다.  
비즈니스 흐름, 상태, 권한, 엔티티의 최종 기준은 `docs/domain/business-logic-draft.md`, `docs/domain/core-entity-definition.md`를 우선합니다.

## 현재 기본 검증 기준

- `npm run check:quick`
- `npm run test`
- `npm run money:check`

설명:

- `npm run check:quick`는 Prettier, 문서의 `npm run` 명령 정합성 검사, 문서의 Web/API surface 정합성 검사, 금액 raw 연산 가드, lint, typecheck를 함께 확인합니다.
- 현재 문서 정합성 검사는 `npm run docs:check`로도 단독 실행할 수 있습니다.
- `npm run money:check`는 `apps/api/src`, `apps/web/src`, `packages/contracts/src`에서 money package 밖의 금액 필드 `Number(...)`, raw `+/-`, `+=/-=` 유입을 보수적으로 막습니다.
- `npm run docs:check:npm-run`는 `README.md`, `CONTRIBUTING.md`, `ENVIRONMENT_SETUP.md`, `docs/**/*.md`의 `npm run` 표기를 루트/workspace 스크립트와 대조합니다.
- `npm run docs:check:surface`는 `docs/API.md`, `docs/CURRENT_CAPABILITIES.md`, `docs/OPERATIONS_CHECKLIST.md`, `docs/VALIDATION_NOTES.md`의 Web/API surface가 실제 `apps/web/app` 라우트와 controller 기반 Swagger surface와 맞는지 확인합니다.

## 금액 정합성 검증 기준

- HTTP 계약의 금액은 `MoneyWon` 의미의 `number`이며, KRW 원 단위 safe integer만 허용합니다.
- Prisma 금액 컬럼은 `Decimal(19,0)`로 저장하고 mapper 경계에서 `Prisma.Decimal -> MoneyWon(number)`로 변환합니다.
- `HALF_UP` 반올림과 배분 잔차 보정은 `@personal-erp/money`의 `decimal.js` 기반 helper로 고정합니다.
- 금액 합계, 차감, 배분, 업로드 파싱 회귀는 `apps/api/test/money-won.test.ts`와 API/Web 요청 테스트에서 확인합니다.

## 대표 심화 검증

- `npm run test:e2e:smoke:build:browser`
- `npm run test:e2e`
- `npm run test:prisma`
- `npm run audit:runtime:full`

설명:

- `npm run test:e2e:smoke:build:browser`는 CI와 동일한 루트 래퍼 명령이며, 내부적으로 Web workspace의 browser build smoke를 호출합니다.
- 이 명령은 로그인/세션 복원/운영 체크리스트/현재 작업 기준 fallback까지 포함한 브라우저 build smoke를 다시 확인합니다.
- `npm run test:e2e:smoke:build`는 브라우저 없는 in-process `Next.js` production build/start 경로와 health route 기준 최소 HTTP smoke를 별도로 확인할 때 사용합니다.
- `npm run test:e2e`는 기준 데이터 CRUD, 반복 규칙 CRUD까지 포함한 전체 브라우저 대표 흐름 검증입니다.
- `npm run test:prisma`는 기본 루프와 분리된 실DB Prisma/HTTP 통합 검증이며, Docker 기반 disposable MySQL을 띄운 뒤 `prisma generate -> prisma migrate deploy -> minimal fixture seed -> UUID 범위 fixture/test -> teardown`을 한 명령으로 수행합니다. 현재는 수집 거래 저장소 경계 1개와 실제 API/DB 월 운영 workflow 4개를 포함합니다. workflow는 `운영기간 open -> 업로드 배치 -> 수집 -> 전표 확정 -> close`, `반복규칙 -> plan item 생성 -> import collect 자동 매칭 -> confirm -> 재무제표 생성`, `close -> 재무제표 생성 -> reopen -> 전표 reverse/correct`, `carry-forward 생성 이후 source period reopen 409 보호` 시나리오를 검증합니다.
- `npm run audit:runtime:full`은 allowlist 적용 없이 현재 runtime advisory 전체를 다시 확인할 때 사용하는 follow-up 명령입니다.
- 현재 기본 `npm run test`에서는 Prisma 통합 테스트가 안내 문구와 함께 skip됩니다.

## 2026-05-03 문서 정합성 점검

이번 문서 점검의 파일 조회와 수정은 UTF-8 기준으로 수행했습니다.

- `npm run docs:check`: 통과
  - Markdown 59개 파일의 `npm run` 명령 참조 300개 확인
  - Web route 61개, API operation 136개, `docs/API.md` route map 61개 확인
  - `docs/CURRENT_CAPABILITIES.md`, `docs/OPERATIONS_CHECKLIST.md`, `docs/VALIDATION_NOTES.md`의 Web/API surface 정합성 확인
- 수동 대조:
  - `docs/` 전체 Markdown 제목 구조와 완료 문서 인덱스를 확인
  - `apps/web/app` 라우트, `apps/api/src/modules/*Controller`, `packages/contracts/src` 계약 파일을 현재 구현 surface 기준으로 대조
  - Markdown 상대 링크를 UTF-8 읽기 기준으로 점검했고 깨진 내부 링크는 발견하지 않음
- 정리:
  - `docs/PROJECT_PLAN.md`의 완료 작업 장기 목록을 압축하고, 세부 이력은 `docs/completed/README.md`와 `docs/VALIDATION_NOTES.md`를 우선하도록 정리
  - `docs/README.md`, `docs/domain/README.md`에 현재 기준 문서와 설계/이력 문서의 우선순위를 명시
  - ASVS 실행계획이 현재는 P0-P5 완료 후 운영 리허설 추적 문서임을 명시
  - 도메인 문서의 SaaS 확장 모델 중 아직 구현되지 않은 `TenantSubscription`, `SupportAccessGrant` 성격을 현재 MVP 범위와 분리
  - 완료 전 작업 지시문이 남아 있던 `ASVS_L2_EXECUTION_PLAN.md`를 완료 단계 요약과 남은 운영 항목 중심으로 압축
  - `PORTFOLIO_ARCHITECTURE_GUIDE.md`, `ENVIRONMENT_SETUP.md`, `CURRENT_CAPABILITIES.md`, `ACCOUNTING_MODEL_BOUNDARY.md`의 도입부 반복 문구를 제거

## 2026-05-01 문서 최신화 점검

이번 문서 점검의 파일 조회와 수정은 UTF-8 기준으로 수행했습니다.

- `npm run docs:check`: 통과
  - Markdown 58개 파일의 `npm run` 명령 참조 308개 확인
  - Web route 61개, API operation 136개, `docs/API.md` route map 61개 확인
  - `docs/CURRENT_CAPABILITIES.md`, `docs/OPERATIONS_CHECKLIST.md`, `docs/VALIDATION_NOTES.md`의 Web/API surface 정합성 확인
- 수동 대조:
  - `apps/api/src/config/api-env.ts`, `env-examples/api.env.example`, `env-examples/deploy.compose.env.example` 기준으로 운영 체크리스트 env 목록을 보정
  - `docker-compose.prod.yml`, `Dockerfile`, `build-docker-images.bat` 기준으로 Docker 배포 문서의 현재 저장소 경로와 태그 예시를 보정
  - `docs/completed/` 실제 보관 파일 목록과 완료 문서 인덱스를 대조해 누락 항목을 추가
  - ASVS ADR의 작성 당시 표현과 현재 구현 상태가 충돌하지 않도록 현재 판정 우선 문서를 명시
  - `CONTRIBUTING.md`와 `pull_request_template.md`의 구조 규칙, 문서 갱신 대상, 검증 체크리스트를 현재 문서 체계에 맞게 보정
  - Web 공통 오류 진단 정보와 모바일 `DataTableCard` 페이지네이션 기준을 `README.md`, `docs/API.md`, `docs/CURRENT_CAPABILITIES.md`, `docs/DEVELOPMENT_GUIDE.md`, `docs/DESIGN_SYSTEM.md`, `docs/ERROR_HANDLING_AND_LOGGING.md`, `docs/OPERATIONS_CHECKLIST.md`, `docs/PROJECT_PLAN.md`에 반영
- 추가 포맷 확인:
  - `npm run format:check -- --end-of-line auto`: 통과

## 2026-05-02 보완사항 반영 점검

이번 보완 작업의 파일 조회, 생성, 수정은 UTF-8 기준으로 수행했습니다.

- 업로드 배치 일괄 등록의 만료 잠금 리컨실러를 추가해 `PENDING/RUNNING` Job이 오래된 lock 뒤에 남는 경우 자동으로 `FAILED/PARTIAL/SUCCEEDED` 종결 상태로 정리되게 했습니다.
- 비밀번호 재설정 만료시간을 `PASSWORD_RESET_TTL`로 분리했고, 미설정 시 `EMAIL_VERIFICATION_TTL`을 따릅니다. 메일 문구도 실제 TTL에서 계산한 문구를 사용합니다.
- 인증 rate limit은 여전히 프로세스 메모리 adapter지만, 만료 bucket sweep과 최대 bucket cap을 추가했고 운영 체크리스트에 reverse proxy/WAF/API gateway rate limit 병행 원칙을 명시했습니다.
- Dependabot 예약 업데이트 설정은 만들지 않습니다. GitHub가 주기적으로 업데이트 PR용 브랜치를 만들지 않게 하고, 의존성 점검은 `npm run audit:runtime`, `npm run audit:runtime:full`, 필요 시 수동 업데이트로 관리합니다.
- `npm run audit:runtime`은 high/critical gate 기준 통과하지만, `npm run audit:runtime:full`은 2026-05-02 기준 `next@15.5.15 -> postcss@8.4.31` 경유 moderate advisory가 남습니다. `npm audit fix --force`는 `next@9.3.3`으로 낮추는 위험한 제안이므로 적용하지 않고 upstream compatible patch를 추적합니다.

## 2026-04-30 ASVS L2 보강 검증

이번 ASVS 보강 작업의 파일 읽기, 생성, 수정은 UTF-8 기준으로 수행했습니다.

- `npm run docs:check`: 통과
- `npm run test:security:api`: 통과, tests 315, pass 309, skipped 6
- `npm run test:web`: 통과, tests 31, pass 31
- `npm run audit:runtime`: 통과, high 0, critical 0, total 3, allowlist 0
- `npm run build`: 통과
- 변경 파일 대상 `npx prettier --check ...`: 통과

비고:

- API 테스트 중 `Opening balance snapshot create failed` Nest error log는 rollback 경계를 검증하는 기존 의도적 실패 fixture에서 발생하며, 테스트 exit code는 0입니다.
- Docker 기반 `semgrep-ce`, `gitleaks` 로컬 재현은 이번 턴에서 실행하지 않았고, CI 보안 잡 결과를 기본 증적으로 봅니다.

## CI 게이트

- `validate`
  `npm run check:quick`와 `npm run test`를 조합해 포맷, 문서 명령 정합성, 문서 Web/API surface 정합성, lint, typecheck, 기본 테스트를 확인합니다.
- `e2e-smoke`
  `npm run test:e2e:smoke:build:browser`로 CI와 같은 production build/start 기준 브라우저 smoke를 다시 확인합니다.

- `security-regression`
  `npm run test:security:api`로 인증/세션, 브라우저/API 경계 회귀를 CI에서 다시 확인합니다.
- `prisma-integration`
  `npm run test:prisma`로 disposable MySQL을 부팅하고 migration과 실제 MySQL 경계 시나리오를 수행합니다. 더 이상 GitHub secret 부재를 성공 skip으로 처리하지 않습니다.
- `audit-runtime`
  `npm run audit:runtime`으로 실제 배포 대상인 `api`, `web` workspace의 runtime dependency를 점검하고, 현재 CI 게이트는 `high` 임계값 기준으로 실패를 판정합니다. 예외가 필요하면 `security/runtime-audit-allowlist.json`에 만료일과 사유를 남기며, 만료되었거나 더 이상 필요 없는 entry는 gate가 바로 실패합니다.
- `semgrep-ce`
  Semgrep CE 정적 분석을 수행합니다.
- `gitleaks`
  저장소 전체 secret 노출 여부를 점검합니다.

설명:

- 로컬 기본 검증은 `check:quick`와 `test`가 맡고, CI는 여기에 품질/보안 게이트를 추가해 회귀를 막습니다.
- 2026-04-22 기준 GitHub CI 첫 통과 증적과 required check 연결, Docker 환경의 `npm run test:prisma`, GitHub `prisma-integration` 통과는 확인 완료된 상태로 봅니다.
- Windows에서 `core.autocrlf=true` checkout을 쓰면 `check:quick`의 Prettier 단계가 EOL 차이로 과검출될 수 있으므로, CI와 같은 LF 기준 확인이 필요할 때는 `npm run format:check -- --end-of-line auto`를 함께 봅니다.
- `npm run audit:runtime`은 네트워크가 필요한 명령이라 로컬보다 CI 결과를 기본 증적으로 봅니다. 다만 현재 게이트 로직은 `security/runtime-audit-allowlist.json`의 만료/불필요 entry도 함께 검사합니다.
- `semgrep-ce`, `gitleaks`는 로컬에서 동일하게 재현하려면 Docker가 필요합니다.
- `semgrep-ce`는 build 산출물, test 산출물, migration, 운영 보조 script만 제외하고 애플리케이션 코드는 스캔 대상으로 둡니다.
- 따라서 Web의 공통 인증 fetch 경계인 `apps/web/src/shared/api/fetch-json.ts`도 Semgrep 제외 대상이 아닙니다.

## 현재 테스트 범위

### API

- 인증 로그인 성공/실패
- 회원가입 `POST /auth/register`, 이메일 인증 `POST /auth/verify-email`, 인증 메일 재발송 `POST /auth/resend-verification`, 초대 수락 `POST /auth/accept-invitation`
  회원가입 성공 시 refresh cookie를 발급하지 않는지, 필수 약관/개인정보 동의 누락 차단, 인증 전 로그인 차단, 인증 완료 후 workspace/ledger/OWNER membership bootstrap, 중복 이메일 일반화 응답, 잘못된/만료/소비된 토큰, 재발송 토큰 교체, 초대 수락 후 membership 활성화, register/verify/resend rate limit, allowlist 밖 origin 차단을 검증
- 인증 세션 생성/회전/로그아웃
- 보호 라우트의 `401`
- `GET /auth/me`
- `GET /auth/workspaces`, `POST /auth/current-workspace`
  초대 등으로 여러 사업장 멤버십이 있는 사용자가 접근 가능한 사업장 목록을 확인하고, 현재 세션의 사업장/장부 기준을 명시적으로 전환하며, 전환 후 `GET /auth/me`가 선택 사업장을 반환하는지 검증
- `GET /auth/account-security`, `PATCH /auth/account-profile`, `POST /auth/change-password`, `DELETE /auth/sessions/:sessionId`
  현재 사용자 프로필/세션/최근 이벤트 조회, 이름 수정, 비밀번호 변경, 다른 활성 세션 종료를 검증
- `GET /settings/workspace`, `PATCH /settings/workspace`
  현재 workspace/ledger 설정 조회와 Owner/Manager 수정, Viewer 거부를 검증
- 관리자 `GET /admin/members`, `POST /admin/members/invitations`, `PATCH /admin/members/:membershipId/role`, `GET /admin/audit-events`
  current workspace 멤버 목록, 초대 메일 발송, 역할 변경, 마지막 활성 Owner 보호, 권한 거부 감사 이벤트, 감사 로그 조회를 검증
- 관리자 `GET /admin/policy`
  현재 workspace의 Owner/Manager가 권한 정책 요약을 조회할 수 있는지 검증
- 전체 관리자 `GET /admin/users`, `GET /admin/users/:userId`, `PATCH /admin/users/:userId/status`, `POST /admin/users/:userId/revoke-sessions`, `PATCH /admin/users/:userId/system-admin`, `PATCH /admin/users/:userId/email-verification`
  사용자 상세 조회, 계정 잠금/해제, 전체 세션 만료, 마지막 전체 관리자 보호, 이메일 인증 보정, 권한 거부를 검증
- 전체 관리자 `GET /admin/tenants`, `GET /admin/tenants/:tenantId`, `PATCH /admin/tenants/:tenantId/status`
  사업장 상세 조회, 상태 변경, 기본 장부/멤버 요약과 권한 거부를 검증
- 전체 관리자 `GET /admin/support-context`, `POST /admin/support-context`, `DELETE /admin/support-context`
  지원 문맥 설정/해제, 세션 기준 current workspace 반영, 일반 사용자 접근 차단을 검증
- 전체 관리자 `GET /admin/operations/status`, `GET /admin/security-threats`
  운영 상태 요약, 최근 실패/거부 감사 이벤트, 최근 보안 위협 로그 조회와 권한 거부를 검증
- `GET /funding-accounts`, `GET /categories`, `GET /account-subjects`, `GET /ledger-transaction-types`, `GET /insurance-policies`, `GET /liabilities`, `GET /liabilities/overview`, `GET /vehicles`, `GET /vehicles/operating-summary`
  현재 workspace/ledger 기준 활성 참조 데이터와 운영 보조 자산 데이터만 반환하는지 검증
- `GET /insurance-policies?includeInactive=true`, `POST /insurance-policies`, `PATCH /insurance-policies/:id`
  Owner/Manager 전용 보험 계약 생성, 수정, 비활성화/재활성화와 workspace 범위 접근통제를 검증
- `POST /liabilities`, `PATCH /liabilities/:id`, `POST /liabilities/:id/archive`, `GET /liabilities/:id/repayments`, `POST /liabilities/:id/repayments`, `PATCH /liabilities/:id/repayments/:repaymentId`, `POST /liabilities/:id/repayments/:repaymentId/generate-plan-item`
  Owner/Manager/Editor 부채 계약·상환 일정 관리, 현재 운영월 계획 항목/수집 거래 생성, 상환 확정 시 원금/이자 분리 전표 경계를 검증
- `POST /vehicles`, `PATCH /vehicles/:id`
  Owner/Manager 전용 차량 기본 정보 생성, 수정과 workspace 범위 접근통제를 검증
- `GET /vehicles/fuel-logs`, `POST /vehicles/:id/fuel-logs`, `PATCH /vehicles/:vehicleId/fuel-logs/:fuelLogId`
  Owner/Manager 전용 차량 연료 이력 생성, 수정, 선택적 수집거래 생성, 차량 연결 수집거래의 직접 수정 차단, 전표 확정 후 차량 기록 수정 차단, workspace 범위 접근통제를 검증
- `GET /vehicles/maintenance-logs`, `POST /vehicles/:id/maintenance-logs`, `PATCH /vehicles/:vehicleId/maintenance-logs/:maintenanceLogId`
  Owner/Manager 전용 차량 정비 이력 생성, 수정, 선택적 수집거래 생성, workspace 범위 접근통제를 검증
- `GET /reference-data/readiness`
  현재 workspace 기준 기준 데이터 readiness, ownership 구분, 부족 항목 요약을 검증
- `POST /funding-accounts`, `POST /funding-accounts/:id/bootstrap`, `PATCH /funding-accounts/:id`, `DELETE /funding-accounts/:id`
  Owner/Manager 전용 자금수단 생성, 신규 은행/카드 `bootstrapStatus=PENDING`, 기초금액 입력 기반 기초전표 발행과 bootstrap 완료, 금액 없는 완료 전환, 이름 변경, 비활성화/재활성화, 비활성 자금수단 종료, 미사용 자금수단 삭제, 거래내역이 있는 자금수단 삭제 차단과 workspace 범위 접근통제를 검증
- `POST /categories`, `PATCH /categories/:id`
  Owner/Manager 전용 카테고리 생성, 이름 변경, 비활성화/재활성화와 workspace 범위 접근통제를 검증
- `GET /accounting-periods`, `GET /accounting-periods/current`, `POST /accounting-periods`, `POST /accounting-periods/:id/close`, `POST /accounting-periods/:id/reopen`
  최신 진행월 중심 기간 open/close/reopen, snapshot 생성/정리, 차기 이월 이후 reopen 차단, role 기반 접근통제를 검증
- `GET /collected-transactions`, `POST /collected-transactions`, `POST /collected-transactions/:id/confirm`
  DTO validation, 현재 workspace 접근 범위 내 참조 검증, 생성/확정 응답 shape와 전표 연계를 검증
- `POST /collected-transactions/:id/confirm`
  운영 기간 `nextJournalEntrySequence` 기반 전표 번호 할당과 transaction boundary 안 재검증을 검증
- `GET /journal-entries`, `POST /journal-entries/:id/reverse`, `POST /journal-entries/:id/correct`
  최근 전표 조회, reverse/correct 조정 흐름, period-local 전표 번호 sequence, role 기반 접근통제를 검증
- `POST /recurring-rules`
  DTO validation, 현재 workspace 접근 범위 내 계정/카테고리 검증, 생성 응답 shape
- 계획 항목 생성 정책과 service/view 조합
- 계획 항목 view에 매칭 수집 거래 제목/상태와 전표 번호가 함께 실리는지 검증
- 거래/반복규칙 use-case 생성 로직
- `GET /import-batches`, `GET /import-batches/:id`, `POST /import-batches`, `POST /import-batches/files`, `POST /import-batches/:id/rows/:rowId/collect-preview`, `POST /import-batches/:id/rows/:rowId/collect`
  UTF-8 텍스트 업로드 파싱, IM뱅크 PDF multipart 업로드, row collect preview, 운영월 자동 생성 사유 표시, duplicate fingerprint 처리, 자동 계획 매칭/카테고리 보완 설명, role 기반 접근통제를 검증
- `POST /import-batches/files`
  IM뱅크 PDF 업로드의 활성 계좌/카드 연결 필수 조건, PDF magic bytes/확장자/content-type/10MB 제한, 텍스트 레이어 없는 스캔 PDF 명시 차단, 원본 PDF 미저장과 행 단위 payload 저장을 검증
- `POST /import-batches/:id/rows/:rowId/collect`
  최신 진행월 범위 수집, 운영 중 임의 과거월/신규 운영월 생성 차단, 신규 계좌/카드 bootstrap 자동 운영월 생성과 완료 전환, 신규 계좌/카드 bootstrap의 회계 이력 가드, 반복 수집 거래 흡수 claim, 이미 다른 업로드 행과 연결된 대상의 `409 Conflict`, 같은 업로드 행 재수집 방지를 검증
- `POST /import-batches/:id/rows/collect`, `GET /import-batches/:id/collection-jobs/active`, `GET /import-batches/:id/collection-jobs/:jobId`, `POST /import-batches/:id/collection-jobs/:jobId/cancel`
  선택 행 또는 등록 가능 행 전체의 일괄 등록 Job 생성, 입출금 방향 기반 수입/지출/취소 유형 추론, 거래유형별 카테고리/메모 적용, 운영월 자동 생성 사유별 결과 메시지, 진행률/행별 결과 조회, 일괄 등록 Job 중단 요청, 같은 workspace 내 동시 일괄 등록 잠금과 단건 등록 충돌 보호를 검증
- 계획 항목 generate use case
  최신 진행월 밖 생성 차단, `periodId + recurringRuleId + plannedDate` DB unique 경합을 `skip`으로 해석하고 `createdCount/skippedExistingCount`가 실제 commit 결과와 맞는지 검증하며, 운영월 부채 상환 예정도 계획 항목과 전표 준비 수집 거래로 연결되는지 확인
- `POST /financial-statements/generate`, `GET /financial-statements`
  잠금 기간 공식 snapshot 생성/조회와 비교 view 조합을 검증
- `POST /carry-forwards/generate`, `GET /carry-forwards`
  closing snapshot 기반 opening balance snapshot 전용 차기 이월 생성과 조회, `createdJournalEntryId=null` 정책과 별도 `CARRY_FORWARD` 전표 미생성을 검증
- `OperationalAuditPublisher`
  외부 감사 sink 실패가 workspace 감사 이벤트/기간 상태 이력/업로드 Job/전표 조정 발행 경계에서 핵심 회계 트랜잭션을 깨지 않도록 비동기 실패 흡수를 검증
- 대시보드 요약 계산
- 예측 잔액 계산
- `GET /health`, `GET /health/ready`
- `x-request-id` 헤더 전달
- 허용된 origin에 대한 CORS/security header 적용
- 인증/민감 응답의 `Cache-Control: no-store`
- allowlist 밖 origin의 cookie-auth 요청 차단(`403 Origin not allowed`)
- 로그인 실패, refresh 재사용, bearer 누락, scope 거부, readiness 실패에 대한 보안 이벤트 로그 기록
- `test:prisma`
  실제 MySQL 기준으로 현재 workspace 접근 범위 확인, 수집 거래 저장소 경계, 실제 API를 통한 `register -> verify-email -> login -> auth/me`, 기간/업로드/수집/전표/보고/재오픈/차기 이월 보호 대표 시나리오를 함께 검증
- `GET /collected-transactions`
  현재 구현 기준 current workspace 범위만 반환하는지, 내부 접근 제어 필드를 노출하지 않는지 검증
- `GET /recurring-rules`
  현재 구현 기준 current workspace 범위만 반환하는지, 내부 접근 제어 필드를 노출하지 않는지 검증
- `GET /dashboard/summary`
  다른 workspace/ledger 데이터가 집계에 섞이지 않고 raw read model을 노출하지 않는지 검증
- `GET /funding-account-status/summary`
  현재 구현 기준 선택 기간/자금수단 범위에서 수집 거래 기준과 확정 전표 기준의 자금수단별 수입, 지출, 이체, 잔액 현황을 반환하는 read model입니다. 전용 요청 단위 회귀 테스트로 기간과 자금수단 필터, current workspace 범위, 거래 목록, 경고 메시지, 자금수단별 합계가 함께 검증됩니다.
- `GET /forecast/monthly`
  현재 구현 기준 current workspace 집계만 사용하고 month query를 그대로 반영하는지 검증
- `GET /operations/summary`, `GET /operations/checklist`, `GET /operations/exceptions`, `GET /operations/month-end`, `GET /operations/import-status`, `GET /operations/system-status`, `GET /operations/alerts`, `GET/POST /operations/exports`, `GET/POST /operations/notes`
  운영 허브 read model, 체크리스트/예외/마감/업로드 현황, 시스템 상태/알림, 수동 UTF-8 CSV 반출, 운영 메모 저장과 감사 로그 기록을 검증

### Web

- env 파싱
- demo fallback 활성화/비활성화 정책
- 보호 요청의 Bearer 토큰 주입
- `401` 응답 시 세션 정리 정책
- mutation 요청의 JSON body 직렬화
- 회원가입/이메일 인증/인증 메일 재발송 auth API helper의 요청 path와 body 직렬화
- `/accept-invitation`, `/admin`, `/admin/users`, `/admin/tenants`, `/admin/support-context`, `/admin/security-threats`, `/admin/operations`, `/admin/members`, `/admin/logs`, `/admin/policy` 관리자/초대/권한 정책 route와 admin API helper의 보호 요청 path, Bearer token, mutation body 직렬화
- `/settings/workspace`, `/settings/account/profile`, `/settings/account/password`, `/settings/account/sessions`, `/settings/account/events` 설정 route와 workspace/account API helper의 보호 요청 path, Bearer token, mutation body 직렬화
- `/operations`, `/operations/checklist`, `/operations/exceptions`, `/operations/month-end`, `/operations/imports`, `/operations/status`, `/operations/alerts`, `/operations/exports`, `/operations/notes` 운영 지원 route와 operations API helper의 보호 요청 path, Bearer token, mutation body 직렬화
- 요청 실패 메시지 안내
  공통 `fetch-json` 경계에서 네트워크 실패, 인증 만료, 개발자식 API 문구, 권한 정책 문구, validator 배열 메시지를 사용자용 문구로 변환하고 `errorCode`, HTTP 상태, 요청 경로, `requestId`, `technicalMessage`, 원본 응답 본문을 개발자 진단 정보로 보존하는지 검증
- 브라우저에서 `/transactions` 보호 라우트(Collected Transactions 화면) 리다이렉트
- 브라우저 기준 로그인 후 세션 복원
- 실제 브라우저 상호작용으로 거래 Quick Add 성공 및 목록 갱신
- `/transactions` 진입 시 기준 데이터 readiness API가 함께 조회되어도 브라우저 스모크가 계속 통과하는지 검증
- 실제 브라우저 상호작용으로 `/reference-data`에서 자금수단 생성, 수정, 비활성화/재활성화, 비활성 자금수단 종료, 미사용 자금수단 삭제와 카테고리 생성/수정/비활성화/재활성화가 동작하는지 검증
- 실제 브라우저 상호작용으로 `/recurring`에서 반복 규칙 생성, 수정, 삭제와 목록 반영이 동작하는지 검증
- 실제 브라우저 상호작용으로 `/insurances`에서 보험 계약 생성, 수정, 비활성화와 목록 반영이 동작하는지 검증
- 실제 브라우저 상호작용으로 `/vehicles`에서 차량 생성, 수정, 연료 이력 생성/수정, 정비 이력 생성/수정과 목록 반영이 동작하는지 검증
- API 요청 테스트로 차량 연료/정비 저장 시 선택적 수집거래가 생성되는지, 차량에서 생성된 연결 수집거래가 거래 화면 직접 수정/삭제 경로에서 차단되는지, 미확정 연결 수집거래가 차량 로그 삭제와 함께 정리되는지, 전표 확정 이후 차량 기록 수정/삭제가 차단되는지 검증
- 실제 브라우저 상호작용으로 `/plan-items/generate`에서 현재 월 계획 항목과 연결 반복성 수집 거래를 생성하고, `/plan-items`에서 상태를 확인하며 `dashboard`/`funding-account-status`/`forecast` 반영, `/financial-statements` 생성, `/carry-forwards` 생성과 차기 이월 basis note 반영이 동작하는지 검증
- 실제 브라우저 상호작용으로 `/imports` 업로드 배치에서 행을 기존 계획 기반 수집 거래에 흡수/매칭하거나 새 수집 거래로 등록한 뒤 `/transactions`에서 전표 확정을 실행하고 `/journal-entries`에서 생성 전표를 여는 월 운영 cross-feature 흐름을 검증
- API 요청 테스트로 IM뱅크 PDF 업로드와 업로드 배치 일괄 등록 Job/진행률/동시 작업 잠금 경계를 검증하고, Web 단위에서는 일괄 등록 버튼/진행률 표시와 API helper path를 함께 확인
- 루트 `ci:local:*` 스크립트와 `docs/DEVELOPMENT_GUIDE.md` 매핑표로 GitHub Actions 주요 job을 로컬에서 다시 따를 수 있는 진입점을 제공
- `npm run test:e2e:smoke:build:browser`로 로그인/세션 복원, 운영 체크리스트 핵심 CTA, 현재 작업 기준 fallback 같은 브라우저 build smoke를 루트 래퍼 경로로 검증
- `npm run test:e2e:smoke:build`는 브라우저 없는 in-process production build/start 경로와 health route 기준 최소 HTTP smoke가 필요할 때 별도로 검증
- CI의 `e2e-smoke` 잡은 개발 서버가 아니라 build 결과물 기준 브라우저 smoke를 실행
- 실제 브라우저 상호작용으로 `dashboard`, `funding-account-status`, `reference-data`, `periods`, `insurances`, `vehicles`, `recurring`, `plan-items`, `imports`, `transactions`, `journal-entries`, `financial-statements`, `carry-forwards`, `forecast`, `settings`, `admin`, `operations`의 대표 운영 체크리스트 empty state, readiness 경고, fallback CTA가 유지되는지 검증
- 기준 데이터 CRUD, 반복 규칙 CRUD, 보험 계약 CRUD, 차량 기본 정보 CRUD 브라우저 검증은 현재 `npm run test:e2e` 전체 브라우저 회귀 범위에 남기고, CI smoke에서는 제외합니다.

## 현재 남아 있는 공백

- 간결 헤더와 `도메인 가이드` 노출, 페이지 전환 시 도움말 문맥 정리 동작은 현재 전용 자동 테스트가 없음
- 모바일 카드 목록의 5/10/20개 페이지네이션은 공통 `DataTableCard` 단위 타입체크/린트/웹 테스트로 보호되며, 전용 브라우저 E2E는 아직 없음
- `/funding-account-status`의 기준 토글, 자금수단 필터, 차트/거래 테이블 상호작용은 현재 전용 브라우저 E2E가 없음
- 루트 `/` 공개 홍보 메인의 비로그인 CTA와 인증 사용자 `/dashboard` 이동은 현재 전용 자동 테스트가 없음
- Docker가 없는 개발 PC에서는 `test:prisma`, `semgrep-ce`, `gitleaks`를 로컬에서 CI와 동일하게 재현하기 어려움
- Windows `core.autocrlf=true` checkout에서는 `npm run check:quick`의 Prettier 단계가 CI(Ubuntu LF 기준)와 다르게 보일 수 있음

## 최근 닫힌 공백

- 차량 연료/정비 이력 분리, `GET /vehicles/operating-summary` projection 추가, 차량 `Vehicle` 물리 필드/응답/계약에서 `monthlyExpenseWon` 제거, 차량 연료/정비 이력의 선택적 수집거래 연동과 확정 후 수정 차단, 레거시 `Transaction` 물리 제거와 active reference guard, 메인 월 운영 루프의 `reference-data -> accounting-periods -> insurance/vehicles -> recurring-rules -> plan-items -> collected-transactions/imports -> journal-entries -> financial-statements -> carry-forwards -> forecast` 브라우저 시나리오, `imports -> collected-transactions -> journal-entries` cross-feature 브라우저 시나리오, Next.js ESLint plugin explicit registration까지는 반영됨
- 이전에 저장소 안 우선순위로 선별했던 작업은 모두 닫혔음
- `.github/workflows/ci.yml`의 `prisma-integration` job은 disposable MySQL 기반 `npm run test:prisma`로 고정되었으며, Docker 환경 로컬 실행과 GitHub workflow 통과 확인까지 완료됨
- `npm run audit:runtime`는 현재 `high` 기준으로 gate를 걸고 있으며, `security/runtime-audit-allowlist.json`은 비어 있습니다. 2026-04-22에는 `npm run audit:runtime:full`이 `0 vulnerabilities`였지만, 2026-05-02 현재는 `next@15.5.15 -> postcss@8.4.31` 경유 moderate advisory가 남아 위 최신 보완사항 기록을 우선합니다.

## 2026-04-22 CI/Prisma 증적 확인

- GitHub CI 첫 통과 증적과 required check 연결은 저장소 운영 화면 기준으로 확인 완료된 상태입니다.
- Docker가 있는 환경에서 `npm run test:prisma` 실행 확인을 완료했습니다.
- GitHub `prisma-integration` workflow도 disposable MySQL 기반 경로로 통과 확인을 완료했습니다.
- 따라서 CI required check 연결과 Prisma 통합 검증 첫 통과는 더 이상 미완료 공백으로 보지 않고, CI 구성 변경 시 재확인하는 유지보수 항목으로 관리합니다.

## 2026-04-05 Runtime Audit Follow-up 이력

- 실행: `npm run audit:runtime:full`과 동등한 runtime `npm audit --omit=dev --workspace @personal-erp/api --workspace @personal-erp/web --json`
- 결과: `critical 0`, `high 4`
- 분류:
  - `@nestjs/config@4.0.3 -> lodash@4.17.23`
  - `@nestjs/swagger@11.2.6 -> lodash@4.17.23`
  - `@nestjs/swagger@11.2.6 -> path-to-regexp@8.3.0`
  - `express -> router@2.2.0 -> path-to-regexp@8.3.0`
- 같은 날 npm registry 기준 최신 배포 버전도 `@nestjs/config 4.0.3`, `@nestjs/swagger 11.2.6`이며, 패키지 내부 dependency가 각각 `lodash 4.17.23`, `path-to-regexp 8.3.0`으로 고정돼 있어 로컬 비파괴 업그레이드 경로가 확인되지 않았습니다.
- 결론: 당시에는 CI gate를 `critical` 기준으로 유지하고, 위 4건은 upstream 릴리스 또는 안전한 대체 경로가 나올 때까지 `tracked exception`으로 관리했습니다.

## 2026-04-22 Runtime Audit Follow-up

- 실행: `npm run audit:runtime`과 runtime `npm audit --omit=dev --workspace @personal-erp/api --workspace @personal-erp/web --json`
- 조치:
  `@nestjs/config 4.0.3 -> 4.0.4`
  `@nestjs/swagger 11.2.6 -> 11.3.2`
  `next 15.5.14 -> 15.5.15`
- 결과:
  `lodash 4.18.1`, `path-to-regexp 8.4.2`, `next 15.5.15`로 갱신되었고 runtime audit 결과는 `0 vulnerabilities`입니다.
- 결론: 2026-04-05 기준 tracked exception은 해소 완료로 전환했습니다.

## 2026-04-22 Runtime Audit Gate Hardening

- 실행: `npm run audit:runtime`, `npm run audit:runtime:full`
- 조치:
  `npm run audit:runtime`를 `high` 게이트 + 만료형 allowlist 검증 스크립트로 전환했습니다.
  예외 파일은 `security/runtime-audit-allowlist.json`으로 고정했습니다.
- 결과:
  당시 runtime audit full 결과는 `0 vulnerabilities`였고, allowlist entry도 `0`건입니다. 이후의 현재 판정은 위 최신 날짜별 보완사항 기록을 우선합니다.
- 결론:
  지금 시점에는 active exception 없이 `high` 게이트를 바로 유지하는 것이 합리적이며, 이후 unavoidable advisory가 생기면 만료일과 사유가 있는 allowlist로만 예외를 허용합니다.

## 해석

현재 검증체계는 성공 경로 계약, 인증, DTO validation, 접근 범위 검증, readiness/request-id 같은 운영 신호, 핵심 쓰기 흐름, 대표 브라우저 사용자 흐름까지를 자동으로 막는 상태입니다.
`npm run test:e2e`, `npm run test:prisma`는 빠른 기본 테스트와 분리된 대표 심화 검증으로 유지합니다.
다음 보강 우선순위는 운영 HTTPS/HSTS/Swagger 토글 리허설과 외부 감사 저장소/장기 보관 정책 초안 정리입니다.
