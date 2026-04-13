# 프로젝트 계획

## 목적

이 프로젝트의 목적은 1인 사업자와 소상공인의 사업 재무 운영 데이터를 단순 입출금 기록이 아니라 월별 운영 사이클 관점에서 다루는 것입니다.
핵심은 소상공인용 일반 ERP 전반을 넓게 덮는 것이 아니라, 실제 거래, 반복규칙, 업로드 배치, 월 운영, 공식 보고까지 한 구조 안에서 월별 재무운영 사이클을 끝까지 닫는 것입니다.

## 완료한 기반 단계

1. 툴링과 CI 정리
2. 인증과 사용자 경계 정리
3. 공용 계약 계층 도입
4. 앱 단위 env 구조 정리
5. migration-first DB 흐름 정리
6. API 레이어 분리
7. 프론트 feature 구조 전환
8. fallback 정책 명시화
9. 최소 테스트 매트릭스 도입
10. 요청 단위 API 검증 보강
11. Web 인증 세션과 토큰 주입 연결
12. 거래/반복규칙 실제 mutation 연결
13. 월 운영, 전표, 공식 보고 backbone 구현
14. 업로드 배치와 수집 승격 흐름 구현
15. 배포/운영 체크리스트 문서화
16. 메인 비즈니스 흐름 가시성, 준비 경로, 추적성 보강
17. 기준 데이터 readiness와 자금수단/카테고리 제한적 관리 구현
18. build 결과물 기준 smoke와 운영 체크리스트 일부 자동화
19. 금액 정합성 기준 고정
    `packages/money`의 `MoneyWon` 공용 모듈, Prisma 금액 컬럼 `Decimal(19,0)` 승격, `decimal.js` 기반 `HALF_UP`/배분 잔차 보정, `npm run money:check` 가드까지 완료
20. 회원가입 및 Gmail API 이메일 인증 도입
    회원가입/이메일 인증/재발송 API, Gmail API/console mail sender 경계, 이메일 인증 후 workspace bootstrap, Web `/register`/`/verify-email`, 테스트/문서 동기화까지 완료.
    실행 계획은 [`completed/AUTH_REGISTRATION_GMAIL_PLAN.md`](./completed/AUTH_REGISTRATION_GMAIL_PLAN.md)에 보관합니다.

## 현재 MVP 범위

- 로그인
- 작업 문맥/설정 조회
- 기준 데이터 readiness 조회와 자금수단/카테고리 제한적 관리
- 운영 기간 조회/open/close/reopen
- 수집 거래 조회/생성/수정/삭제/확정
- 업로드 배치 조회/생성/행 collect preview/행 collect
- 반복규칙 조회/생성/수정/삭제
- 계획 항목 조회/생성(generate)과 수집 거래/전표 추적
- 전표 조회/reverse/correct
- 재무제표 조회/generate
- 차기 이월 조회/generate
- 보험 조회/생성/수정
- 차량 조회/생성/수정
- 대시보드 요약
- 기간 운영 전망(현재 월/다음 달 예측)
- 디자인 시스템 공통 컴포넌트와 대시보드형 화면 패턴

## 문서 역할 경계

- 프로젝트 목적, 판단 원칙, 현재 아키텍처 설명과 완료된 MSA-ready 경계 정리는 `PORTFOLIO_ARCHITECTURE_GUIDE.md`
- 이 문서는 “이미 끝난 일의 작업 로그”가 아니라 앞으로의 중기 제품 로드맵만 유지합니다.

## 다음 중기 우선순위

1. 운영 HTTPS/HSTS/Swagger 배포 리허설과 보안 증적 정리
2. Gmail API 운영 secret 등록과 실제 수신 확인
3. Docker 기반 로컬 CI 재현성 보강
4. `PRISMA_INTEGRATION_DATABASE_URL` GitHub secret 등록과 첫 `prisma-integration` 통과 증적 확보

## 범위 밖 항목

현재 MVP 범위에는 아래 항목을 포함하지 않습니다.

- 외부 금융기관 자동 연동
- AI 기반 재무 조언
- OCR 영수증 처리
- 복합 승인 체계가 있는 고급 회계 마감 프로세스
- 운영용 멀티테넌시 관리 UI
