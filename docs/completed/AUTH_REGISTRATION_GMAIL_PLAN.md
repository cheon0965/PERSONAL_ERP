# 회원가입 및 Gmail API 이메일 인증 실행 계획

## 완료 메모

2026-04-13 기준 저장소 내 1차 구현, 테스트 보강, 문서 동기화까지 완료했다.
실제 Google Cloud 프로젝트 설정, OAuth client/refresh token 발급, 운영 secret 등록,
실제 Gmail 수신 확인은 환경별 외부 운영 작업이므로 `ENVIRONMENT_SETUP.md`와 ASVS
후속 점검 항목에서 관리한다.

## 목적

현재 로그인 중심 인증 흐름에 회원가입과 이메일 인증을 추가한다. 1차 목표는
무료로 시작 가능한 Gmail API 발송을 붙이되, 이후 SMTP relay나 전문 메일
서비스로 바꾸더라도 회원가입 도메인 로직을 다시 쓰지 않도록 메일 발송 경계를
분리하는 것이다.

이 계획은 실제 구현자가 위에서 아래로 실행하는 순서를 기준으로 작성한다.

## 고정 원칙

- 파일 열람, 생성, 수정, 삭제는 UTF-8 기준으로 처리한다.
- Web과 API가 공유하는 요청/응답 shape는 `packages/contracts`를 먼저 바꾼다.
- API 기본 흐름은 기존 인증 모듈 규칙을 따라 `controller -> service` 중심으로
  유지하고, 메일 발송은 port/adapter로 분리한다.
- Gmail API 토큰, client secret, refresh token은 저장소에 두지 않고
  `C:\secrets\personal-erp\api.env` 같은 외부 SECRET 파일에 둔다.
- 비밀번호, refresh token, 이메일 인증 토큰 원문은 DB와 운영 로그에 남기지
  않는다.
- 메시지 브로커, outbox, 별도 gateway는 이번 범위에 넣지 않는다. 이 구조를
  도입해야 한다면 별도 ADR을 먼저 작성한다.

## 1차 구현 범위

- `POST /auth/register`
- `POST /auth/verify-email`
- `POST /auth/resend-verification`
- 이메일 인증 전 로그인 차단
- 인증 완료 후 기본 workspace, ledger, owner membership 생성
- 로컬/테스트용 console 또는 fake mail sender
- 운영 전환용 Gmail API mail sender
- 회원가입/이메일 인증 Web 화면
- 계약, env 예시, API 문서, 검증 문서, ASVS 문서 갱신

## 1차 제외 범위

- 비밀번호 재설정
- 초대 기반 가입
- MFA/2FA
- 관리자 사용자 관리 UI
- 메일 발송 outbox와 재시도 worker
- 결제/구독 상태 연동
- SMTP relay 전환 구현

## 단계별 실행 순서

### 0. 기준 상태 확인

1. `git status --short`로 작업 전 변경 사항을 확인한다.
2. 기존 문서 기준을 확인한다.
   `README.md`, `CONTRIBUTING.md`, `docs/API.md`,
   `docs/VALIDATION_NOTES.md`, `docs/ASVS_L2_EXECUTION_PLAN.md`를 우선한다.
3. 현재 인증 흐름을 확인한다.
   `apps/api/src/modules/auth/*`, `packages/contracts/src/auth.ts`,
   `apps/web/src/features/auth/*`를 기준으로 본다.
4. 구현 브랜치는 예를 들어 `feat/auth-registration-gmail`처럼 분리한다.

완료 기준:

- 현재 작업 전 상태와 영향을 받을 문서/코드 범위를 파악한다.
- 기존 로그인, refresh, logout, `GET /auth/me` 흐름을 변경하지 않는 방향을
  확인한다.

### 1. 회원가입 정책 확정

1. 회원가입 요청은 세션을 즉시 발급하지 않는다.
2. `POST /auth/register`는 성공 시 항상 일반화된 응답을 반환한다.
   이미 존재하는 이메일인지 여부를 응답으로 드러내지 않는다.
3. 신규 사용자는 `emailVerifiedAt = null` 상태로 만든다.
4. 이메일 인증 토큰 검증이 끝난 뒤 `emailVerifiedAt`을 채우고 기본 workspace를
   생성한다.
5. `POST /auth/login`은 `emailVerifiedAt`이 없는 사용자를 거부한다.
6. 기존 사용자는 migration에서 `emailVerifiedAt = createdAt`으로 채워 로그인
   회귀를 막는다.
