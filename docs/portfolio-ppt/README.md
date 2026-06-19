# PERSONAL_ERP 포트폴리오 PPT

이 폴더에는 제출용 포트폴리오 PPT 산출물과 발표 보조 노트를 둡니다.

## 산출물

- `PERSONAL_ERP_Portfolio_Case_Study.pptx`: 제출용 케이스 스터디 PPT입니다.
- `portfolio-ppt-notes.md`: 발표자 스크립트와 면접 Q&A 메모입니다.

PPT 재생성은 로컬 전용 `scripts/generate-portfolio-ppt-com.ps1`와
`scripts/portfolio-ppt-data.json`을 기준으로 합니다.

## 현재 구성

PPT는 33장 압축 제출본 기준입니다.

- 1-11장: 문제 정의, 월 운영 흐름, 핵심 도메인, 정합성 설계
- 12-19장: 아키텍처 판단, 모듈 특성, 의도적으로 하지 않은 것, 제품 표면 지도
- 20-29장: 주요 제품 화면 캡처 영역
- 30-33장: 검증, 배포/운영, 한계, 마무리

아키텍처 구간은 아래 메시지를 중심으로 구성합니다.

- 이 프로젝트는 실무형 modular monolith입니다.
- 구조는 기술 패턴에서 출발한 것이 아니라 월 운영 ERP의 업무 압력에서 출발합니다.
- 돈·전표·마감·권한처럼 실패 비용이 큰 쓰기 흐름은 강하게 구조화했습니다.
- 읽기 조합 영역은 read model/projection 중심으로 유지하고, 기본 CRUD/참조 영역은 단순한 service 중심 구조를 유지합니다.

## 스크린샷 관리 방식

현재 PPT의 화면 구간에는 주요 제품 화면 캡처가 삽입되어 있습니다.
나중에 화면을 다시 찍어 교체할 때는 아래 기준으로 캡처 파일을 준비한 뒤, 기존 이미지 위치와 너비를 유지해 교체합니다.

| 파일명                                | 넣을 화면                                              |
| ------------------------------------- | ------------------------------------------------------ |
| `01-public-home.png`                  | 공개 홈 `/`                                            |
| `03-dashboard.png`                    | 대시보드 `/dashboard`                                  |
| `04-operations.png`                   | 운영 허브 `/operations`                                |
| `05-reference-data.png`               | 기준 데이터 `/reference-data`                          |
| `06-plan-items-recurring.png`         | 계획 항목과 반복 규칙 `/plan-items`, `/recurring`      |
| `08-transactions.png`                 | 수집 거래 `/transactions`                              |
| `09-imports.png`                      | 업로드 `/imports`, `/imports/[batchId]`                |
| `10-journal-entries.png`              | 전표 `/journal-entries`                                |
| `11-periods-financial-statements.png` | 월 마감과 재무제표 `/periods`, `/financial-statements` |
| `13-carry-forwards-forecast.png`      | 차기 이월과 전망 `/carry-forwards`, `/forecast`        |

인증, 운영 자산, 자금수단별 현황, 관리자/설정 화면은 33장 압축본에서는
제품 표면 지도와 발표 노트에서 설명합니다.

## 근거 문서

- `PORTFOLIO_ARCHITECTURE_GUIDE.md`
- `docs/ARCHITECTURE.md`
- `docs/ACCOUNTING_MODEL_BOUNDARY.md`
- `docs/VALIDATION_NOTES.md`
- `docs/PORTFOLIO_PROJECT_BRIEF.md`

모든 문서/텍스트 파일 작업은 UTF-8 인코딩 기준을 유지합니다.
