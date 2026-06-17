# PERSONAL_ERP

`PERSONAL_ERP`는 1인 사업자와 소상공인이 매달 반복하는 재무 운영을 `기준 데이터 준비 -> 월 운영 -> 거래 수집 -> 전표 확정 -> 월 마감 -> 재무제표 -> 차기 이월 -> 다음 달 전망`까지 한 흐름으로 닫기 위한 월별 재무 운영 ERP입니다.

단순 거래 기록 앱이 아니라, 예정 거래, 업로드 거래, 공식 회계 기록, 마감, 보고, 다음 달 판단까지 이어지는 운영 사이클을 제품 흐름과 코드 구조로 설명하는 포트폴리오 프로젝트입니다.

## 한눈에 보기

| 항목      | 내용                                                                     |
| --------- | ------------------------------------------------------------------------ |
| 대상      | 월별 재무 운영을 직접 챙겨야 하는 1인 사업자와 소상공인                  |
| 핵심 문제 | 예정 거래, 실제 거래, 전표, 마감, 보고가 서로 끊겨 있음                  |
| 해법      | 한 달을 열고, 수집하고, 확정하고, 닫고, 다음 달로 넘기는 운영 흐름       |
| 핵심 설계 | 수집 거래와 전표를 분리해 운영 입력과 공식 회계 기록의 경계를 명확히 함  |
| 구조 판단 | modular monolith + 회계 정합성이 중요한 쓰기 흐름의 선택적 헥사고날 구조 |
| 기술      | Next.js, NestJS, Prisma, MySQL, TypeScript, MUI, React Query             |

## 바로 체험하기

**공개 체험 URL: <https://personalerp.theworkpc.com>**

| 항목          | 값                                      |
| ------------- | --------------------------------------- |
| Web           | <https://personalerp.theworkpc.com>     |
| API           | <https://personalerp.theworkpc.com/api> |
| 데모 이메일   | `demo@example.com`                      |
| 데모 비밀번호 | `Demo1234!`                             |

데모 순서는 [데모 체험 가이드](./docs/DEMO_GUIDE.md)를 기준으로 확인합니다.
루트 `/`는 비로그인 사용자에게 제품 소개와 데모 진입을 보여주고, 인증된 사용자는 `/dashboard`로 이동합니다.

## 먼저 볼 문서

| 목적                    | 문서                                                                 |
| ----------------------- | -------------------------------------------------------------------- |
| 포트폴리오 핵심 요약    | [docs/PORTFOLIO_PROJECT_BRIEF.md](./docs/PORTFOLIO_PROJECT_BRIEF.md) |
| 제출용 PPT와 발표 노트  | [docs/portfolio-ppt/README.md](./docs/portfolio-ppt/README.md)       |
| 현재 구현 범위          | [docs/CURRENT_CAPABILITIES.md](./docs/CURRENT_CAPABILITIES.md)       |
| 데모 체험 흐름          | [docs/DEMO_GUIDE.md](./docs/DEMO_GUIDE.md)                           |
| 아키텍처 기준           | [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)                       |
| API 요약                | [docs/API.md](./docs/API.md)                                         |
| 검증 범위와 최신 실행값 | [docs/VALIDATION_NOTES.md](./docs/VALIDATION_NOTES.md)               |

전체 문서 목록은 [문서 인덱스](./docs/README.md)에서 확인합니다.

## 프로젝트 핵심 흐름

```text
현재 사업장 / 장부 확인
-> 기준 데이터 준비
-> 현재 운영월 열기
-> 반복 규칙 / 계획 항목 생성
-> 수기 입력 또는 업로드 배치로 거래 수집
-> 전표 확정 / 반전 / 정정
-> 월 마감
-> 재무제표 생성
-> 자금수단별 현황 확인
-> 차기 이월
-> 다음 기간 전망
```

가장 중요한 도메인 결정은 `수집 거래`와 `전표`를 분리한 것입니다.
수집 거래는 사용자가 검토할 운영 입력이고, 전표는 공식 회계 확정 결과입니다.
이 분리 덕분에 업로드 오류, 중복 후보, 계획 매칭, 확정 이후 정정을 같은 흐름 안에서 다룰 수 있습니다.

## 왜 이런 구조인가

이 프로젝트의 구조는 기술 패턴에서 먼저 출발하지 않았습니다.
월 운영 ERP가 가진 업무 압력에서 출발했습니다.

