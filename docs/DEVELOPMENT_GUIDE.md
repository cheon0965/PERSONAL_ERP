# 개발 가이드

## 1. 일상 작업 흐름

1. SECRET 경로와 env 파일을 확인합니다.
2. `npm install`
3. `npm run db:up`
4. `npm run db:migrate`
5. `npm run db:seed`
6. `npm run dev`

`npm run db:up`는 [docker-compose.yml](../docker-compose.yml) 의 폐기 가능한 로컬 개발 전용 MySQL bootstrap 기본값을 사용합니다.
이 값은 shared/staging/production secret로 재사용하지 않습니다.

작업 전후 기본 검증:

```bash
npm run check:quick
npm run test
```

## 2. env 준비 기준

현재 문서의 기본 SECRET 폴더 예시는 루트 [`.secret-dir.local`](../.secret-dir.local) 의 값인 `C:\secrets\personal-erp` 입니다.

실제 기준 파일:

- `C:\secrets\personal-erp\api.env`
- `C:\secrets\personal-erp\web.env`

값 예시는 [ENVIRONMENT_SETUP.md](../ENVIRONMENT_SETUP.md) 를 기준으로 맞추고, macOS/Linux에서는 같은 의미의 절대 경로로 치환합니다.

## 3. 백엔드 기능 추가 순서

1. 먼저 `docs/domain/business-logic-draft.md`와 `docs/domain/core-entity-definition.md`를 기준으로 이 기능이 어떤 운영 흐름과 엔티티 경계에 속하는지 판단합니다.
2. 이어서 이 기능이 `단순 CRUD`, `핵심 쓰기 흐름`, `읽기/조합 흐름` 중 어디에 속하는지 판단합니다.
3. `packages/contracts`에 새 요청/응답 계약이 필요한지 먼저 확인합니다.
4. 필요한 DTO와 컨트롤러 엔드포인트를 추가합니다.
5. 구현 패턴은 아래 셋 중 하나를 고릅니다.
   `단순 CRUD`: `controller -> service -> repository -> mapper/calculator`
   `핵심 쓰기 흐름`: `controller -> use-case -> port -> adapter`
   `읽기/조합 흐름`: `controller -> read service -> read repository -> projection`
6. `collected-transactions`, `recurring-rules`, `dashboard`, `forecast`처럼 모듈 바깥 참조가 있는 영역이면 `public.ts` 진입점도 같이 맞춥니다.
7. 현재 요청이 어떤 `tenantId` / `TenantMembership` / `ActorRef` 경계에서 실행되는지 확인합니다.
   현재 HTTP surface는 `user.currentWorkspace` 기반으로 동작하더라도, 상위 도메인 기준은 Tenant/Ledger/Actor 경계라는 점을 문서와 코드에서 분리해 둡니다.
8. 관련 테스트를 같이 추가합니다.
   `핵심 쓰기 흐름`: use-case 테스트 + 요청 단위 API 테스트
   `읽기/조합 흐름`: read service 테스트
   필요 시 브라우저 E2E 또는 Prisma 대표 통합 테스트

## 4. 프런트엔드 기능 추가 순서

1. `app`에는 라우트 래퍼만 둡니다.
2. `features/<domain>`에 페이지, API, 폼, 훅을 둡니다.
3. 공통 조각만 `shared`로 올립니다.
4. feature API는 `shared/api/fetch-json.ts`를 사용해 인증/오류/fallback 정책을 같이 따릅니다.
5. 로딩 실패와 제출 실패가 사용자에게 보이는지 확인합니다.
6. 목록 갱신이 필요한 mutation이면 query cache 갱신 또는 invalidation을 함께 넣습니다.

## 5. 계약과 문서 동기화 절차

API나 공유 계약이 바뀌면 아래 순서를 같은 PR 안에서 닫습니다.

1. `packages/contracts`
   공유 요청/응답 shape를 먼저 맞춥니다.
2. API 구현
   DTO, controller, service/use-case/read service, repository/adapter/projection, Swagger decorator를 맞춥니다.
3. Web 구현
   feature API, 화면, 인증/오류 흐름을 맞춥니다.
4. 테스트
   서비스 테스트, 요청 단위 테스트, 필요한 Web 테스트를 보강합니다.
5. 문서
   관련 문서를 같은 PR에서 함께 갱신합니다.

문서별 역할:

- `README.md`: 저장소 진입 설명, 빠른 시작, 가장 큰 운영 원칙
- `docs/domain/README.md`: 도메인 기준 문서의 진입점과 읽는 순서
- `docs/domain/business-logic-draft.md`: 운영 사이클, 권한 모델, 주요 회계 정책, 상태 정의
- `docs/domain/core-entity-definition.md`: 핵심 엔티티, 불변조건, 관계, 구현 우선순위
- `docs/OPERATIONS_CHECKLIST.md`: 배포 순서, 수동 스모크 체크, 운영 장애 대응
- `docs/API.md`: 사람이 읽는 엔드포인트 요약과 인증/쓰기 흐름
- `docs/ERROR_HANDLING_AND_LOGGING.md`: 예외 처리 기준, 최소 로그 기준, 민감정보 금지선
- `docs/VALIDATION_NOTES.md`: 현재 실제 검증 범위와 남은 공백
- `docs/PROJECT_PLAN.md`: 중기 로드맵
- `PORTFOLIO_ARCHITECTURE_GUIDE.md`: 프로젝트 목적, 판단 원칙, 현재 아키텍처 설명
- `docs/adr/`: 장기 구조 결정

## 6. DB 변경 규칙

- 스키마 변경은 `npm run db:migrate`를 기본으로 사용합니다.
- migration 파일을 함께 커밋합니다.
- `db:push:unsafe`는 기본 워크플로로 사용하지 않습니다.

## 7. env 변경 규칙

- API env 검증 코드는 `apps/api/src/config/api-env.ts`
- Web env 검증 코드는 `apps/web/src/shared/config/env.ts`

새 env 키를 추가하면 다음을 함께 수정합니다.

- `C:\secrets\personal-erp\api.env` 또는 `C:\secrets\personal-erp\web.env`
- 검증 코드
- `ENVIRONMENT_SETUP.md`
- 관련 기능 문서

## 8. 테스트와 검증

빠른 검증:

```bash
npm run check:quick
```

- `npm run check:quick`에는 `npm run docs:check`도 포함되며, 문서의 `npm run` 표기와 `docs/API.md`, `docs/VALIDATION_NOTES.md`의 Web/API surface가 실제 라우트와 controller 기반 Swagger surface와 맞는지 함께 확인합니다.
- Windows에서 `core.autocrlf=true` checkout을 쓰면 Prettier EOL 차이로 `check:quick`가 CI와 다르게 보일 수 있습니다.
- CI와 같은 LF 기준 포맷 확인이 필요하면 `npm run format:check -- --end-of-line auto`를 함께 봅니다.

테스트 포함 검증:

```bash
npm run test
```

대표 심화 검증:

```bash
npm run test:e2e:smoke:build
npm run test:e2e
npm run test:prisma
```

- `npm run test:e2e:smoke:build`는 `next build` 결과물을 기준으로 대표 브라우저 smoke를 다시 확인하는 CI 정렬용 검증입니다.
- `npm run test:e2e`는 브라우저 사용자 흐름 대표 검증입니다.
- `npm run test:prisma`는 로컬에서는 `PRISMA_INTEGRATION_DATABASE_URL`을 우선, `DATABASE_URL`을 fallback 으로 사용해 실제 MySQL 경계를 보는 대표 통합 검증입니다.
- CI에서는 `PRISMA_INTEGRATION_DATABASE_URL` 전용으로 동작하며, 전용 secret이 없으면 `DATABASE_URL`로 우회하지 않고 skip 이유를 남깁니다.
- 테스트 DB가 준비되지 않은 경우에는 어떤 env가 없거나 닿지 않는지 skip 메시지에 바로 드러납니다.
- 둘 다 기본 개발 루프와 분리된 선택 실행입니다.

전체 CI 수준 검증:

```bash
npm run check
```

## 9. 자주 놓치기 쉬운 항목

- demo fallback을 기본값처럼 켜두지 않았는지
- 요청 주체 경계 없이 데이터를 조회하지 않았는지
- contracts와 실제 응답 shape가 어긋나지 않았는지
- Swagger 노출 상태와 문서 설명이 달라지지 않았는지
- `docs/VALIDATION_NOTES.md`가 현재 검증 범위보다 뒤처지지 않았는지
- `.secret-dir.local` 경로와 실제 SECRET 폴더 구성이 맞는지
