# 관리자 회원관리와 로그관리 실행 계획

## 완료 메모

2026-04-14 기준 관리자 회원관리와 로그관리 1차 범위를 저장소 안에서 구현 완료했다.
workspace-scoped 관리자 화면, 멤버 초대/역할/상태 관리, 초대 수락 흐름,
workspace 감사 이벤트 영속화와 조회, 공통 감사 저장 경계, 테스트와 문서 동기화까지
현재 계획 범위에 포함한 항목을 반영했다.

실제 운영 DB가 닿는 Prisma 통합 검증은 이 환경에서
`PRISMA_INTEGRATION_DATABASE_URL (mysql://220.122.169.122:1409/personal_erp)`가
도달 불가라 자동 스킵되었고, 이는 환경성 후속 검증으로 남긴다.

## 목적

이 문서는 앞으로 추가할 관리자 화면 중 1차 범위인 `회원관리`와 `로그관리`를
현재 PERSONAL_ERP 구조에 맞게 구현하기 위한 실행 순서를 고정한다.

여기서 말하는 관리자는 플랫폼 운영자가 모든 Tenant를 보는 슈퍼 관리자 화면이
아니라, 현재 로그인 사용자의 `currentWorkspace` 안에서 `OWNER` 또는 필요한 경우
`MANAGER`가 사업장 멤버와 감사 로그를 관리하는 workspace-scoped 관리자 화면이다.

## 현재 기준

- 인증과 작업 문맥은 `User`, `Tenant`, `TenantMembership`, `Ledger`,
  `AuthSession` 모델로 구성되어 있다.
- 멤버십 역할은 `OWNER`, `MANAGER`, `EDITOR`, `VIEWER`이고, 상태는 `INVITED`,
  `ACTIVE`, `SUSPENDED`, `REMOVED`로 이미 정의되어 있다.
- 대부분의 보호 API는 현재 `user.currentWorkspace`에서 얻은 `tenantId`,
  `ledgerId`, `membershipId`, `membershipRole`을 기준으로 동작한다.
- 쓰기 권한은 `apps/api/src/common/auth/workspace-action.policy.ts`에서
  action 단위로 관리한다.
- 현재 보안 이벤트와 권한 이벤트는 `SecurityEventLogger`와
  `workspace-action.audit.ts`를 통해 콘솔 로그로 남지만, 화면에서 조회 가능한
  영속 감사 로그 테이블은 아직 없다.
- 전표, 기간 상태 변경, 이월 같은 일부 회계 기록은 actor 필드를 이미 갖고
  있지만, 범용 관리자 로그 화면의 단일 조회 원천으로 쓰기에는 범위가 좁다.

## 고정 원칙

- 파일 열람, 생성, 수정, 삭제는 UTF-8 기준으로 처리한다.
- Web과 API가 공유하는 요청/응답 shape는 `packages/contracts`를 먼저 바꾼다.
- 관리자 기능은 `Identity & Access` 컨텍스트에 가깝지만, 도메인 쓰기 이벤트
  조회는 `Platform & Contracts`의 공통 감사 인프라를 통해 읽는다.
- 1차 범위에서는 플랫폼급 멀티테넌시 운영 UI, 결제/구독 관리, 중앙 로그 수집기,
  OpenTelemetry, 별도 메시지 브로커를 도입하지 않는다.
- 회원관리와 로그관리는 같은 관리자 영역에 묶되, API 모듈과 화면 feature는
  책임을 분리한다.
- 감사 로그에는 비밀번호, access token, refresh token, cookie 원문,
  이메일 인증 token, secret 원문, 전체 요청/응답 body dump를 저장하지 않는다.
- 로그 조회 화면은 저장된 감사 이벤트를 읽는 화면이지, 런타임 stdout/stderr를
  직접 뒤지는 화면으로 만들지 않는다.

## 1차 구현 범위

- 관리자 영역 Web route
  - `/admin`
  - `/admin/members`
  - `/admin/logs`