- 월 운영은 `열림 -> 검토 -> 확정 -> 마감 -> 이월`이라는 상태 흐름을 가집니다.
- 전표와 마감 이후 숫자가 흔들리면 보고와 다음 달 기준이 함께 깨집니다.
- 업로드, 수기 입력, 반복 계획, 차량/부채 비용처럼 입력 경로가 여러 개입니다.
- 그래서 원장 쓰기 흐름은 강하게 보호하고, 보고/전망은 읽기 조합으로 분리했습니다.

이 판단을 코드에서는 아래처럼 표현합니다.

```text
apps/web      Next.js 기반 화면
apps/api      NestJS 기반 API
packages/contracts
              Web/API request/response contract
packages/money
              KRW 금액 계산 기준
docs          제품, 도메인, 운영, 검증 문서
```

```text
화면
-> HTTP 요청과 shared contract
-> API
-> Prisma
-> MySQL
```

이 프로젝트는 실제 microservice가 아니라 `modular monolith`입니다.
하나의 저장소와 배포 단위를 유지해 구현, 검증, 배포를 끝까지 닫되, 돈·전표·마감·권한처럼 실패 비용이 큰 쓰기 흐름에만 더 엄격한 use case, port, adapter 경계를 적용했습니다.
기준 데이터나 설정성 CRUD는 service 중심 구조를 유지하고, 대시보드/전망/운영 허브는 read model과 projection 중심으로 둡니다.

## 현재 구현 범위

| 영역        | 구현 내용                                                                             |
| ----------- | ------------------------------------------------------------------------------------- |
| 인증/계정   | 공개 홈, 회원가입, 이메일 인증, 초대 수락, 로그인, 비밀번호 재설정, 토큰 재발급       |
| 사업장/권한 | 현재 사업장과 장부, 사업장 전환, 멤버 초대, 역할 변경, 감사 로그                      |
| 관리자      | 사용자 관리, 사업장 관리, 지원 문맥, 보안 위협 로그, 운영 상태, 메뉴와 권한 관리      |
| 운영 지원   | 운영 허브, checklist, 예외 처리함, 월 마감 보조, 업로드 현황, 알림, 반출, 운영 메모   |
| 기준 데이터 | 자금수단, 카테고리, 계정과목, 거래유형, 준비 상태 요약                                |
| 월 운영     | 운영 기간 열기/마감/재오픈, 수집 거래 생성/수정/삭제/확정, 전표 반전/정정             |
| 업로드      | UTF-8 텍스트 업로드, IM뱅크 텍스트 PDF 파싱, 스캔 PDF 차단, 행별 검토와 일괄 등록     |
| 계획        | 반복 규칙, 계획 항목 생성, 계획과 거래/전표 추적                                      |
| 운영 자산   | 보험, 부채와 상환 일정, 차량, 연료/정비 이력, 선택적 회계 연동                        |
| 보고/판단   | 대시보드, 재무제표, 자금수단별 현황, 차기 이월, 기간 전망                             |
| 공개/검색   | 실제 운영 화면 기반 공개 홈, 한글 검색어 메타데이터, FAQ, robots/sitemap              |
| 화면 경험   | 데스크톱 표 화면, 모바일 카드 목록, 모바일 5/10/20개 단위 페이지 처리                 |
| 오류 경험   | 사용자용 오류 메시지와 개발자용 진단 정보를 분리하고, 진단 정보는 기본 접힘 상태 제공 |

상세 구현 범위는 [현재 구현 범위](./docs/CURRENT_CAPABILITIES.md)를 기준으로 확인합니다.

## 공식 회계 경계

현재 프로젝트의 공식 회계 흐름은 아래 기준으로 고정되어 있습니다.

```text
수집 거래
-> 전표 / 전표 라인
-> 마감 스냅샷
-> 재무제표 스냅샷
-> 차기 이월 기록
```

레거시 Prisma `Transaction` 모델은 공식 회계 기준으로 사용하지 않습니다.
회계 확정, 정정, 반전, 마감, 보고는 `JournalEntry` 계열과 스냅샷을 기준으로 설명합니다.

자세한 기준은 [구형 거래 모델 제거 이후 회계 경계](./docs/ACCOUNTING_MODEL_BOUNDARY.md), [비즈니스 로직 설계 초안](./docs/domain/business-logic-draft.md), [핵심 엔티티 정의서](./docs/domain/core-entity-definition.md)를 따릅니다.

## 운영과 품질 기준

