# API 개요

## Base URL

- API Prefix: `/api`
- Swagger: `/api/docs`

## 공개 엔드포인트

- `GET /health`
- `POST /auth/login`

## 보호 엔드포인트

아래 엔드포인트는 기본적으로 Bearer 토큰이 필요합니다.

- `GET /auth/me`
- `GET /accounts`
- `GET /categories`
- `GET /transactions`
- `POST /transactions`
- `GET /recurring-rules`
- `POST /recurring-rules`
- `GET /insurance-policies`
- `GET /vehicles`
- `GET /dashboard/summary`
- `GET /forecast/monthly?month=YYYY-MM`

## 인증 흐름

1. `POST /auth/login`으로 access token과 refresh token을 받습니다.
2. 이후 요청에는 `Authorization: Bearer <accessToken>`을 사용합니다.
3. 현재 사용자 확인은 `GET /auth/me`를 사용합니다.

## 현재 쓰기 엔드포인트

- `POST /transactions`
- `POST /recurring-rules`

둘 다 현재 사용자 범위 안의 계좌/카테고리만 허용합니다.

## 문서화 원칙

- Swagger는 현재 구현 엔드포인트를 기준으로 유지합니다.
- 계약이 바뀌면 `packages/contracts`와 이 문서를 함께 갱신합니다.