- 회원관리
  - 현재 Tenant 멤버 목록 조회
  - 멤버 역할 변경
  - 멤버 상태 변경 또는 제거 처리
  - 초대 기반 멤버 추가
  - 자기 자신과 마지막 OWNER 보호 규칙
- 로그관리
  - workspace-scoped 감사 이벤트 영속화
  - 관리자 화면에서 감사 이벤트 목록/상세 조회
  - 기간, 이벤트 종류, actor, 결과, requestId 기준 필터
  - 민감정보 제거와 metadata allowlist 기준
- 권한/감사
  - 관리자 action 권한 정책 추가
  - 회원관리 명령 자체의 감사 로그 기록
  - 주요 workspace write action의 감사 이벤트 저장 연동
- 문서/검증
  - API 문서, 화면 흐름 문서, 검증 문서 업데이트
  - 요청 단위 API 테스트, Web API 테스트, 대표 E2E 보강

## 1차 제외 범위

- 전체 Tenant를 횡단 조회하는 플랫폼 관리자
- 사용자 비밀번호 초기화, MFA/2FA 관리
- 권한 템플릿, 커스텀 Role Builder
- 조직도, 부서, 복합 승인 체계
- 외부 SIEM, 중앙 로그 저장소, 장기 보관용 cold storage
- 로그 export 파일 다운로드
- 로그 삭제 UI
- 실시간 보안 알림

## 연관 필수 기능 검토

### 회원관리 필수 기능

1. 멤버 목록 조회
   - 현재 Tenant의 `TenantMembership`과 연결된 `User` 기본 정보를 내려준다.
   - 응답에는 `userId`, `membershipId`, `name`, `email`, `role`, `status`,
     `joinedAt`, `lastAccessAt`, `invitedByMembershipId` 정도만 포함한다.
   - `passwordHash`, session, token, verification token은 절대 노출하지 않는다.

2. 초대 흐름
   - 기존 스키마에는 `INVITED` 상태와 `invitedByMembershipId`가 있으나, 초대
     토큰 모델은 없다.
   - 1차 구현에서는 `TenantMembershipInvitation` 같은 별도 모델을 추가해
     초대 token hash, 만료 시각, 소비 시각, 초대한 membership을 관리한다.
   - 초대 수락 시 이미 가입된 이메일이면 해당 사용자에 membership을 연결하고,
     미가입 이메일이면 기존 `/register` 또는 새 `/accept-invitation` 흐름으로
     이어지게 한다.
   - Gmail API/console mail sender 경계는 기존 회원가입 메일 발송 port를 재사용한다.

3. 역할 변경
   - `OWNER`만 다른 멤버의 역할을 바꿀 수 있게 시작한다.
   - `MANAGER`가 멤버를 초대할 수 있는지는 1차 구현 중 정책으로 확정하되, 역할
     변경은 `OWNER` 전용으로 둔다.
   - 자기 자신을 `OWNER`에서 낮추거나 제거하는 흐름은 최소 1명 이상의 다른
     ACTIVE `OWNER`가 있을 때만 허용한다.

4. 상태 변경과 제거
   - 하드 삭제보다 `SUSPENDED` 또는 `REMOVED` 상태 전환을 우선한다.
   - `REMOVED` 멤버는 더 이상 currentWorkspace로 선택되지 않게 한다.
   - `SUSPENDED` 멤버는 로그인 자체는 가능할 수 있지만 해당 workspace 진입은
     막는 방향으로 검증한다.
   - 상태 변경 후 기존 refresh session 처리 범위를 결정한다. 1차에서는 해당
     workspace 접근 차단을 확실히 하고, 모든 세션 강제 폐기는 후속으로 둘 수
     있다.

5. lastAccessAt 갱신
   - 현재 `TenantMembership.lastAccessAt` 필드가 있으므로, 인증된 workspace를
     해석하는 시점에 갱신할지 검토한다.
   - 매 요청마다 쓰면 부하와 write noise가 생기므로, 하루 1회 또는 일정 간격
     throttle 기준을 둔다.

