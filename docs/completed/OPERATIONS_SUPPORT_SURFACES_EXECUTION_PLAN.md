# Operations Support Surfaces Execution Plan

## 목적

이 문서는 현재 `PERSONAL_ERP`가 이미 갖춘 월 운영 회계 사이클 화면 위에,
실운영 안정성과 운영자 작업 효율을 높이기 위한 `운영 보조 화면` 구현 순서를 고정합니다.

이번 계획의 목표는 세 가지입니다.

- 이미 구현된 메인 회계 흐름을 흔들지 않고 운영 보조 화면을 얹는다.
- 화면별 의존성을 먼저 정리해 중복 read model과 중복 API를 만들지 않는다.
- `코드 + 테스트 + 문서`가 함께 따라오는 순서로 구현해 이후 운영 문서와 화면이 드리프트되지 않게 한다.

## 현재 기준선

현재 저장소는 아래 메인 화면과 흐름을 이미 제공합니다.

- 작업 문맥
- 관리자(홈/회원관리/로그관리)
- 기준 데이터
- 월 운영
- 보험 계약
- 차량 운영
- 반복 규칙
- 계획 항목
- 업로드 배치
- 수집 거래
- 전표 조회
- 재무제표
- 차기 이월
- 기간 전망
- 대시보드

즉, 추가 대상은 `회계 본류를 새로 만드는 화면`이 아니라
`운영 리스크를 줄이는 설정/관측/예외/인수인계 화면`입니다.

## 목표 범위

이번 실행계획에 포함하는 추가 화면은 아래 12개입니다.

1. 사업장 설정
2. 내 계정 / 보안
3. 권한 정책 요약
4. 운영 체크리스트
5. 예외 처리함
6. 월 마감 대시보드
7. 업로드 운영 현황
8. 시스템 상태 / 헬스
9. 감사 로그 고도화
10. 알림 / 이벤트 센터
11. 백업 / 내보내기
12. 운영 메모 / 인수인계

## 구현 진행 현황

- Phase 1: 완료. 사업장 설정, 내 계정 / 보안, 권한 정책 요약을 `settings`와 `admin` 영역에 연결했습니다.
- Phase 2: 완료. 운영 허브, 체크리스트, 예외 처리함, 월 마감 대시보드, 업로드 운영 현황을 `operations-console` read model로 연결했습니다.
- Phase 3: 완료. 시스템 상태 / 헬스, 감사 로그 필터 고도화, 알림 / 이벤트 센터를 추가했습니다.
- Phase 4: 완료. `/operations/exports` 수동 UTF-8 CSV 반출과 `/operations/notes` 운영 메모 / 인수인계 화면을 추가하고, 반출/메모 생성 감사 로그를 남기도록 구현했습니다.

## 고정 원칙

- 파일 열람, 생성, 수정, 저장은 모두 `UTF-8` 기준으로 처리한다.
- 모든 화면은 `platform admin`이 아니라 `currentWorkspace` 기준 `workspace-scoped` 운영 화면으로 설계한다.
- Web/API가 공유하는 요청/응답 shape는 항상 `packages/contracts`를 먼저 갱신한다.
- 기존 메인 회계 흐름인 `reference-data -> periods -> insurances/vehicles -> recurring -> plan-items -> imports/transactions -> journal-entries -> financial-statements -> carry-forwards -> forecast`는 유지하고, 운영 보조 화면은 이를 보완하는 read model로 둔다.
- 새 화면을 위해 상위 네비게이션을 무한정 늘리지 않는다. `settings`, `admin`, `operations` 세 축으로 묶는다.
- 커스텀 Role Builder, 플랫폼급 멀티테넌시 운영 UI, 별도 메시지 브로커, 중앙 SIEM, 장기 보관용 백업 오케스트레이터는 이번 범위에 넣지 않는다.
- 감사/알림/상태 화면은 민감정보 원문, 토큰 원문, 비밀번호, 전체 요청/응답 body dump를 저장하거나 노출하지 않는다.
- 각 단계는 최소 `요청 단위 API 테스트`, `Web API 테스트`, `문서 동기화` 중 두 가지 이상을 반드시 남긴다.

## 권장 정보 구조와 라우트 배치

운영 보조 화면은 기존 메뉴를 과도하게 늘리지 않기 위해 아래 구조로 배치합니다.

### Settings 영역

- `/settings`
  기존 `작업 문맥` 홈 유지
- `/settings/workspace`
  사업장 설정
- `/settings/account`
  내 계정 / 보안

