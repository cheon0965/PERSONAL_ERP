# ADR 0001. Workspace Boundaries and Contracts-First Flow

## 상태

승인됨

## 맥락

이 프로젝트는 Web과 API를 동시에 다루며, 화면과 서버 응답 shape가 쉽게 어긋날 수 있습니다.
또한 기능이 늘어나면 공통 코드와 도메인 코드의 경계가 흐려지기 쉽습니다.

## 결정

- Web과 API는 별도 앱으로 유지한다.
- 요청/응답 계약은 `packages/contracts`를 단일 소스로 둔다.
- Web은 `app -> features -> shared` 경계를 유지한다.
- API는 `controller -> service -> repository -> mapper/calculator` 구조를 유지한다.
- demo fallback은 기본적으로 끄고, 로컬 개발에서만 명시적으로 켠다.

## 결과

좋은 점:

- 기능 추가 시 수정 범위가 예측 가능하다.
- 프론트와 백엔드 계약 드리프트를 줄일 수 있다.
- 공통 UI와 도메인 UI를 분리하기 쉽다.

비용:

- 초기 구조 파일 수가 늘어난다.
- 작은 기능도 계약과 문서를 함께 맞춰야 한다.

## 후속 원칙

- 엔드포인트 shape 변경은 contracts와 문서를 같이 수정한다.
- 구조 경계가 바뀌면 새 ADR을 추가한다.