### 로그관리 필수 기능

1. 감사 이벤트 모델
   - 새 모델 후보: `WorkspaceAuditEvent`
   - 필수 필드 후보:
     `id`, `tenantId`, `ledgerId`, `actorUserId`, `actorMembershipId`,
     `actorRole`, `eventCategory`, `eventName`, `action`, `resourceType`,
     `resourceId`, `result`, `reason`, `requestId`, `path`, `clientIpHash`,
     `metadata`, `occurredAt`
   - `tenantId`, `occurredAt`, `eventCategory`, `action`, `actorMembershipId`,
     `requestId`에 index를 둔다.

2. 저장 경계
   - `SecurityEventLogger`를 그대로 DB writer로 비대하게 만들기보다,
     `AuditEventWriter` 또는 `WorkspaceAuditEventService`를 별도로 둔다.
   - 기존 `workspace-action.audit.ts`는 콘솔 보안 이벤트와 DB 감사 이벤트를
     함께 호출할 수 있는 얇은 경계로 확장한다.
   - 로그인 실패처럼 tenant를 알 수 없는 platform-level 이벤트는 1차 관리자
     로그 화면에는 넣지 않고, tenant/ledger를 알 수 있는 workspace 이벤트부터
     저장한다.

3. 감사 대상
   - 회원 초대, 역할 변경, 상태 변경, 제거
   - 자금수단/카테고리/보험/차량 기준 데이터 쓰기
   - 월 운영 open/close/reopen
   - 업로드 배치 생성과 수집 거래 승격
   - 수집 거래 생성/수정/삭제/확정
   - 전표 반전/정정
   - 재무제표 생성과 차기 이월 생성
   - 권한 거부 이벤트 중 tenant 문맥이 있는 이벤트

4. 조회 정책
   - 로그 조회는 `OWNER` 전용으로 시작한다.
   - `MANAGER` 조회 허용은 개인정보와 권한 이벤트 노출 범위를 확정한 뒤 후속으로
     열 수 있다.
   - 기본 정렬은 `occurredAt desc`, 기본 기간은 최근 7일 또는 30일로 제한한다.
   - 페이지네이션은 cursor 또는 offset 중 기존 DataGrid 패턴과 API 단순성을
     고려해 먼저 offset/pageSize로 시작하고, 데이터가 커지면 cursor로 바꾼다.

5. 민감정보/보관
   - metadata는 allowlist key만 저장한다.
   - IP는 원문 저장 대신 hash 또는 마스킹 문자열을 검토한다.
   - 로그 삭제 UI는 만들지 않는다.
   - 보관 기간은 문서상 90일 또는 180일 초안으로 두고, 실제 자동 삭제 job은
     후속 단계에서 구현한다.

## 단계별 실행 순서

### 0. 기준 상태 확인

1. `git status --short`로 기존 변경 사항을 확인한다.
2. `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/ERROR_HANDLING_AND_LOGGING.md`,
   `docs/ASVS_L2_EXECUTION_PLAN.md`를 다시 확인한다.
3. 현재 인증/권한 경계인 `apps/api/src/modules/auth`,
   `apps/api/src/common/auth`, `packages/contracts/src/auth.ts`를 확인한다.
4. 현재 Web 레이아웃과 메뉴 기준인 `apps/web/src/shared/config/navigation.ts`,
   `apps/web/src/shared/layout/*`를 확인한다.

완료 기준:

- 관리자 기능이 platform admin이 아니라 current workspace admin임을 다시 확인한다.
- 기존 인증/세션 흐름을 변경하지 않는 구현 범위를 확정한다.

### 1. 관리자 권한 정책 고정

수정 후보:

- `apps/api/src/common/auth/workspace-action.policy.ts`
- `docs/API.md`
- `docs/ERROR_HANDLING_AND_LOGGING.md`

추가할 action 후보:

- `admin_member.invite`
- `admin_member.update_role`
- `admin_member.update_status`
- `admin_member.remove`
- `admin_audit_log.read`

권장 초기 정책:

- `OWNER`: 모든 회원관리 명령, 로그 조회 허용
- `MANAGER`: 1차에서는 멤버 목록 조회만 허용하거나, 초대만 제한적으로 허용
- `EDITOR`, `VIEWER`: 관리자 영역 진입 불가

완료 기준:

- 자기 자신 제거, 마지막 OWNER 제거, OWNER 없는 Tenant가 생기는 경로가 차단된다.
- 권한 실패 시 기존 `authorization.action_denied` 로그 기준을 유지한다.

### 2. 공용 계약 추가

수정 후보:

- `packages/contracts/src/admin.ts`
- `packages/contracts/src/index.ts`
- `packages/contracts/src/auth.ts`

추가할 계약 후보:

- `AdminMemberItem`
- `InviteTenantMemberRequest`
- `UpdateTenantMemberRoleRequest`
- `UpdateTenantMemberStatusRequest`
- `TenantMemberInvitationItem`
- `AdminAuditEventItem`
- `AdminAuditEventListResponse`
- `AdminAuditEventQuery`

완료 기준:

- Web과 API가 관리자 응답 shape를 같은 타입으로 공유한다.
- 민감 필드는 계약에 존재하지 않는다.

### 3. Prisma 스키마와 migration 추가

수정 후보:

- `apps/api/prisma/schema.prisma`
- 새 migration 디렉터리

추가 모델 후보:

```prisma
model TenantMembershipInvitation {
  id                    String    @id @default(cuid())
  tenantId              String
  email                 String
  normalizedEmail       String    @db.VarChar(191)
  role                  TenantMembershipRole
  tokenHash             String    @unique
  expiresAt             DateTime
  acceptedAt            DateTime?
  revokedAt             DateTime?
  invitedByMembershipId String
  createdAt             DateTime  @default(now())

  @@index([tenantId, normalizedEmail])
  @@index([tenantId, expiresAt])
}

model WorkspaceAuditEvent {
  id                  String   @id @default(cuid())
  tenantId            String
  ledgerId            String?
  actorUserId         String?
  actorMembershipId   String?
  actorRole           String?
  eventCategory       String   @db.VarChar(50)
  eventName           String   @db.VarChar(100)
  action              String?  @db.VarChar(100)
  resourceType        String?  @db.VarChar(100)
  resourceId          String?
  result              String   @db.VarChar(30)
  reason              String?  @db.VarChar(191)
  requestId           String?  @db.VarChar(191)
  path                String?  @db.VarChar(300)
  clientIpHash        String?  @db.VarChar(191)
  metadata            Json?
  occurredAt          DateTime @default(now())

  @@index([tenantId, occurredAt])
  @@index([tenantId, eventCategory, occurredAt])
  @@index([tenantId, action, occurredAt])
  @@index([tenantId, actorMembershipId, occurredAt])
  @@index([tenantId, requestId])
}
```

완료 기준:

- invitation token은 원문이 아니라 hash로 저장된다.
- 감사 로그는 workspace 범위와 시간순 조회를 빠르게 할 수 있다.
- 기존 데이터 migration이 필요하면 seed와 테스트 fixture를 함께 맞춘다.

### 4. API 관리자 모듈 추가

추가 후보:

- `apps/api/src/modules/admin/admin.module.ts`
- `apps/api/src/modules/admin/admin-members.controller.ts`
- `apps/api/src/modules/admin/admin-members.service.ts`
- `apps/api/src/modules/admin/admin-audit-events.controller.ts`
- `apps/api/src/modules/admin/admin-audit-events.service.ts`
- `apps/api/src/modules/admin/dto/*`
- `apps/api/src/modules/admin/admin.mapper.ts`

엔드포인트 후보:

- `GET /admin/members`
- `POST /admin/members/invitations`
- `PATCH /admin/members/:membershipId/role`
- `PATCH /admin/members/:membershipId/status`
- `DELETE /admin/members/:membershipId`
- `GET /admin/audit-events`
- `GET /admin/audit-events/:id`