### Admin 영역

- `/admin`
  기존 관리자 홈 유지
- `/admin/members`
  기존 회원관리 유지
- `/admin/logs`
  기존 로그관리 유지
- `/admin/policy`
  권한 정책 요약

### Operations 영역

- `/operations`
  운영 지원 허브 홈
- `/operations/checklist`
  운영 체크리스트
- `/operations/exceptions`
  예외 처리함
- `/operations/month-end`
  월 마감 대시보드
- `/operations/imports`
  업로드 운영 현황
- `/operations/status`
  시스템 상태 / 헬스
- `/operations/alerts`
  알림 / 이벤트 센터
- `/operations/exports`
  백업 / 내보내기
- `/operations/notes`
  운영 메모 / 인수인계

## 화면별 권장 순서

| 순서 | 화면                 | 권장 라우트              | 이유                                                                            | 선행 의존성                                    |
| ---- | -------------------- | ------------------------ | ------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1    | 사업장 설정          | `/settings/workspace`    | 현재 문맥 조회를 실제 운영 설정으로 확장하는 가장 자연스러운 첫 단계            | 기존 `settings`, `auth/me`, tenant/ledger 조회 |
| 2    | 내 계정 / 보안       | `/settings/account`      | 운영자가 자기 세션과 비밀번호를 관리할 수 있어야 이후 운영 화면 신뢰도가 높아짐 | `AuthSession`, auth API                        |
| 3    | 권한 정책 요약       | `/admin/policy`          | 이후 모든 화면의 권한 문구와 CTA 숨김 정책 기준점이 됨                          | 현재 role policy, admin 영역                   |
| 4    | 운영 체크리스트      | `/operations/checklist`  | 기존 화면들을 운영 순서에 맞게 묶는 빠른 진입점                                 | 메인 화면 라우트, readiness/read model         |
| 5    | 예외 처리함          | `/operations/exceptions` | 실제 운영에서 가장 자주 보는 액션 허브이며 이후 대시보드의 공통 요약 소스가 됨  | 체크리스트, 예외 집계 read model               |
| 6    | 월 마감 대시보드     | `/operations/month-end`  | 예외 집계와 기간 상태를 시각적으로 요약하는 월말 허브                           | 예외 집계, periods, transactions, reports      |
| 7    | 업로드 운영 현황     | `/operations/imports`    | 업로드 배치의 병목과 실패를 별도 운영 관점으로 관리                             | imports summary read model                     |
| 8    | 시스템 상태 / 헬스   | `/operations/status`     | 운영자가 장애 원인을 분리해 보는 내부 관측 화면                                 | health/ready, request-id, env readiness        |
| 9    | 감사 로그 고도화     | `/admin/logs` 확장       | 알림과 운영 점검의 근거 데이터를 더 잘 읽게 하는 단계                           | 기존 admin audit events                        |
| 10   | 알림 / 이벤트 센터   | `/operations/alerts`     | 상태/감사/예외 소스를 한곳에 모으는 운영 이벤트 허브                            | status, audit, exception sources               |
| 11   | 백업 / 내보내기      | `/operations/exports`    | 운영 반출/백업 정책은 범위와 권한이 안정된 뒤 고정하는 편이 안전함              | export scope, audit policy                     |
| 12   | 운영 메모 / 인수인계 | `/operations/notes`      | 최종 운영 루프가 정리된 뒤 메모 구조를 얹어야 재작업이 적음                     | operations hub, auth/admin actors              |

## 공통 선행 작업

모든 화면 구현 전에 아래 공통 기반을 먼저 정리합니다.

### 1. 계약 계층 추가

수정/추가 후보:

- `packages/contracts/src/settings.ts`
- `packages/contracts/src/operations.ts`
- `packages/contracts/src/auth.ts`
- `packages/contracts/src/admin.ts`
- `packages/contracts/src/index.ts`

추가 후보 contract:

- `WorkspaceSettingsItem`
- `UpdateWorkspaceSettingsRequest`
- `AccountSecuritySummary`
- `ChangePasswordRequest`
- `AuthSessionItem`
- `AdminPolicyMatrixItem`
- `OperationsChecklistResponse`
- `OperationsExceptionItem`
- `OperationsMonthEndSummary`
- `OperationsImportStatusSummary`
- `SystemStatusSummary`
- `OperationalAlertItem`
- `ExportJobItem`
- `CreateOperationalNoteRequest`
- `OperationalNoteItem`

완료 기준:

