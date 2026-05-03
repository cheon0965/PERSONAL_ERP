# 현재 구현 범위

## 문서 목적

현재 저장소 기준으로 구현된 화면, API 모듈, 운영 지원 기능, 검증/운영 가드를 요약합니다.
세부 계약은 `docs/API.md`, 데모 체험 흐름은 `docs/DEMO_GUIDE.md`, 도메인 정책은 `docs/domain/*` 문서를 우선합니다.

## 한 줄 요약

`인증/설정 -> 관리자/운영 허브 -> 기준 데이터 -> 월 실행 -> 운영 자산 -> 반복 규칙/계획 -> 수집/업로드 -> 전표 -> 월 마감 -> 재무제표 -> 자금수단별 현황 -> 차기 이월 -> 기간 전망`까지 현재 코드베이스 안에서 이어집니다.

## 제품 기능 맵

| 영역        | 현재 구현 범위                                                                                                                                                                                                                                             | 대표 API 모듈                                                                                                |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 인증/설정   | 공개 홍보 메인, 회원가입, 이메일 인증, 인증 메일 재발송, 초대 수락, 로그인, 비밀번호 재설정, refresh/logout, 현재 사용자 조회, 접근 가능 사업장 목록, 세션 단위 사업장 전환, `현재 사업장 / 장부`, 사업장 설정, 계정 보안/프로필/비밀번호/세션/보안 이벤트 | `auth`, `health`                                                                                             |
| 관리자/권한 | 사업장 설정, 멤버 초대/역할/상태 관리, 전체 사용자/사업장 관리, 지원 모드, 보안 위협 로그, 로그관리, 권한 정책 요약                                                                                                                                        | `workspace-settings`, `admin`, `navigation`                                                                  |
| 운영 지원   | 운영 체크리스트, 예외 처리함, 월 마감, 업로드 운영 현황, 시스템 상태, 알림 / 이벤트 센터, UTF-8 CSV 반출, 운영 메모 / 인수인계                                                                                                                             | `operations-console`                                                                                         |
| 기준 데이터 | readiness 요약, 자금수단 관리, 카테고리 관리, 계정과목/거래유형 조회                                                                                                                                                                                       | `reference-data-readiness`, `funding-accounts`, `categories`, `account-subjects`, `ledger-transaction-types` |
| 월 실행     | 운영 기간 open/close/reopen, 수집 거래, 업로드 배치와 일괄 등록 진행률/중단, 전표 조회/조정                                                                                                                                                                | `accounting-periods`, `collected-transactions`, `import-batches`, `journal-entries`                          |
| 계획 자동화 | 반복 규칙, 계획 항목 생성과 추적                                                                                                                                                                                                                           | `recurring-rules`, `plan-items`                                                                              |
| 운영 자산   | 보험 계약, 부채 계약/상환 일정, 차량 기본 정보, 연료 이력, 정비 이력, 차량 운영 요약, 연료/정비 이력의 선택적 수집 거래 연동                                                                                                                               | `insurance-policies`, `liabilities`, `vehicles`                                                              |
| 보고 / 판단 | 대시보드, 재무제표 스냅샷, 자금수단별 현황, 차기 이월, 기간 전망                                                                                                                                                                                           | `dashboard`, `financial-statements`, `funding-account-status`, `carry-forwards`, `forecast`                  |

## Web 화면 그룹

루트 `/`는 비로그인 사용자에게 제품 소개와 회원가입 CTA가 있는 공개 홍보 메인을 보여주고, 이미 인증된 사용자는 `/dashboard`로 이동합니다.

### 인증과 진입

- `/`
- `/register`
- `/verify-email`
- `/accept-invitation`
- `/login`
- `/forgot-password`
- `/reset-password`

### 설정과 관리자

- `/settings`
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
- `/liabilities`
- `/vehicles`
- `/vehicles/fleet`
- `/vehicles/fuel`
- `/vehicles/maintenance`

### 월 실행과 보고 / 판단

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
- `/funding-account-status`
- `/carry-forwards`
- `/carry-forwards/[periodId]`
- `/forecast`

## API 모듈 관점 현재 범위

### 인증과 workspace 관리

- `auth`: register, verify-email, resend-verification, accept-invitation, login, refresh, logout, `auth/me`, 접근 가능 사업장 목록, 세션 단위 사업장 전환, 계정 보안/프로필/비밀번호/세션
- `workspace-settings`: 현재 workspace/ledger 설정 조회와 Owner/Manager 수정
- `admin`: 멤버 초대, 역할/상태 변경, 제거, 전체 사용자/사업장 관리, 지원 문맥 선택, 보안 위협 로그, 운영 상태, 로그관리, 권한 정책 요약
- `navigation`: DB 기반 메뉴 트리와 역할별 노출 제어
- `health`: liveness/readiness

### 기준 데이터와 운영 자산

- `reference-data-readiness`: 기준 데이터 준비 상태 요약
- `funding-accounts`: 생성, 이름 수정, `ACTIVE/INACTIVE/CLOSED` 제한적 lifecycle, 미사용 자금수단 삭제
- `categories`: 수입/지출 카테고리 생성, 수정, 활성/비활성 전환
- `account-subjects`, `ledger-transaction-types`: system-managed lookup 조회
- `insurance-policies`: 보험 계약 생성, 수정, 비활성화, 삭제
- `liabilities`: 부채 계약 생성/수정/보관, 상환 일정 생성/수정, 현재 운영월 계획 항목/수집 거래 생성, 상환 전표 확정 시 원금/이자 분리
- `vehicles`: 차량 기본 정보, 연료 이력, 정비 이력, 운영 요약, 연료/정비 이력 저장 시 선택적 수집 거래 생성/동기화

