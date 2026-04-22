# 현재 구현 범위

## 문서 목적

이 문서는 현재 저장소 기준으로 실제 구현되어 있는 화면, API 모듈, 운영 지원 기능, 검증/운영 가드를 한 번에 확인하기 위한 요약 문서입니다.
세부 계약은 `docs/API.md`, 화면 흐름은 `docs/SCREEN_FLOW_GUIDE.md`, 도메인 정책은 `docs/domain/*` 문서를 우선합니다.

## 한 줄 요약

`작업 문맥/인증 -> 관리자/운영 지원 -> 기준 데이터 -> 월 운영 -> 보험/차량 운영 -> 반복 규칙/계획 -> 수집/업로드 -> 전표 -> 월 마감 -> 재무제표 -> 차기 이월 -> 기간 전망`까지 현재 코드베이스 안에서 이어집니다.

## 제품 기능 맵

| 영역           | 현재 구현 범위                                                                                                                                           | 대표 API 모듈                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 작업 문맥/인증 | 공개 홍보 메인, 회원가입, 이메일 인증, 인증 메일 재발송, 초대 수락, 로그인, refresh/logout, 현재 사용자 조회, 계정 보안/프로필/비밀번호/세션/보안 이벤트 | `auth`, `health`                                                                                             |
| 관리자/권한    | 사업장 설정, 멤버 초대/역할/상태 관리, 전체 사용자/사업장 관리, 지원 모드, 보안 위협 로그, 감사 로그 조회, 권한 정책 요약                                | `workspace-settings`, `admin`, `navigation`                                                                  |
| 운영 지원      | 체크리스트, 예외 처리함, 월 마감 지원, 업로드 현황, 시스템 상태, 알림 센터, UTF-8 CSV 반출, 운영 메모                                                    | `operations-console`                                                                                         |
| 기준 데이터    | readiness 요약, 자금수단 관리, 카테고리 관리, 계정과목/거래유형 조회                                                                                     | `reference-data-readiness`, `funding-accounts`, `categories`, `account-subjects`, `ledger-transaction-types` |
| 월 실행        | 운영 기간 open/close/reopen, 수집 거래, 업로드 배치와 일괄 등록 진행률, 전표 조회/조정                                                                   | `accounting-periods`, `collected-transactions`, `import-batches`, `journal-entries`                          |
| 계획 자동화    | 반복 규칙, 계획 항목 생성과 추적                                                                                                                         | `recurring-rules`, `plan-items`                                                                              |
| 운영 자산      | 보험 계약, 차량 기본 정보, 연료 이력, 정비 이력, 차량 운영 요약, 연료/정비 이력의 선택적 수집 거래 연동                                                  | `insurance-policies`, `vehicles`                                                                             |
| 보고/판단      | 대시보드, 재무제표 스냅샷, 차기 이월, 기간 전망                                                                                                          | `dashboard`, `financial-statements`, `carry-forwards`, `forecast`                                            |

## Web 화면 그룹

루트 `/`는 비로그인 사용자에게 제품 소개와 회원가입 CTA가 있는 공개 홍보 메인을 보여주고, 이미 인증된 사용자는 `/dashboard`로 이동합니다.

### 인증과 진입

- `/`
- `/register`
- `/verify-email`
- `/accept-invitation`
- `/login`

### 작업 문맥과 관리자

- `/settings/workspace`
- `/settings/account`
- `/settings/account/profile`
- `/settings/account/password`
- `/settings/account/sessions`
- `/settings/account/events`
- `/admin`
- `/admin/users`
- `/admin/tenants`
- `/admin/support-context`
- `/admin/security-threats`
- `/admin/operations`
- `/admin/members`
- `/admin/navigation`
- `/admin/logs`
- `/admin/policy`

### 운영 지원

- `/operations`
- `/operations/checklist`
- `/operations/exceptions`
- `/operations/month-end`
- `/operations/imports`
- `/operations/status`
- `/operations/alerts`
- `/operations/exports`
- `/operations/notes`

### 기준 데이터와 운영 자산

- `/reference-data`
- `/reference-data/manage`
- `/reference-data/funding-accounts`
- `/reference-data/categories`
- `/reference-data/lookups`
- `/insurances`
- `/vehicles`
- `/vehicles/fleet`
- `/vehicles/fuel`
- `/vehicles/maintenance`

### 월 실행과 보고

- `/dashboard`
- `/periods`
- `/periods/open`
- `/periods/close`
- `/periods/history`
- `/recurring`
- `/plan-items`
- `/plan-items/generate`
- `/imports`
- `/imports/[batchId]`
- `/transactions`
- `/journal-entries`
- `/journal-entries/[entryId]`
- `/financial-statements`
- `/financial-statements/[periodId]`
- `/carry-forwards`
- `/carry-forwards/[periodId]`
- `/forecast`

## API 모듈 관점 현재 범위

### 인증과 workspace 관리