- 각 화면이 계약 없이 임시 shape로 움직이지 않는다.
- 기존 `auth`, `admin`, `imports`, `accounting`, `transactions` 계약과 충돌하지 않는다.

### 2. 공통 네비게이션과 섹션 프레임

수정/추가 후보:

- `apps/web/src/shared/config/navigation.ts`
- `apps/web/src/shared/layout/sidebar-nav.tsx`
- `apps/web/src/features/settings/*`
- `apps/web/src/features/operations/*`
- `apps/web/src/features/admin/admin-section-nav.tsx`

원칙:

- `settings`는 개인/사업장 문맥 관리
- `admin`은 멤버/권한/감사
- `operations`는 일일 운영과 관측

완료 기준:

- 운영 보조 화면이 기존 메인 회계 메뉴와 섞이지 않고 목적별로 구획된다.
- 모바일/데스크톱에서 상위 메뉴 길이가 과도하게 늘어나지 않는다.

### 3. 공통 운영 요약 read model

추가 후보:

- `apps/api/src/modules/operations-console/*`
- `apps/web/src/features/operations/operations.api.ts`

역할:

- 체크리스트, 예외 처리함, 월 마감 대시보드, 업로드 운영 현황이 중복 계산 없이 같은 요약 소스를 사용하게 한다.

초기 집계 항목 후보:

- 현재 열린 기간 여부
- readiness 부족 항목 수
- 미확정 수집 거래 수
- 업로드 미수집 행 수
- 마감 차단 사유 수
- 최근 감사 경고 수

완료 기준:

- 예외와 체크리스트가 서로 다른 숫자를 보여주지 않는다.
- 화면별로 비슷한 API를 여러 개 만들지 않는다.

## 단계별 실행계획

### Phase 0. 기준선 고정

목적:
운영 보조 화면이 기존 회계 흐름을 대체하지 않고 보완하도록 경계를 먼저 잠급니다.

해야 할 일:

- `docs/DEMO_GUIDE.md`와 현재 사이드바 구조를 기준으로 메인 흐름을 다시 확인한다.
- 운영 보조 화면을 `settings`, `admin`, `operations` 세 그룹으로 고정한다.
- 공통 contract와 route naming을 먼저 확정한다.
- `docs/API.md`, `docs/VALIDATION_NOTES.md`에 이후 추가될 surface 범주를 반영할 준비를 한다.

완료 기준:

- 새 화면의 라우트 위치와 책임이 중복되지 않는다.
- 이후 단계에서 `설정 화면인데 운영 허브처럼 커지는` 드리프트가 발생하지 않는다.

### Phase 1. 설정과 권한 기반 확장

대상 화면:

- 사업장 설정
- 내 계정 / 보안
- 권한 정책 요약

#### 1-1. 사업장 설정

범위:

- 사업장명, 슬러그, 상태, 기본 장부명, 기준 통화, 시간대 조회
- Owner/Manager 한정 수정 정책
- 변경 이력은 감사 로그에 남김

수정/추가 후보:

- Web: `apps/web/app/(app)/(dashboard)/settings/workspace/page.tsx`
- API: `apps/api/src/modules/workspace-settings/*`
- Contracts: `packages/contracts/src/settings.ts`

주의:

- 현재 `작업 문맥` 화면은 read-only 홈으로 유지하고, 실제 수정은 별도 `workspace` 하위 화면으로 분리한다.
- 멀티 ledger 확장 전까지는 현재 기본 ledger 1개 전제를 깨지 않는다.

#### 1-2. 내 계정 / 보안

범위:

- 이름/이메일 표시
- 비밀번호 변경
- 현재 활성 세션 목록 조회
- 다른 세션 강제 종료
- 최근 로그인/보안 이벤트 요약

수정/추가 후보:

- Web: `apps/web/app/(app)/(dashboard)/settings/account/page.tsx`
- API: `apps/api/src/modules/auth/*`
- Contracts: `packages/contracts/src/auth.ts`, `packages/contracts/src/settings.ts`

주의:

- 비밀번호 재설정 메일 플로우까지 한 번에 넓히지 않는다.
- 이번 단계는 `로그인된 사용자의 자기 계정 관리`에 한정한다.

#### 1-3. 권한 정책 요약

범위:

- OWNER / MANAGER / EDITOR / VIEWER가 볼 수 있는 화면/행동 요약
- 관리자, 설정, 운영 허브 각 섹션의 CTA 노출 기준 정리

수정/추가 후보:

