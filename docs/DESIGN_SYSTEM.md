# 디자인 시스템

## 목표

- 화면이 늘어나도 같은 톤과 밀도로 확장되게 만든다.
- 도메인 기능과 공통 UI를 명확히 분리한다.
- 리스트, 카드, 폼, 차트 패턴을 재사용 가능하게 유지한다.

## 레이아웃 구조

- `shared/layout/app-shell.tsx`
- `shared/layout/sidebar-nav.tsx`
- `shared/layout/topbar.tsx`

대시보드 라우트는 모두 같은 App Shell 안에서 동작합니다.

## 공통 UI 컴포넌트

- `PageHeader`
- `SummaryCard`
- `SectionCard`
- `DataTableCard`
- `ChartCard`
- `StatusChip`
- `QueryErrorAlert`

원칙:

- feature에서 반복되는 조각만 공통화합니다.
- 도메인별 폼이나 컬럼 구성은 feature 안에 둡니다.

## 페이지 조합 패턴

일반적인 대시보드형 화면은 다음 순서를 권장합니다.

1. `PageHeader`
2. KPI 카드 묶음
3. 필터 혹은 설명 카드
4. 표 또는 차트
5. 보조 카드와 폼

## 스타일 원칙

- MUI theme는 `shared/theme`에서 관리합니다.
- 시각 토큰은 `tokens.ts`를 기준으로 유지합니다.
- 공통 컴포넌트는 도메인 용어보다 구조적 역할 이름을 사용합니다.

## 확장 원칙

- 새로운 feature가 기존 컴포넌트를 2곳 이상에서 재사용할 때만 `shared` 승격을 검토합니다.
- 디자인 검증 전용 샘플은 `/design-system` 페이지에서 유지합니다.
