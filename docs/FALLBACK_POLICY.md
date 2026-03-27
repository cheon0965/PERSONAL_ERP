# Web Fallback 정책

## 목적

Web이 통합 오류를 조용히 숨기지 않도록 하는 것이 목적입니다.

## 기본 원칙

- demo fallback은 기본적으로 비활성화합니다.
- fallback은 로컬 개발에서만 명시적으로 켤 수 있습니다.
- 운영 환경에서는 요청 실패를 그대로 드러냅니다.
- 쿼리 실패는 화면에서 보이도록 유지합니다.

## 활성화 방법

현재 권장 위치는 외부 SECRET 폴더의 `web.env` 입니다.
현재 기준 경로 예시는 `C:\secrets\personal-erp\web.env` 입니다.
macOS/Linux에서는 같은 의미로 `/Users/<name>/secrets/personal-erp/web.env` 같은 절대 경로를 사용하면 됩니다.

```env
NEXT_PUBLIC_ENABLE_DEMO_FALLBACK=true
```

이 값이 없거나 `false`이면 Web은 API 실패를 에러로 표시합니다.

필요하면 로컬 fallback 파일인 `apps/web/.env.local`에 넣을 수도 있지만, 현재 협업 기준은 외부 SECRET 폴더 사용입니다.

## 해석

- API가 꺼져 있는데 화면이 정상처럼 보이는 상황을 줄입니다.
- 프론트와 백엔드 협업 시 계약 불일치를 빨리 발견할 수 있습니다.
- demo 모드를 의도적으로만 사용하게 만듭니다.
