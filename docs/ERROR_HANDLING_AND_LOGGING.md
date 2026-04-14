# 예외 처리와 로깅 원칙

## 왜 이 문서가 필요한가

이 프로젝트는 구조 설명 문서는 이미 충분히 갖추고 있지만, 실제 운영 관점에서 자주 묻는 질문인
`실패를 어떻게 다루는가`, `로그를 어디에 남기는가`, `민감정보는 어떻게 피하는가`를 짧게 보는 문서가 따로 필요합니다.

이 문서는 현재 저장소에 이미 구현된 방식과, 앞으로 같은 방향으로 유지할 최소 규칙만 정리합니다.
즉, 대형 관측 플랫폼이나 범용 예외 래퍼를 가정하지 않되, 현재 저장소에 실제 들어간 좁은 범위의 예외 변환은 반영합니다.

## 핵심 원칙

1. 예상 가능한 실패는 명시적으로 표현하고, 가장 바깥 계층에서 사용자/API 의미로 변환합니다.
2. 예상하지 못한 실패는 중간 계층에서 숨기지 않고 상위로 전파합니다.
3. 로그는 경계 지점에서만 남기고, 비즈니스 로직 내부에는 무분별하게 뿌리지 않습니다.
4. 민감정보는 로그와 응답에 남기지 않습니다.
5. 1인 개발과 포트폴리오 목적에 맞게, 현재는 `짧고 일관된 규칙`을 우선합니다.
6. 회계 쓰기 흐름 로그는 가능하면 `userId` 하나보다 `tenantId`, `membershipId`, `ActorRef` 계열 식별자를 우선 고려합니다.

## 현재 API 예외 처리 원칙

### 1. 입력 검증 실패는 진입점에서 막는다

- 전역 `ValidationPipe`가 DTO 검증을 담당합니다.
- 잘못된 입력은 controller 안쪽으로 깊게 들여보내기 전에 막습니다.
- 검증 실패는 Nest 기본 `400` 응답으로 노출됩니다.

현재 기준 코드:

- [`apps/api/src/main.ts`](../apps/api/src/main.ts#L10)

### 2. 인증 실패는 guard/service에서 명시적으로 표현한다

- bearer token 누락, 토큰 위조, 사용자 미존재는 `UnauthorizedException`으로 처리합니다.
- 로그인 실패도 동일하게 `UnauthorizedException`으로 처리합니다.
- 인증 실패는 `401`로 일관되게 노출합니다.

현재 기준 코드:

- [`apps/api/src/common/auth/jwt-auth.guard.ts`](../apps/api/src/common/auth/jwt-auth.guard.ts#L34)
- [`apps/api/src/modules/auth/auth.service.ts`](../apps/api/src/modules/auth/auth.service.ts#L16)

### 3. 도메인 규칙 실패는 controller에서 HTTP 의미로 변환한다

- `Collected Transactions`, `Recurring Rules`는 use-case/domain이 HTTP를 직접 모르게 유지합니다.
- 대신 controller가 `MissingOwned...Error`를 받아 `NotFoundException`으로 변환합니다.
- 현재 구현의 에러 이름에 `Owned`가 남아 있더라도, 상위 도메인 기준은 단순 소유권보다 Tenant/Membership 접근 범위 판정입니다.
- 이 규칙 덕분에 도메인 규칙은 테스트하기 쉬워지고, HTTP 상태 코드는 바깥 계층에서만 결정됩니다.

현재 기준 코드:

- [`apps/api/src/modules/collected-transactions/collected-transactions.controller.ts`](../apps/api/src/modules/collected-transactions/collected-transactions.controller.ts#L23)
- [`apps/api/src/modules/recurring-rules/recurring-rules.controller.ts`](../apps/api/src/modules/recurring-rules/recurring-rules.controller.ts#L23)

### 4. 예상하지 못한 실패는 일단 삼키지 않는다

- controller, use-case, repository, adapter가 무조건 `try/catch`로 감싸지 않습니다.
- 복구 가능한 실패가 아니면 그대로 상위로 전파합니다.
- 현재는 Nest 기본 예외 처리를 기본으로 두되, Prisma `P2002`만 전역 `PrismaConflictExceptionFilter`에서 도메인 의미가 있는 `409 Conflict`로 좁게 변환합니다.

이 선택은 현재 프로젝트의 목적과 맞습니다.

- 과한 추상화나 공통 예외 래퍼를 늘리지 않습니다.
- 대신 `예상 가능한 실패만 명시적으로 다루고`, 나머지는 숨기지 않습니다.

현재 기준 코드:

- [`apps/api/src/common/prisma/prisma-conflict-exception.filter.ts`](../apps/api/src/common/prisma/prisma-conflict-exception.filter.ts#L1)
- [`apps/api/src/main.ts`](../apps/api/src/main.ts#L1)

## 현재 Web 예외 처리 원칙

### 1. 요청 실패는 공통 요청 계층에서 정리한다

- 프런트는 `fetch-json.ts`에서 `ApiRequestError`, `UnauthorizedRequestError`로 실패를 구분합니다.
- `401`은 먼저 `POST /auth/refresh`로 한 번 복구를 시도하고, 실패하면 세션 정리와 로그인 복귀 흐름으로 이어집니다.
- 일반 API 실패는 상태 코드와 메시지를 담은 오류로 다룹니다.

현재 기준 코드:

- [`apps/web/src/shared/api/fetch-json.ts`](../apps/web/src/shared/api/fetch-json.ts#L62)

### 2. 인증 실패는 재시도를 줄이고 빠르게 세션 정리한다

- React Query는 인증 실패 오류에 대해서는 재시도하지 않습니다.
- 같은 실패를 반복 요청하면서 상태를 더 꼬이게 하지 않기 위한 규칙입니다.

현재 기준 코드:

- [`apps/web/src/shared/providers/query-provider.tsx`](../apps/web/src/shared/providers/query-provider.tsx#L11)

### 3. demo fallback은 개발 편의 기능으로만 취급한다

- demo fallback이 켜져 있을 때만 요청 실패를 fallback 데이터로 대체합니다.
- 이 경우 `console.warn`으로 실제 fallback 사용 사실을 남깁니다.
- fallback이 꺼져 있으면 오류를 숨기지 않고 그대로 실패시킵니다.

이 규칙 덕분에 로컬 개발 편의성과 실제 실패 인지가 함께 유지됩니다.

## 로깅 원칙

### 현재 적용된 운영 신호

- 모든 API 응답에는 `x-request-id` 헤더를 붙입니다.
- 클라이언트가 이미 `x-request-id`를 보내면 그 값을 그대로 유지합니다.
- API 경계에서는 `[module] METHOD path status duration requestId=...` 형식의 최소 요청 로그를 남깁니다.
- 보안 이벤트는 `SecurityEvent` 로거에서 `event=... key=value ...` 형식으로 남깁니다.
- 관리자 회원관리에서 발생한 workspace-scoped 감사 이벤트는 `WorkspaceAuditEvent`에 저장하고, `/admin/logs` 화면에서 조회합니다.
- readiness 점검은 `GET /api/health/ready`에서 수행하고, DB 연결 실패 시 `503`으로 드러냅니다.
- Prisma unique 충돌은 요청 경계에서 raw 500 대신 도메인 `409 Conflict` 메시지로 정리합니다.

### 현재 기록하는 대표 보안 이벤트

인증 이벤트는 현재 구현 기준으로 `userId`, `sessionId`를 주로 사용합니다.  
도메인 쓰기/권한 이벤트는 가능하면 `tenantId`, `membershipId`, `actorType` / `actorId`까지 함께 남기는 방향을 기준으로 둡니다.

- `auth.login_succeeded`
  `log` 레벨, `requestId`, `clientIp`, `userId`, `sessionId`
- `auth.login_failed`
  `warn` 레벨, `requestId`, `clientIp`, `reason=invalid_credentials`
- `auth.login_rate_limited`
  `warn` 레벨, `requestId`, `clientIp`
- `auth.refresh_succeeded`
  `log` 레벨, `requestId`, `clientIp`, `userId`, `sessionId`
- `auth.refresh_failed`
  `warn` 레벨, `requestId`, `clientIp`, `path`, `reason`
- `auth.refresh_reuse_detected`
  `warn` 레벨, `requestId`, `clientIp`, `userId`, `sessionId`
- `auth.logout_succeeded`
  `log` 레벨, `requestId`, `clientIp`, `userId`, `sessionId`
- `auth.invitation_accepted`
  `log` 레벨, `requestId`, `clientIp`, `status`
- `auth.invitation_accept_failed`
  `warn` 레벨, `requestId`, `clientIp`, `reason`
- `auth.browser_origin_blocked`
  `warn` 레벨, `requestId`, `clientIp`, `path`, `origin`
- `auth.access_denied`
  `warn` 레벨, `requestId`, `clientIp`, `path`, `reason`, 선택적 `userId`, `tenantId`
- `authorization.scope_denied`
  `warn` 레벨, `requestId`, `path`, 선택적 `userId`, `tenantId`, `membershipId`, `resource`
- `admin.member_invited`
  영속 감사 이벤트, `tenantId`, `ledgerId`, `actorMembershipId`, `role`
- `admin.member_role_updated`
  영속 감사 이벤트, `tenantId`, `ledgerId`, `actorMembershipId`, `targetMembershipId`, `previousRole`, `nextRole`
- `admin.member_status_updated` / `admin.member_removed`
  영속 감사 이벤트, `tenantId`, `ledgerId`, `actorMembershipId`, `targetMembershipId`, `previousStatus`, `nextStatus`
- `system.readiness_failed`
  `error` 레벨, `requestId`, `path`, `check=database`

### 로그 레벨 분리 기준

- `log`
  정상적인 보안 상태 전이
  예: 로그인 성공, refresh 성공, 로그아웃 성공
- `warn`
  차단되었지만 시스템 장애는 아닌 보안 이벤트
  예: 잘못된 자격증명, origin 차단, bearer 누락, refresh 재사용, scope 거부
- `error`
  운영자가 바로 원인 확인을 해야 하는 보안/운영 실패
  예: readiness 실패

### 지금 남겨도 되는 로그

- 애플리케이션 시작/종료에 가까운 로그
- 요청 경계의 최소 접근 로그
- seed 실행 성공/실패 로그
- demo fallback 사용 로그
- 앞으로 추가될 외부 연동 실패 로그
  예: 메일, 파일 저장소, 외부 API, 배치 작업

### 지금 남기면 안 되는 로그

- 비밀번호 원문
- access token / refresh token
- `Authorization` 헤더 전체
- cookie 전체 값
- `DATABASE_URL`, JWT secret 같은 secret 원문
- 사용자 개인정보가 섞인 전체 응답 body 덤프

### 로그를 남길 때 최소 기준

- 어떤 기능에서 실패했는지
- 어떤 경계에서 실패했는지
  예: `auth`, `collected-transactions`, `web fetch`, `external adapter`
- 상태 코드 또는 실패 종류
- 필요한 경우 안전한 식별자만
  예: `userId`/`platformUserId`, `tenantId`, `membershipId`, request path
- 가능하면 `requestId`
- 관리자 감사 로그의 `metadata`는 allowlist 값만 저장하고, IP는 원문 대신 hash 형태만 저장합니다.

### 로그를 남기지 않는 위치

- 순수 계산 함수
- 단순 mapper / formatter / helper
- 정상 흐름에서 반복 호출되는 use-case 내부 상세 단계

즉, `모든 곳에 로그를 심는 것`보다 `경계에서 필요한 로그만 남기는 것`을 기준으로 삼습니다.

## 새 기능을 추가할 때 체크할 기준

1. 이 실패가 예상 가능한가
2. 예상 가능하다면 어느 계층에서 가장 먼저 의미가 생기는가
3. HTTP 상태 코드나 UI 메시지 결정은 너무 안쪽 계층에서 하고 있지 않은가
4. fallback이 있다면 실제 fallback 사용 사실을 로그나 UI에서 인지할 수 있는가
5. 로그에 민감정보가 섞이지 않는가

## 운영에서 바로 보는 포인트

- 같은 `requestId`로 접근 로그와 보안 이벤트 로그를 묶어서 봅니다.
- 로그인 문제가 많으면 `auth.login_failed`, `auth.login_rate_limited`, `auth.browser_origin_blocked`를 먼저 봅니다.
- 보호 API 접근 문제가 많으면 `auth.access_denied`, `authorization.scope_denied`를 먼저 봅니다.
- 서비스 준비 상태가 흔들리면 `system.readiness_failed`와 `/api/health/ready` 응답을 함께 봅니다.

## 현재 단계에서 의도적으로 하지 않은 것

- 모든 예외를 포괄하는 전역 custom exception filter 도입
- 구조화 로그 플랫폼 도입
- 모든 예외를 공통 에러 객체로 강제 래핑
- OpenTelemetry, 중앙 로그 수집기, 분산 추적 인프라 도입

이 항목들은 규모가 더 커지면 고려할 수 있지만, 현재 프로젝트에서는 실무 감각과 복잡도 균형을 위해 아직 넣지 않았습니다.
현재 전역 필터는 Prisma `P2002` 충돌을 `409`로 변환하는 좁은 예외만 담당합니다.

## 한 줄 요약

이 프로젝트의 예외 처리와 로깅 원칙은 `예상 가능한 실패는 명시적으로, 예상 못한 실패는 숨기지 않고, 로그는 경계에서만 최소한으로` 입니다.
