# 검증 메모

## 현재 기본 검증 기준

- `npm run check:quick`
- `npm run test`

## 대표 심화 검증

- `npm run test:e2e`
- `npm run test:prisma`

설명:

- `npm run test:e2e`는 기본 루프와 분리된 브라우저 대표 흐름 검증입니다.
- `npm run test:prisma`는 기본 루프와 분리된 실DB Prisma 경계 검증입니다.
- 현재 기본 `npm run test`에서는 Prisma 통합 테스트가 안내 문구와 함께 skip됩니다.

## CI 보안 게이트

- `security-regression`
  `npm run test:security:api`로 인증/세션, 브라우저/API 경계 회귀를 CI에서 다시 확인합니다.
- `audit-runtime`
  `npm run audit:runtime`으로 실제 배포 대상인 `api`, `web` workspace의 runtime dependency에서 high 이상 취약점을 점검합니다.
- `semgrep-ce`
  Semgrep CE 정적 분석을 수행합니다.
- `gitleaks`
  저장소 전체 secret 노출 여부를 점검합니다.
- `dependency-review`
  PR에서 runtime dependency 고위험 변경을 차단합니다.

설명:

- 로컬 기본 검증은 `check:quick`와 `test`가 맡고, CI는 여기에 보안 게이트를 추가해 회귀를 막습니다.
- `npm run audit:runtime`은 네트워크가 필요한 명령이라 로컬보다 CI 결과를 기본 증적으로 봅니다.

## 현재 테스트 범위

### API

- 인증 로그인 성공/실패
- 인증 세션 생성/회전/로그아웃
- 보호 라우트의 `401`
- `GET /auth/me`
- `POST /transactions`
  DTO validation, 현재 사용자 소유 계정/카테고리 검증, 생성 응답 shape
- `POST /recurring-rules`
  DTO validation, 현재 사용자 소유 계정/카테고리 검증, 생성 응답 shape
- 거래/반복규칙 use-case 생성 로직
- 대시보드 요약 계산
- 예측 잔액 계산
- `GET /health`, `GET /health/ready`
- `x-request-id` 헤더 전달
- 허용된 origin에 대한 CORS/security header 적용
- 인증/민감 응답의 `Cache-Control: no-store`
- allowlist 밖 origin의 cookie-auth 요청 차단(`403 Origin not allowed`)
- 로그인 실패, refresh 재사용, bearer 누락, ownership 거부, readiness 실패에 대한 보안 이벤트 로그 기록
- `transactions` Prisma 통합 테스트
  실제 MySQL 기준으로 ownership 확인, 생성, 조회 정렬과 사용자 스코프를 대표 검증
- `GET /transactions`
  현재 사용자 범위만 반환하는지, 내부 소유권 필드를 노출하지 않는지 검증
- `GET /recurring-rules`
  현재 사용자 범위만 반환하는지, 내부 소유권 필드를 노출하지 않는지 검증
- `GET /dashboard/summary`
  다른 사용자 데이터가 집계에 섞이지 않고 raw read model을 노출하지 않는지 검증
- `GET /forecast/monthly`
  현재 사용자 집계만 사용하고 month query를 그대로 반영하는지 검증

### Web

- env 파싱
- demo fallback 활성화/비활성화 정책
- 보호 요청의 Bearer 토큰 주입
- `401` 응답 시 세션 정리 정책
- mutation 요청의 JSON body 직렬화
- 요청 실패 메시지 안내
- 브라우저에서 `/transactions` 보호 라우트 리다이렉트
- 브라우저 기준 로그인 후 세션 복원
- 실제 브라우저 상호작용으로 거래 Quick Add 성공 및 목록 갱신

## 현재 남아 있는 공백

- 실제 브라우저 상호작용으로 반복규칙 Quick Add 성공 및 목록 갱신을 보는 테스트
- build 결과물 기준 스모크 검증 자동화
- 운영 체크리스트 기반 수동 스모크 일부의 자동화

## 해석

현재 검증체계는 성공 경로 계약, 인증, DTO validation, 소유권 검증, readiness/request-id 같은 운영 신호, 핵심 쓰기 흐름, 대표 브라우저 사용자 흐름까지를 자동으로 막는 상태입니다.
`npm run test:e2e`, `npm run test:prisma`는 빠른 기본 테스트와 분리된 대표 심화 검증으로 유지합니다.
다음 보강 우선순위는 반복규칙 브라우저 흐름과 배포 전 스모크 검증 자동화입니다.
