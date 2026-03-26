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
docs/
```

- `apps/web`: 화면, 사용자 상호작용, feature 조합
- `apps/api`: 인증, 검증, 도메인 처리, 데이터 접근
- `packages/contracts`: 요청/응답 타입의 단일 소스

## 3. 프론트엔드 구조

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

## 4. 백엔드 구조

API는 다음 흐름을 기본으로 사용합니다.

```text
controller -> service -> repository -> mapper/calculator
```

원칙:

- controller는 요청/응답과 인증 컨텍스트만 다룹니다.
- service는 유즈케이스를 조합합니다.
- repository는 Prisma 접근을 담당합니다.
- mapper/calculator는 응답 변환과 계산을 분리합니다.

## 5. 인증과 사용자 경계

- `health`, `auth/login`을 제외한 API는 기본적으로 보호됩니다.
- 컨트롤러는 현재 사용자 컨텍스트를 받고, 서비스는 `userId`를 기준으로 동작합니다.
- 계좌, 카테고리 등 참조 대상도 현재 사용자 소유인지 검증합니다.

## 6. 환경변수 정책

- 루트 공용 `.env`를 기본값으로 쓰지 않습니다.
- 기본 권장 방식은 `PERSONAL_ERP_SECRET_DIR`가 가리키는 외부 SECRET 폴더를 사용하는 것입니다.
- 현재 기준 경로는 [\.secret-dir.local](/d:/참고자료/프로젝트소스/personal-erp-starter/.secret-dir.local#L1) 에 정의된 `C:\secrets\personal-erp` 입니다.
- 현재 실제 기준 파일은 `C:\secrets\personal-erp\api.env`, `C:\secrets\personal-erp\web.env` 입니다.
- 로컬 fallback으로 API는 `apps/api/.env`, Web은 `apps/web/.env.local`도 읽을 수 있습니다.
- 앱 시작 시 env를 검증합니다.
- env 구조가 바뀌면 관련 문서와 검증 코드를 함께 수정합니다.

## 7. fallback 정책

- demo fallback은 기본적으로 꺼져 있습니다.
- 개발 환경에서 `NEXT_PUBLIC_ENABLE_DEMO_FALLBACK=true`일 때만 허용됩니다.
- 현재 권장 위치는 `C:\secrets\personal-erp\web.env` 입니다.
- fallback이 꺼져 있으면 Web은 쿼리 오류를 화면에 직접 표시합니다.

자세한 내용은 [FALLBACK_POLICY.md](/d:/참고자료/프로젝트소스/personal-erp-starter/docs/FALLBACK_POLICY.md) 를 참고합니다.

## 8. 테스트 전략

현재 테스트는 두 축으로 나뉩니다.

- API 서비스 레벨 테스트: 인증, 소유권 검증, 대시보드/예측 계산
- Web 런타임 정책 테스트: env 파싱, fallback 동작

현재는 회귀 방지용 최소 매트릭스가 들어가 있으며, 다음 확장 우선순위는 요청 단위 통합 테스트입니다.