구현 순서:

1. read-only 멤버 목록을 먼저 만든다.
2. 멤버 역할/상태 변경 명령을 추가한다.
3. invitation token 모델과 메일 발송을 붙인다.
4. 감사 로그 목록 조회를 붙인다.
5. 각 명령 성공/거부 이벤트를 감사 로그에 기록한다.

완료 기준:

- 모든 endpoint는 `requireCurrentWorkspace`를 통과한다.
- `OWNER` 보호 규칙이 service/use-case 단에서 검증된다.
- DTO validation이 있고, 잘못된 role/status/action은 400으로 막힌다.

### 5. 감사 이벤트 저장 경계 추가

추가 후보:

- `apps/api/src/common/infrastructure/operational/audit-event-writer.ts`
- `apps/api/src/common/infrastructure/operational/workspace-audit-event.mapper.ts`
- `apps/api/src/common/infrastructure/external-dependencies.module.ts`

구현 순서:

1. `AuditEventWriter` 추상 경계를 만든다.
2. Prisma 기반 writer adapter를 만든다.
3. 테스트용 memory/fake writer를 준비한다.
4. `workspace-action.audit.ts`가 성공/거부 이벤트를 writer로도 넘기게 한다.
5. 기존 주요 controller의 `logWorkspaceActionSucceeded` 호출이 저장까지 이어지는지
   대표 경로만 먼저 검증한다.
6. 저장 실패가 비즈니스 write 성공을 깨야 하는지 결정한다. 1차 기본값은
   "감사 저장 실패를 로깅하고 원래 요청은 실패시키지 않음"으로 시작하되,
   회원관리 같은 보안 핵심 명령은 실패 정책을 별도로 검토한다.

완료 기준:

- 감사 이벤트 저장 실패로 일반 운영 화면이 무작위로 실패하지 않는다.
- 회원관리 명령은 성공/실패 모두 추적 가능하다.
- metadata allowlist와 민감정보 금지 목록이 테스트에 반영된다.

### 6. Web 관리자 화면 추가

추가 후보:

- `apps/web/app/(app)/(dashboard)/admin/page.tsx`
- `apps/web/app/(app)/(dashboard)/admin/members/page.tsx`
- `apps/web/app/(app)/(dashboard)/admin/logs/page.tsx`
- `apps/web/src/features/admin/admin.api.ts`
- `apps/web/src/features/admin/admin-section-nav.tsx`
- `apps/web/src/features/admin/admin-members-page.tsx`
- `apps/web/src/features/admin/admin-logs-page.tsx`
- `apps/web/src/shared/config/navigation.ts`

화면 구성:

1. `/admin`은 관리자 영역 안내와 현재 권한 요약을 보여주고, 회원관리/로그관리로
   이동하게 한다.
2. `/admin/members`는 멤버 목록, 역할/상태 chip, 초대 버튼, 역할 변경 drawer,
   제거/중지 confirm dialog를 제공한다.
3. `/admin/logs`는 기간 필터, event category/action/result 필터, requestId 검색,
   감사 로그 표, 상세 drawer를 제공한다.
4. 관리자 권한이 없으면 화면 진입 시 권한 부족 안내와 작업 문맥 화면 이동 링크를
   제공한다.

완료 기준:

- 기존 대시보드형 화면 패턴인 `PageHeader`, `SectionCard`, `DataTableCard`,
  `QueryErrorAlert`, `ConfirmActionDialog`, `FormDrawer`를 우선 재사용한다.
- 긴 requestId/action/resourceId 텍스트가 모바일/데스크톱에서 부모 영역을
  깨지 않는다.
- 관리자 메뉴는 권한이 없을 때 숨길지, 보이되 안내할지 정책을 문서화한다.

### 7. 초대 수락 Web 흐름 추가

추가 후보:

- `apps/web/app/(app)/accept-invitation/page.tsx`
- `apps/web/src/features/auth/accept-invitation-page.tsx`
- `apps/web/src/features/auth/auth.api.ts`

구현 순서:

1. 초대 링크는 `/accept-invitation?token=<token>`으로 연다.
2. 로그인 사용자가 이미 있으면 초대 수락 API를 호출한다.
3. 미로그인 사용자는 로그인 또는 회원가입으로 안내한다.
4. 미가입 이메일은 기존 회원가입/이메일 인증 흐름과 충돌하지 않게 별도 안내를 둔다.

완료 기준:

- 초대 token 원문은 URL에서만 쓰고 저장/로그에 남기지 않는다.
- 초대 수락 후 currentWorkspace가 새 Tenant로 선택되는지 또는 기존 선택 규칙을
  유지할지 문서화한다.

### 8. 테스트 추가

API 테스트:

- OWNER가 멤버 목록을 조회할 수 있다.
- VIEWER/EDITOR가 관리자 명령을 실행하면 403으로 막힌다.
- 마지막 ACTIVE OWNER는 제거하거나 역할을 낮출 수 없다.
- 멤버 역할 변경 시 감사 이벤트가 저장된다.
- 멤버 상태 변경 시 current workspace 접근이 차단된다.
- 초대 token은 hash만 저장되고 만료/소비/재사용이 막힌다.
- 감사 로그 목록은 current tenant 범위만 반환한다.
- 감사 로그 목록은 민감정보를 포함하지 않는다.

Web 테스트:

- `admin.api.ts`의 path, query, body 직렬화
- 권한 없는 사용자 안내
- 회원 목록 렌더링
- 역할 변경/상태 변경 성공과 오류 메시지
- 로그 필터 query 조립과 표 렌더링

E2E 후보:

- OWNER 로그인 -> 관리자 -> 회원 초대 -> 감사 로그에서 초대 이벤트 확인
- OWNER 로그인 -> 역할 변경 -> 감사 로그에서 변경 이벤트 확인

완료 기준:

- 최소 `npm run check:quick` 통과
- 권장 `npm run test` 통과
- 권한/로그 경계가 바뀌므로 `npm run test:security:api` 통과
- Prisma schema가 바뀌므로 대표 `npm run test:prisma` 확인

### 9. 문서 동기화

수정 후보:

- `docs/API.md`
- `docs/DEMO_GUIDE.md`
- `docs/ERROR_HANDLING_AND_LOGGING.md`
- `docs/VALIDATION_NOTES.md`
- `docs/ASVS_L2_EXECUTION_PLAN.md`
- `docs/ASVS_L2_BASELINE_MATRIX.md`
- `README.md`

반영 내용:

- Web `/admin`, `/admin/members`, `/admin/logs` 경로 추가
- API `/admin/*` 엔드포인트와 권한 정책 추가
- 감사 로그 저장/조회 정책 추가
- 민감정보 로그 금지 기준 보강
- 회원 초대와 역할 변경의 검증 범위 추가
- 관리자 기능이 platform admin이 아니라 workspace admin임을 명시

완료 기준:

- 문서의 endpoint, 권한, 화면 경로가 실제 구현과 맞는다.
- `npm run docs:check`가 통과한다.

### 10. 최종 검증과 구현 단위 정리

권장 실행 순서:

1. `npm run db:generate`
2. `npm run check:quick`
3. `npm run test`
4. `npm run test:security:api`
5. `npm run test:e2e`
6. `npm run test:prisma`

권장 구현 단위:

1. 계약과 권한 정책
2. Prisma migration과 감사 이벤트 저장 경계
3. 관리자 멤버 목록 read API
4. 회원 역할/상태 변경 API
5. 초대 생성/수락 API
6. 감사 로그 조회 API
7. Web 관리자 route와 회원관리 화면
8. Web 로그관리 화면
9. E2E/Prisma 검증
10. 문서 동기화

각 단위는 커밋을 나눌 수 있지만, 1차 PR은 관리자 영역이 실제로
`회원관리 명령 -> 감사 이벤트 저장 -> 로그관리 화면 조회`까지 이어지는 end-to-end
단위로 묶는 것을 권장한다.
