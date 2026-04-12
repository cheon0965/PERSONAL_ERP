# Refactoring Roadmap

모든 파일 조회, 추가, 수정, 삭제는 UTF-8 인코딩 기준으로 진행한다.

## Phase 1 - Web E2E test split

Status: completed.

- Split the oversized `apps/web/e2e/auth-and-transactions.spec.ts` by feature flow.
- Keep common Playwright assertions, API route pattern, and shared E2E builders in support files.
- Update smoke scripts so they keep running the split auth-and-transactions smoke group.

## Phase 2 - API request test mock/state split

Status: completed.

- Split large request API Prisma mock files by domain responsibility.
- Move bulky request test state/type fixtures into focused domain fixture files.
- Keep `request-api.test-prisma-mock.ts` as a small composition entrypoint.

## Phase 3 - Service and UI large file split

Status: completed.

- Split `imported-row-collection.service.ts` into orchestration plus a focused repository collaborator.
- Split accounting period page lifecycle operations and shared helpers into focused UI/helper files.
- Split plan item table columns and execution-link cell rendering out of `plan-items-page.tsx`.
- Split vehicle table/action columns out of `vehicles-page.tsx`.

## Follow-up watchlist

Status: backlog.

- Keep watching large form files such as `insurance-policy-form.tsx`, `recurring-rule-form.tsx`, and vehicle sub-forms.
- Split them next when a behavior change touches validation, conditional fields, or repeated form sections.