7. 인증 완료 후 자동 로그인은 1차 범위에서 제외하고 `/login?verified=1`로
   안내한다.

완료 기준:

- 중복 이메일, 미인증 사용자, 인증 완료 사용자, 만료 토큰의 기대 동작이
  문서화된다.
- 기존 demo 사용자와 기존 seeded 사용자는 계속 로그인할 수 있다.

### 2. 공용 계약 추가

수정 대상:

- `packages/contracts/src/auth.ts`
- `packages/contracts/src/index.ts`

추가할 계약:

```ts
export type RegisterRequest = {
  email: string;
  password: string;
  name: string;
};

export type RegisterResponse = {
  status: 'verification_sent';
};

export type VerifyEmailRequest = {
  token: string;
};

export type VerifyEmailResponse = {
  status: 'verified';
};

export type ResendVerificationRequest = {
  email: string;
};
```

완료 기준:

- Web과 API가 같은 요청/응답 타입을 import할 수 있다.
- 계약 변경 후 `npm run typecheck:contracts` 기준으로 깨지는 import가 없다.

### 3. Prisma 스키마와 migration 추가

수정 대상:

- `apps/api/prisma/schema.prisma`
- 새 migration 디렉터리

권장 스키마 변경:

```prisma
model User {
  id                      String                   @id @default(cuid())
  email                   String                   @unique
  passwordHash            String
  name                    String
  emailVerifiedAt         DateTime?
  createdAt               DateTime                 @default(now())
  updatedAt               DateTime                 @updatedAt
  emailVerificationTokens EmailVerificationToken[]
  // 기존 relation 유지
}

model EmailVerificationToken {
  id         String    @id @default(cuid())
  userId     String
  tokenHash  String    @unique
  expiresAt  DateTime
  consumedAt DateTime?
  createdAt  DateTime  @default(now())
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, expiresAt])
  @@index([userId, consumedAt])
}
```

마이그레이션 보정:

```sql
UPDATE `User`
SET `emailVerifiedAt` = `createdAt`
WHERE `emailVerifiedAt` IS NULL;
```

완료 기준:

- 인증 토큰 원문은 저장하지 않고 해시만 저장한다.
- 기존 사용자는 모두 이메일 인증 완료 상태로 보정된다.
- `npm run db:migrate`로 migration 파일이 생성된다.
- Prisma client 재생성이 필요한 경우 `npm run db:generate`를 실행한다.

### 4. API env와 SECRET 기준 추가

수정 대상:

- `apps/api/src/config/api-env.ts`
- `env-examples/api.env.example`
- `env-examples/secret-dir.local.example`
- `ENVIRONMENT_SETUP.md`

추가할 env 초안:

```env
MAIL_PROVIDER=console
MAIL_FROM_EMAIL=no-reply@example.com
MAIL_FROM_NAME=PERSONAL_ERP
EMAIL_VERIFICATION_TTL=30m
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
GMAIL_SENDER_EMAIL=
```

운영 규칙:

- 로컬 기본값은 `MAIL_PROVIDER=console`로 둔다.
- Gmail API는 `MAIL_PROVIDER=gmail-api`일 때만 필수값을 검증한다.
- `EMAIL_VERIFICATION_TTL`은 기존 JWT TTL과 같은 duration pattern으로 검증한다.
- 인증 링크의 origin은 기존 `APP_ORIGIN`을 사용해
  `${APP_ORIGIN}/verify-email?token=<token>` 형태로 만든다.

완료 기준:

- Gmail API secret이 비어 있어도 로컬 테스트와 기본 개발 서버가 동작한다.
- `MAIL_PROVIDER=gmail-api`인데 Gmail secret이 없으면 API 부팅 단계에서 명확히
  실패한다.

### 5. 메일 발송 port와 adapter 추가

추가 권장 위치:

- `apps/api/src/common/application/ports/email-sender.port.ts`
- `apps/api/src/common/infrastructure/email/console-email-sender.adapter.ts`
- `apps/api/src/common/infrastructure/email/gmail-api-email-sender.adapter.ts`
- `apps/api/src/common/infrastructure/external-dependencies.module.ts`

구조:

```ts
export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export abstract class EmailSenderPort {
  abstract send(message: EmailMessage): Promise<void>;
}
```

Gmail API 구현 기준:

- Gmail API `users.messages.send`를 사용한다.
- MIME 메시지는 UTF-8 기준으로 만든다.
- `raw` 값은 base64url로 인코딩한다.
- OAuth scope는 최소한 `https://www.googleapis.com/auth/gmail.send`를 사용한다.
- 실패 로그에는 수신자 이메일, 토큰 원문, 인증 링크 전체를 남기지 않는다.

완료 기준:

- 테스트에서는 fake sender를 주입할 수 있다.
- 로컬 console sender는 개발 편의를 위해 링크를 확인할 수 있으나 운영에서는
  사용하지 않는다.
- Gmail API adapter는 회원가입 서비스와 직접 결합하지 않는다.

### 6. 회원가입/인증 서비스 구현

추가 또는 수정 권장 위치:

- `apps/api/src/modules/auth/dto/register.dto.ts`
- `apps/api/src/modules/auth/dto/verify-email.dto.ts`
- `apps/api/src/modules/auth/dto/resend-verification.dto.ts`
- `apps/api/src/modules/auth/auth.controller.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/auth/auth-rate-limit.service.ts`
- `apps/api/src/modules/auth/workspace-bootstrap.service.ts`

구현 순서:

1. DTO validation을 추가한다.
2. `AuthRateLimitService`에 register, verify, resend 버킷을 추가한다.
3. 이메일은 trim/lowercase로 정규화해 저장한다.
4. register 흐름을 구현한다.
   신규 이메일이면 user와 인증 토큰을 만들고 인증 메일을 보낸다.
5. 이미 존재하는 이메일이면 응답은 일반화한다.
   미인증 사용자의 경우 기존 미사용 토큰을 만료/소비 처리하고 새 토큰을 보낼 수
   있다.
6. verify 흐름을 구현한다.
   토큰 해시 조회, 만료 확인, 소비 여부 확인, `emailVerifiedAt` 업데이트,
   workspace bootstrap을 하나의 transaction 경계로 묶는다.
7. resend 흐름을 구현한다.
   미인증 사용자에게만 새 토큰을 만들고 메일을 보내되, 응답은 일반화한다.
8. login 흐름에서 미인증 사용자를 거부한다.

workspace bootstrap 기준:

- 기존 `apps/api/prisma/phase1-backbone.ts`의 `ensurePhase1BackboneForUser`
  정책을 런타임 서비스로 안전하게 옮기거나, 동일 정책의
  `WorkspaceBootstrapService`를 만든다.
- 새 사용자는 기본 `Tenant`, `Ledger`, `TenantMembership(OWNER)`, 기본 장부
  마스터를 가진 상태로 인증 완료된다.

완료 기준:

- 회원가입 public endpoint에도 allowlist origin 검증을 적용한다.
- 인증 성공 전에는 refresh cookie를 발급하지 않는다.
- 인증 완료 후 기존 `AuthSessionService.issueSession` 흐름은 그대로 유지한다.

### 7. Web 회원가입 화면 추가

추가 또는 수정 권장 위치:

- `apps/web/src/features/auth/auth.api.ts`
- `apps/web/src/features/auth/register-page.tsx`
- `apps/web/src/features/auth/verify-email-page.tsx`
- `apps/web/src/features/auth/login-page.tsx`
- `apps/web/app/(app)/register/page.tsx`
- `apps/web/app/(app)/verify-email/page.tsx`

구현 순서:

1. `registerWithPassword`, `verifyEmail`, `resendVerificationEmail` API 함수를
   추가한다.
2. 로그인 페이지에 회원가입 링크를 추가한다.
3. 회원가입 페이지를 만든다.
   이름, 이메일, 비밀번호, 비밀번호 확인을 입력받고 성공 시 인증 메일 안내
   상태로 전환한다.
4. 이메일 인증 페이지를 만든다.
   query string의 `token`을 읽고 `POST /auth/verify-email`을 호출한다.
5. 인증 성공 시 `/login?verified=1`로 이동하거나 로그인 화면에 성공 안내를
   표시한다.
6. 인증 실패/만료 시 재발송 안내를 제공한다.

완료 기준:

- 회원가입 성공 직후 보호 라우트로 이동하지 않는다.
- 기존 로그인/세션 복원 UX는 유지된다.
- 브라우저 접근성 기준으로 버튼과 입력 label이 명확하다.

### 8. 테스트 추가

API 테스트:

