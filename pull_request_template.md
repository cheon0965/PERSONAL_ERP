## 목적

-

## 변경 범위

-

## 검증

- [ ] `npm run check:quick`
- [ ] `npm run test`
- [ ] 인증/세션, CORS, 보안 헤더를 건드렸다면 `npm run test:security:api`를 확인했습니다.
- [ ] 의존성이나 lockfile을 바꿨다면 `npm run audit:runtime` 또는 CI `audit-runtime` 결과를 확인했습니다.
- [ ] Web 라우트, 인증 복원, Next.js build 경로를 건드렸다면 `npm run test:e2e:smoke:build` 또는 동등한 브라우저 검증을 확인했습니다.
- [ ] 동작 확인 방법, 스크린샷, 또는 요청 예시를 본문에 남겼습니다.
- [ ] 실행하지 못한 검증이 있다면 이유를 아래에 적었습니다.

## 계약, 문서, 운영 체크

- [ ] `packages/contracts` 변경 없음, 또는 요청/응답 변경을 먼저 반영했습니다.
- [ ] API 변경이 있다면 Swagger(`/api/docs`) 노출 상태와 DTO validation 설명을 함께 확인했습니다.
- [ ] Prisma schema 변경 없음, 또는 migration 파일을 함께 포함했습니다.
- [ ] 필요한 문서를 함께 갱신했습니다.
- [ ] 검증 범위가 바뀌었다면 `docs/VALIDATION_NOTES.md`도 함께 갱신했습니다.
- [ ] `.env`, 로그, 개인 설정, 테스트 산출물 같은 업로드 금지 파일이 포함되지 않았습니다.
- [ ] fallback 정책을 바꿨다면 `docs/FALLBACK_POLICY.md`도 같이 수정했습니다.

문서 반영 파일:

- [ ] `README.md`
- [ ] `CONTRIBUTING.md`
- [ ] `ENVIRONMENT_SETUP.md`
- [ ] `docs/OPERATIONS_CHECKLIST.md`
- [ ] `docs/API.md`
- [ ] `docs/ARCHITECTURE.md`
- [ ] `docs/PROJECT_PLAN.md`
- [ ] `docs/VALIDATION_NOTES.md`
- [ ] `PORTFOLIO_ARCHITECTURE_GUIDE.md`
- [ ] 해당 없음

## 위험 및 롤아웃 메모

-

## 추가 메모

-