- Web: `apps/web/app/(app)/(dashboard)/admin/policy/page.tsx`
- API: `apps/api/src/modules/admin/*` 또는 static contract 기반 read endpoint
- Contracts: `packages/contracts/src/admin.ts`

완료 기준:

- 화면별 권한 설명 문구가 문서/코드/화면에서 같은 기준을 쓴다.
- Owner/Manager 전용 화면에서 숨김/비활성/권한 경고 정책이 일관된다.

### Phase 2. 운영 허브 1차 구축

대상 화면:

- 운영 체크리스트
- 예외 처리함
- 월 마감 대시보드
- 업로드 운영 현황

#### 2-1. 운영 체크리스트

범위:

- 월 시작 전
- 일일 점검
- 월 마감 전
- 배포/운영 점검

초기 구현 방향:

- 기존 문서와 화면 링크를 조합한 `actionable checklist`
- 각 항목에 현재 상태, 이동 CTA, 차단 사유 요약 표시

#### 2-2. 예외 처리함

범위:

- 미확정 수집 거래
- 업로드 미수집 행
- 기준 데이터 readiness 부족
- 마감 차단 사유
- 최근 실패한 운영 이벤트

초기 구현 방향:

- 예외를 한 곳에 모아 `바로 처리할 작업` 중심으로 정렬
- 세부 해결은 기존 화면으로 deep link

#### 2-3. 월 마감 대시보드

범위:

- 현재 월 상태
- 미확정 수, 남은 계획 지출, 마감 가능 여부
- 재무제표/차기 이월 생성 상태

초기 구현 방향:

- read-only summary로 시작
- 마감 실행 버튼은 기존 `periods`, `financial-statements`, `carry-forwards` 화면으로 연결

#### 2-4. 업로드 운영 현황

범위:

- 최근 업로드 배치
- 실패/대기/중복 행 수
- 수집 승격률
- 배치별 상세 화면 이동

공통 API 후보:

- `GET /operations/checklist`
- `GET /operations/exceptions`
- `GET /operations/month-end`
- `GET /operations/import-status`

완료 기준:

- 운영자는 `operations` 영역만 봐도 당장 처리할 작업과 월말 위험을 파악할 수 있다.
- 동일한 숫자가 `dashboard`, `forecast`, `operations`에서 상충하지 않는다.

### Phase 3. 관측성과 감사 강화

대상 화면:

- 시스템 상태 / 헬스
- 감사 로그 고도화
- 알림 / 이벤트 센터

#### 3-1. 시스템 상태 / 헬스

범위:

- API health / ready
- DB readiness
- 최근 배포 버전 또는 build 식별자
- 최근 주요 작업 성공 시각
- 메일 발송 경계 상태 요약

구현 원칙:

- 초기에는 existing health/readiness와 운영 요약을 조합한 내부 read 화면으로 시작
- 인프라 관측 도구 대체품으로 과대 설계하지 않는다

#### 3-2. 감사 로그 고도화

범위:

- event category 필터
- actor, result, resource 기준 필터 확장
- 보안/권한/운영 이벤트 묶음 보기
- requestId 중심 상세 흐름 읽기

구현 원칙:

- 기존 `/admin/logs`를 확장한다.
- 로그 다운로드, 장기 보관, 물리 삭제 UI는 제외한다.

#### 3-3. 알림 / 이벤트 센터

범위:

- 최근 실패 이벤트
- 마감 차단 경고
- 업로드 오류
- 보안/권한 경고
- 해결 화면으로 이동하는 CTA

구현 원칙:

- 1차는 `derived alerts`로 시작한다.
- 별도 큐/푸시/실시간 브로커는 도입하지 않는다.
- 알림 읽음/확인 처리도 1차에서는 단순 상태 또는 미구현으로 둔다.

공통 API 후보:

- `GET /operations/system-status`
- `GET /operations/alerts`
- `GET /admin/audit-events` 확장

완료 기준:

- 운영자는 장애/경고/보안 흔적을 문서가 아니라 화면에서 먼저 볼 수 있다.
- 알림과 감사 로그가 서로 링크 가능한 구조를 가진다.

### Phase 4. 반출과 인수인계 마무리

대상 화면:

- 백업 / 내보내기
- 운영 메모 / 인수인계

#### 4-1. 백업 / 내보내기

범위:

- 기준 데이터 내보내기
- 수집 거래/전표/재무제표 CSV 내보내기
- 마지막 내보내기 시각과 범위 표시
- 내보내기 실행 감사 로그 남기기

구현 원칙:

- 1차는 `수동 on-demand export`로 시작한다.
- 실제 DB snapshot 오케스트레이션이나 스케줄 백업 UI는 넣지 않는다.
- 권한은 Owner 우선, 필요 시 Manager 제한 허용 정책을 별도 문서화한다.

#### 4-2. 운영 메모 / 인수인계

범위:

- 날짜/작성자/업무 유형/본문 기반 메모
- 월 마감 메모
- 특이사항/보정 사유/후속 작업 메모
- 예외 처리함 또는 알림과 연결 가능한 참조 링크

추가 모델 후보:

- `WorkspaceOperationalNote`

구현 원칙:

- 1차는 텍스트 메모 중심
- 첨부파일, 멘션, 워크플로 승인, 댓글 스레드는 제외

완료 기준:

- 반출 이력과 운영 메모가 남아 인수인계 문맥이 화면 안에서 이어진다.
- 민감정보와 시크릿을 메모에 저장하지 않는 정책이 문서와 UI에 반영된다.

## 추천 모듈 배치

API 후보:

- `apps/api/src/modules/workspace-settings/*`
- `apps/api/src/modules/operations-console/*`
- `apps/api/src/modules/exports/*`
- `apps/api/src/modules/operational-notes/*`
- 기존 `auth`, `admin`, `health` 모듈 확장

Web 후보:

- `apps/web/src/features/settings/*`
- `apps/web/src/features/operations/*`
- 기존 `auth`, `admin`, `imports`, `dashboard` feature 확장

이 배치는 아래 원칙을 따릅니다.

- 개인 계정 보안은 `auth`
- 멤버/권한/감사는 `admin`
- 사업장 메타 정보는 `workspace-settings`
- 운영 요약/예외/상태/알림은 `operations-console`
- 내보내기와 메모는 별도 운영 보조 모듈

## 공통 검증 기준

각 단계마다 아래 검증을 최소 기준으로 둡니다.

### API

- current workspace 범위 검증
- role 기반 접근 통제
- 민감정보 미노출 검증
- 감사 로그 기록 검증

### Web

- 보호 라우트 접근 제어
- 빈 상태/권한 경고/에러 안내
- 주요 CTA deep link
- 긴 `requestId`, slug, resource id가 화면을 깨지지 않는지 확인

### 문서

- `docs/API.md`
- `docs/DEMO_GUIDE.md`
- `docs/OPERATIONS_CHECKLIST.md`
- `docs/ERROR_HANDLING_AND_LOGGING.md`
- `docs/VALIDATION_NOTES.md`
- 필요 시 `README.md`

완료 기준:

- 새 화면이 추가되면 API/화면/검증 문서가 함께 움직인다.
- 운영자가 문서와 실제 UI 사이에서 다른 기준을 보지 않는다.

## 구현 순서를 재배치하지 않는 이유

- 사업장 설정과 내 계정/보안이 먼저 있어야 이후 운영 화면의 소유자, 세션, 문맥이 흔들리지 않습니다.
- 권한 정책 요약이 먼저 있어야 체크리스트, 예외 처리함, 알림 센터의 CTA 노출 기준이 일관됩니다.
- 예외 처리함과 월 마감 대시보드는 공통 운영 요약 read model을 공유하므로 함께 묶어야 중복 계산을 줄일 수 있습니다.
- 시스템 상태와 감사 로그 고도화가 먼저 있어야 알림 센터가 단순 문구 모음이 아니라 근거가 있는 운영 화면이 됩니다.
- 백업/내보내기와 운영 메모는 앞선 운영 흐름이 안정된 뒤 넣어야 권한과 데이터 범위를 다시 고치지 않습니다.

## 최종 완료 판정

아래 상태가 되면 운영 보조 화면 1차 체계가 닫힌 것으로 봅니다.

- `settings`, `admin`, `operations` 세 영역이 역할별로 분리되어 있다.
- 운영자는 운영 체크리스트, 예외 처리함, 월 마감 대시보드만으로 당장 해야 할 일을 파악할 수 있다.
- 사업장 설정, 내 계정/보안, 권한 정책 요약으로 운영 문맥과 책임이 명확해진다.
- 시스템 상태, 감사 로그, 알림 센터가 같은 requestId/이벤트 기준으로 추적 가능하다.
- 내보내기와 운영 메모로 반출과 인수인계가 화면 안에서 이어진다.
- 모든 관련 surface가 `contracts -> API -> Web -> tests -> docs` 순서를 유지한다.