- 대부분의 서버 기능은 인증된 사용자만 접근합니다.
- 모든 서버 응답에는 요청 번호를 붙여 오류 추적에 사용합니다.
- 브라우저 오류는 사용자용 안내와 개발자용 진단 정보를 분리해 표시합니다.
- 모바일 표 화면은 카드 목록으로 전환하고 5/10/20개 단위 페이지 처리를 유지합니다.
- 공개 홈만 검색 노출 대상으로 두고, 인증 뒤 업무 화면은 `noindex` 정책을 유지합니다.
- 공개 홈은 `ko-KR` 메타데이터, 한글 검색어, Open Graph 이미지, FAQ 구조화 데이터, sitemap/robots 기준을 유지합니다.
- 운영 반출은 UTF-8 CSV 기준으로 생성하고 감사 이벤트를 남깁니다.
- Docker 배포 런타임은 Web `127.0.0.1:3100`, API `127.0.0.1:4100`을 Caddy가 단일 HTTPS 도메인으로 프록시합니다.
- `npm run docs:check`는 문서에 적힌 명령, 화면 경로, 서버 기능이 실제 코드와 맞는지 확인합니다.
- `npm run money:check`는 금액 직접 연산이 새로 섞이지 않도록 막습니다.
- `npm run test:prisma`는 Docker 기반 일회성 MySQL에서 실제 DB 경계를 검증합니다.

## 빠른 시작

### 실행 전 필요 항목

- Node.js `22.x` 이상
- npm
- Docker와 Docker Compose
- 로컬 또는 외부 비밀값 폴더 설정

환경 파일은 저장소 밖 비밀값 폴더를 우선 사용합니다.
기본 예시는 아래 파일을 참고합니다.

- 비밀값 폴더 경로 예시: [env-examples/secret-dir.local.example](./env-examples/secret-dir.local.example)
- API 환경 파일 예시: [env-examples/api.env.example](./env-examples/api.env.example)
- 웹 환경 파일 예시: [env-examples/web.env.example](./env-examples/web.env.example)
- 전체 환경 설정: [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md)

### 설치와 로컬 실행

```bash
npm install
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

- 웹: `http://localhost:3000`
- API: `http://localhost:4000/api`
- Swagger: `http://localhost:4000/api/docs` (`SWAGGER_ENABLED=true`일 때)

## 검증 명령

기본 검증은 아래 명령을 우선 사용합니다.

```bash
npm run check:quick
npm run test
npm run docs:check
```

- `npm run check:quick`: 포맷, 문서 명령/표면 점검, 금액 가드, lint, typecheck를 함께 확인합니다.
- `npm run test`: 웹/서버 기본 테스트를 수행합니다.
- `npm run docs:check`: README와 docs의 명령, 화면 경로, API 표면이 실제 코드와 맞는지 확인합니다.

심화 검증은 환경과 목적에 따라 별도로 실행합니다.

```bash
npm run money:check
npm run test:e2e:smoke:build:browser
npm run test:e2e
npm run test:prisma
npm run audit:runtime
npm run build
```

- `npm run test:e2e`: 대표 브라우저 흐름을 확인합니다.
- `npm run test:prisma`: Docker 기반 MySQL에서 월 운영 흐름과 Prisma 경계를 확인합니다.
- `npm run audit:runtime`: 배포 대상 런타임 의존성의 보안 기준을 확인합니다.

최신 검증 결과와 남은 공백은 [검증 메모](./docs/VALIDATION_NOTES.md)를 기준으로 봅니다.

## 협업과 문서 기준

- API 요청/응답 형태의 1차 기준은 `packages/contracts`입니다.
- 구현된 서버 기능과 인증 노출 상태는 Swagger 문서와 [API 개요](./docs/API.md)를 함께 봅니다.
- DB 변경은 Prisma 마이그레이션으로 남깁니다.
- 웹은 `app -> features -> shared` 경계를 유지합니다.
- 새 기능이나 문서 변경 전후에는 [검증 메모](./docs/VALIDATION_NOTES.md)의 기준을 확인합니다.
- 모든 문서/텍스트 파일 작업은 UTF-8 인코딩 기준을 유지합니다.

## 라이선스

프로젝트 자체 소스코드와 문서는 [MIT License](./LICENSE)를 따릅니다.

서드파티 라이브러리, Docker 이미지, 패키지 데이터, 외부 도구는 각 프로젝트의 라이선스를 따릅니다.
주요 직접 의존성은 대체로 MIT 또는 Apache-2.0 계열이며, Next.js 이미지 처리 경로의 `sharp`/`libvips` LGPL 계열 의존성, `caniuse-lite`의 CC-BY-4.0, `mysql:8.4` 이미지의 배포 조건처럼 배포 방식에 따라 고지 또는 소스 제공 의무가 생길 수 있는 항목은 [서드파티 고지](./THIRD_PARTY_NOTICES.md)에서 별도로 추적합니다.