### 월 운영과 공식 보고

- `accounting-periods`: 최신 진행월 중심 open, close, reopen, 빈 최신 다음 월 롤백 후 이전 잠금월 재오픈, 현재 기간/이력 조회
- `recurring-rules`: 반복 규칙 CRUD
- `plan-items`: 계획 항목 생성과 기간별 추적
- `collected-transactions`: 생성, 상세 조회, 수정, 삭제, 전표 확정
- `import-batches`: UTF-8 텍스트 업로드 파싱, 활성 계좌/카드 연결형 IM뱅크 텍스트 PDF·우리은행/우리카드 저장·암호화 HTML 파일첨부 파싱, 스캔/이미지 PDF 명시 차단, 월별 open/close 정책에 맞춘 최신 진행월 기준 collect preview/단건 collect, 신규 계좌/카드 bootstrap 자동 운영월 생성과 완료 전환, 배치 삭제, 배치 상세 일괄 등록 Job/진행률/중단/행별 결과 조회
- `journal-entries`: 전표 조회, 반전 전표, 정정 전표
- `financial-statements`: 잠금 기간 재무제표 스냅샷 생성/조회
- `funding-account-status`: 자금수단별 수입/지출/이체/잔액 현황, 수집 거래 기준과 확정 전표 기준 비교, 최근 월 추이와 카테고리 breakdown
- `carry-forwards`: closing snapshot 기반 opening balance snapshot 전용 차기 이월 생성/조회
- `dashboard`, `forecast`: 현재 월 운영 요약과 월별 전망

### 운영 지원 표면

- `operations-console`: 운영 허브, 운영 체크리스트, 예외 처리함, 월 마감, 업로드 운영 현황, 시스템 상태, 알림 / 이벤트 센터, UTF-8 CSV 반출, 운영 메모 / 인수인계
- `common/infrastructure/operational`: workspace 감사 이벤트 저장/조회, 주요 운영 이벤트 외부 감사 sink 포트, 운영 지원 공통 기반

## 운영 지원과 검증 가드

- 모든 API 응답에 `x-request-id` 헤더가 포함됩니다.
- 브라우저 API 오류는 사용자용 문구와 개발자 추적 단서를 분리해 다룹니다.
- 개발자 진단 정보는 `errorCode`, HTTP 상태, 요청 메서드/경로, `requestId`, validator 원본 항목, 원본 응답 본문까지 접힌 영역에서 확인할 수 있습니다.
- 표 중심 화면은 공통 `DataTableCard`를 통해 데스크톱에서는 DataGrid, 모바일에서는 카드 목록으로 표시되며 모바일 카드 목록도 5/10/20개 단위 페이지네이션을 제공합니다.
- 주요 업무 화면은 상단 도움말 버튼을 통해 현재 화면에서 확인할 기준, 작업 순서, 이어지는 후속 화면을 안내합니다.
- `GET /api/health/ready`로 DB readiness를 확인합니다.
- 운영 반출은 현재 `UTF-8 CSV` payload를 생성하고 감사 이벤트를 남깁니다.
- `npm run docs:check`는 문서의 `npm run` 표기와 `docs/API.md`, `docs/CURRENT_CAPABILITIES.md`, `docs/OPERATIONS_CHECKLIST.md`, `docs/VALIDATION_NOTES.md`의 Web/API surface를 실제 코드와 대조합니다.
- `npm run check:quick`는 문서 점검, 금액 가드, lint, typecheck를 함께 수행합니다.
- `npm run test:e2e:smoke:build:browser`, `npm run test:e2e`, `npm run test:prisma`가 대표 사용자 흐름과 실DB 경계를 나눠서 검증합니다.
- demo fallback은 기본적으로 꺼져 있으며, 개발 환경에서만 명시적으로 켤 수 있습니다.

## 현재 범위 밖으로 남겨 둔 것

- 자금수단 `type` 변경과 잔액 직접 수정은 현재 범위에 없습니다. 자금수단 삭제는 거래/전표/계획/반복/보험/업로드/이월/차량 기본값 참조가 없는 깨끗한 항목에만 허용합니다.
- 부채 관리는 1차 범위에서 수동 상환 일정과 계획 항목 연결을 지원합니다. 실시간 은행 대출 API 연동, 자동 변동금리 재계산, 외화 차입, 유효이자율 상각표는 아직 범위에 없습니다.
- 차량 연료/정비 이력은 차량 화면에서 삭제할 수 있습니다. 연결 수집거래가 없으면 로그만 삭제하고, 미확정 연결 수집거래가 있으면 같은 작업에서 함께 정리합니다. 이미 전표 확정/정정/잠금된 연결 수집거래가 있으면 차량 이력 수정/삭제는 차단하고, 회계 조정은 기존 전표 반전/정정 흐름으로 처리합니다.
- PM2, NSSM, IIS, systemd 같은 프로세스 관리자 설정은 저장소 안에 포함하지 않습니다.
- 외부 감사 저장소나 중앙 로그 수집기는 아직 연결하지 않았습니다.

## 관련 문서

- [`README.md`](../README.md)
- [`DEMO_GUIDE.md`](./DEMO_GUIDE.md)
- [`API.md`](./API.md)
- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`OPERATIONS_CHECKLIST.md`](./OPERATIONS_CHECKLIST.md)
- [`VALIDATION_NOTES.md`](./VALIDATION_NOTES.md)
