# 업로드 배치 다월 거래 등록 실행계획

## 1. 목표

- 업로드 배치의 거래 등록이 현재 운영월에만 묶이지 않도록 개선한다.
- 거래일 기준 운영월이 없으면 등록 과정에서 필요한 운영월을 자동으로 준비한다.
- 잠금된 마감월 데이터는 저장하지 않고, 사용자에게 저장 불가 사유를 명확히 안내한다.
- 이미 등록된 거래와 `거래일 + 금액 + 입출금유형`이 같은 경우 별도 확인 후 등록하도록 강제한다.

## 2. 적용 범위

- API
  - 업로드 행 `collect-preview`
  - 업로드 행 `collect`
  - 업로드 행 일괄 `collect`
- Web
  - 업로드 배치 작업대
  - 업로드 행 등록 다이얼로그
  - 업로드 행 일괄 등록 버튼/안내
- 계약/테스트
  - imports contract
  - request-api 테스트
  - web typecheck/lint

## 3. 구현 순서

1. 업로드 행 거래일 기준으로 대상 운영월을 직접 해석한다.
2. 대상 운영월이 없으면 등록 트랜잭션 안에서 운영월과 상태 이력을 자동 생성한다.
3. 대상 운영월이 `LOCKED`이면 저장을 차단하고 마감월 안내 문구를 반환한다.
4. 기존 `sourceFingerprint` 중복 판단은 그대로 유지한다.
5. 추가로 `거래일 + 금액 + 입출금유형` 기준 잠재 중복 건수를 계산한다.
6. 잠재 중복이 있으면 preview에 경고를 노출하고, 확인 플래그 없이는 collect를 `409 Conflict`로 차단한다.
7. Web에서는 현재 운영월 필터를 제거하고:
   - 단건 등록은 잠재 중복 시 사용자 확인 후 `confirmPotentialDuplicate=true`로 재요청한다.
   - 일괄 등록은 모든 등록 가능 행을 대상으로 처리하되, 중복 후보 행은 실패 메시지로 남긴다.
8. 테스트를 추가/수정해 월 자동 생성, 마감월 차단, 중복 확인 강제, 일괄 등록 동작을 검증한다.

## 4. 완료 기준

- 업로드 배치에서 다른 월 거래를 등록할 수 있다.
- 운영월이 없는 거래도 등록 시 자동으로 처리된다.
- 마감월 거래는 저장되지 않고 사용자 메시지가 노출된다.
- 잠재 중복 거래는 확인 없이 저장되지 않는다.
- API 테스트, typecheck, lint가 모두 통과한다.

## 5. 검증 결과

- `npm run typecheck --workspace @personal-erp/contracts`
- `npm run typecheck --workspace @personal-erp/api`
- `npm run typecheck --workspace @personal-erp/web`
- `npm run test --workspace @personal-erp/api`
- `npm run lint --workspace @personal-erp/contracts`
- `npm run lint --workspace @personal-erp/api`
- `npm run lint --workspace @personal-erp/web`

모든 항목 통과.