- `POST /auth/register` 신규 사용자 성공
- `POST /auth/register` 기존 이메일 일반화 응답
- register 성공 시 refresh cookie 미발급
- register 성공 시 메일 sender 호출
- `POST /auth/verify-email` 성공 시 `emailVerifiedAt` 설정
- verify 성공 시 workspace, ledger, owner membership 생성
- 만료/소비/잘못된 토큰 검증 실패
- 미인증 사용자의 `POST /auth/login` 거부
- register, verify, resend rate limit
- allowlist 밖 origin의 회원가입/인증 요청 차단

Web 테스트:

- auth API 함수의 요청 path와 body 직렬화
- 회원가입 폼 validation
- 회원가입 성공 안내
- 인증 성공 후 로그인 안내
- 기존 로그인 smoke 유지

Prisma 통합 테스트:

- 실제 DB 기준 `register -> verify-email -> login -> GET /auth/me` 흐름을
  추가한다.
- Gmail API는 통합 테스트에서 호출하지 않고 fake 또는 console provider로 대체한다.

완료 기준:

- 최소 `npm run check:quick` 통과
- 권장 `npm run test` 통과
- 인증/브라우저 경계를 바꿨으므로 `npm run test:security:api` 통과
- Prisma 스키마를 바꿨으므로 `npm run test:prisma` 대표 경로 확인

### 9. 문서 동기화

수정 대상:

- `docs/API.md`
- `docs/VALIDATION_NOTES.md`
- `docs/ASVS_L2_EXECUTION_PLAN.md`
- `docs/ASVS_L2_BASELINE_MATRIX.md`
- `docs/DEMO_GUIDE.md`
- `ENVIRONMENT_SETUP.md`
- `README.md`

반영 내용:

- 공개 엔드포인트에 회원가입/이메일 인증 API 추가
- 인증 흐름에 "회원가입 -> 이메일 인증 -> 로그인" 추가
- env 키와 SECRET 위치 추가
- ASVS 문서에서 회원가입/이메일 인증/외부 메일 연동 상태를 `N/A`에서
  `부분 적용` 또는 구현 상태에 맞게 변경
- Web 화면 흐름에 `/register`, `/verify-email` 추가
- 검증 문서에 새 API/Web/Prisma 테스트 범위 추가

완료 기준:

- 문서에 적힌 `npm run` 명령이 실제 package script와 맞는다.
- 구현된 endpoint와 `docs/API.md`, `docs/VALIDATION_NOTES.md`의 surface가
  어긋나지 않는다.

### 10. Gmail API 운영 전환 준비

Google Cloud 작업:

1. Google Cloud 프로젝트를 준비한다.
2. Gmail API를 활성화한다.
3. OAuth consent screen을 설정한다.
4. OAuth client를 만든다.
5. 발송 계정으로 refresh token을 발급한다.
6. Gmail API scope는 `https://www.googleapis.com/auth/gmail.send`로 제한한다.

SECRET 반영:

```env
MAIL_PROVIDER=gmail-api
MAIL_FROM_EMAIL=your-gmail@gmail.com
MAIL_FROM_NAME=PERSONAL_ERP
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
GMAIL_SENDER_EMAIL=your-gmail@gmail.com
```

완료 기준:

- local/staging에서 실제 인증 메일이 도착한다.
- Gmail API 실패 시 API가 민감정보를 노출하지 않는다.
- Gmail 발송 제한과 재발송 rate limit이 충돌하지 않는지 확인한다.

### 11. PR 전 최종 점검

실행 기준:

```bash
npm run check:quick
npm run test
npm run test:security:api
npm run test:prisma
```

확인 항목:

- migration 파일 포함
- `package.json` 또는 lockfile 변경 시 audit 결과 확인
- SECRET 값이 Git diff에 포함되지 않았는지 확인
- Gmail refresh token, 인증 링크 token 원문이 로그와 테스트 snapshot에 남지 않는지
  확인
- 기존 demo 로그인과 E2E smoke가 유지되는지 확인

완료 기준:

- PR 본문에 목적, 변경 범위, migration, env, 문서, 검증 결과를 기록할 수 있다.
- 실패한 검증이 있으면 원인과 후속 조치를 문서화한다.

## 권장 구현 단위

1. 계약과 Prisma migration
2. env 검증과 mail sender port
3. console/fake sender 기반 API 회원가입 흐름
4. workspace bootstrap 서비스
5. Web 회원가입/인증 화면
6. Gmail API adapter
7. 테스트 보강
8. 문서 동기화와 최종 검증

각 단위는 너무 커지면 별도 커밋으로 나누되, PR은 회원가입 기능이 end-to-end로
검증되는 단위로 묶는 것을 권장한다.
