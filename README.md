# PERSONAL_ERP

1인 사업자와 소상공인이 매달 반복하는 재무 운영을 `기준 데이터 준비 -> 월 운영 -> 거래 수집 -> 전표 확정 -> 월 마감 -> 재무제표 -> 차기 이월 -> 다음 달 전망`까지 한 흐름으로 닫기 위한 월별 재무 운영 시스템입니다.

이 저장소의 포트폴리오용 압축 설명은 [포트폴리오 프로젝트 요약](./docs/PORTFOLIO_PROJECT_BRIEF.md)에 정리되어 있습니다.
루트 README는 첫 진입점으로, 프로젝트의 목적과 실행 방법, 주요 문서 위치를 빠르게 안내합니다.

## 먼저 볼 문서

| 목적                 | 문서                                                                 |
| -------------------- | -------------------------------------------------------------------- |
| 포트폴리오 핵심 요약 | [docs/PORTFOLIO_PROJECT_BRIEF.md](./docs/PORTFOLIO_PROJECT_BRIEF.md) |
| 현재 구현 범위       | [docs/CURRENT_CAPABILITIES.md](./docs/CURRENT_CAPABILITIES.md)       |
| 데모 체험 흐름       | [docs/DEMO_GUIDE.md](./docs/DEMO_GUIDE.md)                           |
| 아키텍처 기준        | [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)                       |
| API 요약             | [docs/API.md](./docs/API.md)                                         |
| 검증 범위            | [docs/VALIDATION_NOTES.md](./docs/VALIDATION_NOTES.md)               |

## 프로젝트 핵심

`PERSONAL_ERP`는 단순 거래 기록 앱이 아니라, 사업자가 한 달을 운영하고 닫는 과정을 제품 흐름으로 연결합니다.

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

핵심은 `수집 거래`와 `전표`를 분리한 점입니다.
수집 거래는 사용자가 검토할 운영 입력이고, 전표는 공식 회계 확정 결과입니다.
이 분리 덕분에 업로드 오류, 중복 후보, 계획 매칭, 확정 이후 정정을 같은 흐름 안에서 다룰 수 있습니다.

## 현재 구현 범위

| 영역        | 구현 내용                                                                             |
| ----------- | ------------------------------------------------------------------------------------- |
| 인증/계정   | 회원가입, 이메일 인증, 초대 수락, 로그인, 비밀번호 재설정, 토큰 재발급, 계정 보안     |
| 사업장/권한 | 현재 사업장과 장부, 사업장 전환, 멤버 초대, 역할 변경, 감사 로그                      |
| 관리자      | 사용자 관리, 사업장 관리, 지원 문맥, 보안 위협 로그, 운영 상태, 메뉴와 권한 관리      |
| 운영 지원   | 운영 허브, 체크리스트, 예외 처리함, 월 마감 보조, 업로드 현황, 알림, 반출, 운영 메모  |
| 기준 데이터 | 자금수단, 카테고리, 계정과목, 거래유형, 준비 상태 요약                                |
| 월 운영     | 운영 기간 열기/마감/재오픈, 수집 거래 생성/수정/삭제/확정, 전표 반전/정정             |
| 업로드      | UTF-8 텍스트 업로드, IM뱅크 텍스트 PDF 파싱, 스캔 PDF 차단, 행별 검토와 일괄 등록     |
| 계획        | 반복 규칙, 계획 항목 생성, 계획과 거래/전표 추적                                      |
| 운영 자산   | 보험, 부채와 상환 일정, 차량, 연료/정비 이력, 선택적 회계 연동                        |
| 보고/판단   | 대시보드, 재무제표, 자금수단별 현황, 차기 이월, 기간 전망                             |
| 화면 경험   | 데스크톱 표 화면, 모바일 카드 목록, 모바일 5/10/20개 단위 페이지 처리                 |
| 오류 경험   | 사용자용 오류 메시지와 개발자용 진단 정보를 분리하고, 진단 정보는 기본 접힘 상태 제공 |

루트 `/`는 비로그인 사용자에게 제품 소개와 회원가입 안내를 보여주고, 인증된 사용자는 `/dashboard`로 이동합니다.

## 기술과 구조