- `auth`: register, verify-email, resend-verification, accept-invitation, login, refresh, logout, `auth/me`, 계정 보안/프로필/비밀번호/세션
- `workspace-settings`: 현재 workspace/ledger 설정 조회와 Owner/Manager 수정
- `admin`: 멤버 초대, 역할/상태 변경, 제거, 전체 사용자/사업장 관리, 지원 문맥 선택, 보안 위협 로그, 운영 상태, 감사 로그, 권한 정책
- `navigation`: DB 기반 메뉴 트리와 역할별 노출 제어
- `health`: liveness/readiness

### 기준 데이터와 운영 자산

- `reference-data-readiness`: 기준 데이터 준비 상태 요약
- `funding-accounts`: 생성, 이름 수정, `ACTIVE/INACTIVE/CLOSED` 제한적 lifecycle
- `categories`: 수입/지출 카테고리 생성, 수정, 활성/비활성 전환
- `account-subjects`, `ledger-transaction-types`: system-managed lookup 조회
- `insurance-policies`: 보험 계약 생성, 수정, 비활성화, 삭제
- `vehicles`: 차량 기본 정보, 연료 이력, 정비 이력, 운영 요약, 연료/정비 이력 저장 시 선택적 수집 거래 생성/동기화

### 월 운영과 공식 보고

- `accounting-periods`: 최신 진행월 중심 open, close, reopen, 현재 기간/이력 조회
- `recurring-rules`: 반복 규칙 CRUD
- `plan-items`: 계획 항목 생성과 기간별 추적
- `collected-transactions`: 생성, 상세 조회, 수정, 삭제, 전표 확정
- `import-batches`: UTF-8 텍스트 업로드 파싱, 활성 계좌/카드 연결형 IM뱅크 텍스트 PDF 파일첨부 파싱, 스캔/이미지 PDF 명시 차단, 최신 진행월 기준 collect preview/단건 collect, 배치 삭제, 배치 상세 일괄 등록 Job/진행률/행별 결과 조회
- `journal-entries`: 전표 조회, 반전 전표, 정정 전표
- `financial-statements`: 잠금 기간 재무제표 스냅샷 생성/조회
- `carry-forwards`: closing snapshot 기반 opening balance snapshot 전용 차기 이월 생성/조회
- `dashboard`, `forecast`: 현재 월 운영 요약과 월별 전망

### 운영 지원 표면

- `operations-console`: 운영 허브, 체크리스트, 예외 처리함, 월 마감 지원, 업로드 현황, 시스템 상태, 알림, UTF-8 CSV 반출, 운영 메모
- `common/infrastructure/operational`: workspace 감사 이벤트 저장/조회, 주요 운영 이벤트 외부 감사 sink 포트, 운영 지원 공통 기반

## 운영 지원과 검증 가드

- 모든 API 응답에 `x-request-id` 헤더가 포함됩니다.
- `GET /api/health/ready`로 DB readiness를 확인합니다.
- 운영 반출은 현재 `UTF-8 CSV` payload를 생성하고 감사 이벤트를 남깁니다.
- `npm run docs:check`는 문서의 `npm run` 표기와 `docs/API.md`, `docs/CURRENT_CAPABILITIES.md`, `docs/OPERATIONS_CHECKLIST.md`, `docs/VALIDATION_NOTES.md`의 Web/API surface를 실제 코드와 대조합니다.
- `npm run check:quick`는 문서 점검, 금액 가드, lint, typecheck를 함께 수행합니다.
- `npm run test:e2e:smoke:build`, `npm run test:e2e`, `npm run test:prisma`가 대표 사용자 흐름과 실DB 경계를 나눠서 검증합니다.
- demo fallback은 기본적으로 꺼져 있으며, 개발 환경에서만 명시적으로 켤 수 있습니다.

## 현재 범위 밖으로 남겨 둔 것

- 자금수단 `type` 변경, 잔액 직접 수정, 하드 삭제는 현재 범위에 없습니다.
- 차량 연료/정비 이력은 차량 화면에서 삭제할 수 있습니다. 연결 수집거래가 없으면 로그만 삭제하고, 미확정 연결 수집거래가 있으면 같은 작업에서 함께 정리합니다. 이미 전표 확정/정정/잠금된 연결 수집거래가 있으면 차량 이력 수정/삭제는 차단하고, 회계 조정은 기존 전표 반전/정정 흐름으로 처리합니다.
- PM2, NSSM, IIS, systemd 같은 프로세스 관리자 설정은 저장소 안에 포함하지 않습니다.
- 외부 감사 저장소나 중앙 로그 수집기는 아직 연결하지 않았습니다.

## 관련 문서

- [`README.md`](../README.md)
- [`SCREEN_FLOW_GUIDE.md`](./SCREEN_FLOW_GUIDE.md)
- [`API.md`](./API.md)
- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`OPERATIONS_CHECKLIST.md`](./OPERATIONS_CHECKLIST.md)
- [`VALIDATION_NOTES.md`](./VALIDATION_NOTES.md)
