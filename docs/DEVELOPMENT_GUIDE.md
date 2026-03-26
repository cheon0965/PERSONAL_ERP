# 개발 가이드

## 1. 일상 작업 흐름

1. SECRET 경로와 env 파일을 확인합니다.
2. `npm install`
3. `npm run db:up`
4. `npm run db:migrate`
5. `npm run db:seed`
6. `npm run dev`

작업 전후 기본 검증:

```bash
npm run check:quick
npm run test
```

## 2. env 준비 기준

현재 기준 SECRET 폴더 경로는 루트 [.secret-dir.local](/d:/참고자료/프로젝트소스/personal-erp-starter/.secret-dir.local#L1) 의 값인 `C:\secrets\personal-erp` 입니다.

실제 기준 파일:

- `C:\secrets\personal-erp\api.env`
- `C:\secrets\personal-erp\web.env`

값 예시는 [ENVIRONMENT_SETUP.md](/d:/참고자료/프로젝트소스/personal-erp-starter/ENVIRONMENT_SETUP.md) 를 기준으로 맞춥니다.

## 3. 백엔드 기능 추가 순서

1. `packages/contracts`에 요청/응답 계약이 필요한지 먼저 확인합니다.
2. 필요한 DTO와 컨트롤러 엔드포인트를 추가합니다.
3. 서비스에 유즈케이스를 작성합니다.
4. repository에서 Prisma 접근을 분리합니다.
5. mapper/calculator가 필요하면 별도 파일로 둡니다.
6. 현재 사용자 경계가 필요한지 확인합니다.
7. 테스트를 추가합니다.

## 4. 프론트엔드 기능 추가 순서

1. `app`에는 라우트 래퍼만 둡니다.
2. `features/<domain>`에 페이지, API, 폼, 훅을 둡니다.
3. 공통 조각만 `shared`로 올립니다.
4. feature API는 fallback 정책을 지키도록 `shared/api/fetch-json.ts`를 사용합니다.
5. 데이터 로딩 실패 시 사용자에게 오류가 보이는지 확인합니다.

## 5. 계약 변경 규칙

- 새로운 엔드포인트를 추가하거나 응답 shape가 바뀌면 `packages/contracts`부터 갱신합니다.
- API와 Web은 같은 PR에서 같이 맞춥니다.
- 문서나 Swagger 설명도 같이 갱신합니다.

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

테스트 포함 검증:

```bash
npm run test
```

전체 CI 수준 검증:

```bash
npm run check
```

## 9. 자주 놓치기 쉬운 항목

- demo fallback을 기본값처럼 켜두지 않았는지
- `userId` 경계 없이 데이터를 조회하지 않았는지
- contracts와 실제 응답 shape가 어긋나지 않았는지
- 문서와 구현 설명이 달라지지 않았는지
- `.secret-dir.local` 경로와 실제 SECRET 폴더 구성이 맞는지