```text
apps/web      Next.js 기반 화면
apps/api      NestJS 기반 서버
packages/contracts
              화면과 서버가 공유하는 요청/응답 계약
packages/money
              원화 금액 계산 기준
docs          제품, 도메인, 운영, 검증 문서
```

```text
화면
-> HTTP 요청과 공용 계약
-> 서버
-> Prisma
-> MySQL
```

이 프로젝트는 실제 마이크로서비스가 아니라 모듈러 모놀리스입니다.
작은 팀이나 1인 개발 환경에서도 구현, 검증, 배포를 끝까지 유지할 수 있도록 하나의 저장소와 실행 흐름을 선택했습니다.
대신 서버 내부는 도메인별 모듈로 나누고, 수집 거래, 업로드, 전표, 마감처럼 회계 정합성이 중요한 영역에만 더 엄격한 경계를 적용했습니다.

주요 기술 기준:

- 웹: Next.js, TypeScript, MUI, React Query
- 서버: NestJS, Prisma, MySQL
- 공용 계약: `packages/contracts`
- 금액 기준: `packages/money`, `MoneyWon`, `Decimal(19,0)`, 반올림과 배분 기준
- 환경값: 저장소 안 일반 `.env`보다 외부 비밀값 폴더 우선

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
- 운영 반출은 UTF-8 CSV 기준으로 생성하고 감사 이벤트를 남깁니다.
- `npm run docs:check`는 문서에 적힌 명령, 화면 경로, 서버 기능이 실제 코드와 맞는지 확인합니다.
- `npm run money:check`는 금액 직접 연산이 새로 섞이지 않도록 막습니다.
- `npm run test:prisma`는 Docker 기반 일회성 MySQL에서 실제 DB 경계를 검증합니다.

## 빠른 시작

먼저 의존성을 설치합니다.

```bash
npm install
```

환경 파일은 저장소 밖 비밀값 폴더를 우선 사용합니다.
기본 예시는 아래 파일을 참고합니다.

- 비밀값 폴더 경로 예시: [env-examples/secret-dir.local.example](./env-examples/secret-dir.local.example)
- API 환경 파일 예시: [env-examples/api.env.example](./env-examples/api.env.example)
- 웹 환경 파일 예시: [env-examples/web.env.example](./env-examples/web.env.example)
- 전체 환경 설정: [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md)

로컬 개발 DB와 시드를 준비합니다.

```bash
npm run db:up
npm run db:migrate
npm run db:seed
```

개발 서버를 실행합니다.

```bash
npm run dev
```

- 웹: `http://localhost:3000`
- API: `http://localhost:4000/api`
- Swagger: `http://localhost:4000/api/docs` (`SWAGGER_ENABLED=true`일 때)

## 검증 명령

```bash
npm run check:quick
npm run test
npm run docs:check
npm run money:check
npm run test:e2e:smoke:build
npm run test:e2e
npm run test:prisma
npm run audit:runtime
npm run build
```

- `npm run check:quick`: 문서 점검, 금액 가드, 린트, 타입 검사를 함께 수행합니다.
- `npm run test`: 웹/서버 기본 테스트를 수행합니다.
- `npm run test:e2e`: 대표 브라우저 흐름을 확인합니다.
- `npm run test:prisma`: 실제 MySQL 경계의 월 운영 흐름을 확인합니다.
- `npm run audit:runtime`: 배포 대상 런타임 의존성의 보안 기준을 확인합니다.

## 데모 계정

로컬 시드 기준 데모 계정은 아래와 같습니다.

- 이메일: `demo@example.com`
- 비밀번호: `Demo1234!`

데모 순서는 [데모 체험 가이드](./docs/DEMO_GUIDE.md)를 기준으로 확인합니다.

## 협업과 문서 기준

- API 요청/응답 형태의 1차 기준은 `packages/contracts`입니다.
- 구현된 서버 기능과 인증 노출 상태는 Swagger 문서와 [API 개요](./docs/API.md)를 함께 봅니다.
- 데이터베이스 변경은 Prisma 마이그레이션으로 남깁니다.
- 웹은 `app -> features -> shared` 경계를 유지합니다.
- 새 기능이나 문서 변경 전후에는 [검증 메모](./docs/VALIDATION_NOTES.md)의 기준을 확인합니다.
- 전체 문서 목록은 [문서 인덱스](./docs/README.md)에서 확인합니다.
