# 서버 Docker 수동 실행 명령 모음

이 문서는 `personalerp.theworkpc.com` 배포 서버에서 Docker Desktop 또는 PowerShell로 컨테이너를 수동 실행할 때 쓰는 명령을 한곳에 모은 runbook입니다.

## 기준값

- 공개 Web/API 도메인: `https://personalerp.theworkpc.com`
- API path: `https://personalerp.theworkpc.com/api`
- 서버 env 파일: `C:\secrets\personal-erp\.deploy\compose.env`
- Docker network: `personal-erp`
- Web 이미지: `cheon0965/personal-erp-web:latest`
- API 이미지: `cheon0965/personal-erp-api:latest`
- Migration 이미지: `cheon0965/personal-erp-migrate:latest`
- MySQL 이미지: `mysql:8.4`
- API 내부/게시 포트: `4100`
- Web 내부/게시 포트: `3100`

`C:\secrets\personal-erp\.deploy\compose.env`에는 최소 아래 값이 실제 배포 도메인 기준으로 들어 있어야 합니다.

```env
APP_ORIGIN=https://personalerp.theworkpc.com
CORS_ALLOWED_ORIGINS=https://personalerp.theworkpc.com
NEXT_PUBLIC_API_BASE_URL=https://personalerp.theworkpc.com/api
API_PUBLISHED_PORT=4100
WEB_PUBLISHED_PORT=3100
```

주의: `NEXT_PUBLIC_API_BASE_URL`은 Web 이미지 빌드 시점에 박힙니다. 이 값을 바꾼 뒤에는 Web 이미지를 다시 빌드하고 push/pull해야 합니다.

## 1. 이미지 받기

```powershell
docker pull mysql:8.4
docker pull cheon0965/personal-erp-migrate:latest
docker pull cheon0965/personal-erp-api:latest
docker pull cheon0965/personal-erp-web:latest
```

## 2. 공용 Docker network 준비

이미 있으면 `already exists`가 나와도 괜찮습니다.

```powershell
docker network create personal-erp
```

## 3. MySQL 실행

운영 데이터가 이미 들어 있는 서버에서는 volume을 삭제하지 않습니다. 아래 명령은 컨테이너만 다시 만들고, 데이터는 `C:\docker-data\personal-erp\mysql`에 유지합니다.

```powershell
docker rm -f mysql
```

```powershell
docker run -d --name mysql --network personal-erp `
  --env-file "C:\secrets\personal-erp\.deploy\compose.env" `
  -v "C:\docker-data\personal-erp\mysql:/var/lib/mysql" `
  mysql:8.4 `
  --character-set-server=utf8mb4 `
  --collation-server=utf8mb4_0900_ai_ci
```

MySQL 준비 상태를 확인합니다.

```powershell
docker logs mysql
```

로그에 `ready for connections`가 보인 뒤 다음 단계로 넘어갑니다.

## 4. 서버 마이그레이션 실행

`migrate` 컨테이너는 schema migration만 실행하고 정상 종료됩니다. 성공 상태는 `Exited (0)`입니다.

```powershell
docker rm -f personal-erp-migrate
```

```powershell
docker run --name personal-erp-migrate --network personal-erp `
  --env-file "C:\secrets\personal-erp\.deploy\compose.env" `
  cheon0965/personal-erp-migrate:latest
```

결과 확인:

```powershell
docker logs personal-erp-migrate
```

## 5. 백엔드 API 서버 실행

```powershell
docker rm -f personal-erp-api
```

```powershell
docker run -d --name personal-erp-api --network personal-erp -p 4100:4100 `
  --env-file "C:\secrets\personal-erp\.deploy\compose.env" `
  -e NODE_ENV=production `
  -e PORT=4100 `
  cheon0965/personal-erp-api:latest
```

API 상태 확인:

```powershell
docker logs personal-erp-api
Invoke-WebRequest http://127.0.0.1:4100/api/health
Invoke-WebRequest http://127.0.0.1:4100/api/health/ready
```

## 6. 기본 데모 데이터 넣기

새 DB에는 migration만으로 데모 계정이 생기지 않습니다. API 컨테이너가 떠 있는 상태에서 seed를 한 번 실행합니다.

```powershell
docker exec personal-erp-api node apps/api/dist/apps/api/prisma/seed.js --reset
```

성공하면 데모 계정은 아래 값으로 로그인할 수 있습니다.

```text
demo@example.com
Demo1234!
```

API 컨테이너를 띄우기 전 seed만 따로 실행해야 한다면 아래 one-shot 명령을 사용할 수 있습니다.

```powershell
docker run --rm --network personal-erp `
  --env-file "C:\secrets\personal-erp\.deploy\compose.env" `
  cheon0965/personal-erp-api:latest `
  node apps/api/dist/apps/api/prisma/seed.js --reset
```

## 7. 프론트엔드 Web 서버 실행

```powershell
docker rm -f personal-erp-web
```

```powershell
docker run -d --name personal-erp-web --network personal-erp -p 3100:3100 `
  --env-file "C:\secrets\personal-erp\.deploy\compose.env" `
  -e NODE_ENV=production `
  -e PORT=3100 `
  -e HOSTNAME=0.0.0.0 `
  cheon0965/personal-erp-web:latest
```

Web 상태 확인:

```powershell
docker logs personal-erp-web
Invoke-WebRequest http://127.0.0.1:3100
```

## 8. 공개 도메인 확인

Caddy가 아래처럼 `/api/*`는 API, 나머지는 Web으로 보내야 합니다.

```caddyfile
personalerp.theworkpc.com {
	reverse_proxy /api/* 127.0.0.1:4100
	reverse_proxy 127.0.0.1:3100
}
```

공개 health check:

```powershell
Invoke-WebRequest https://personalerp.theworkpc.com/api/health
Invoke-WebRequest https://personalerp.theworkpc.com/api/health/ready
Invoke-WebRequest https://personalerp.theworkpc.com
```

로그인 API 직접 확인:

```powershell
$body = @{ email = "demo@example.com"; password = "Demo1234!" } | ConvertTo-Json

Invoke-WebRequest `
  -Method Post `
  -Uri "https://personalerp.theworkpc.com/api/auth/login" `
  -ContentType "application/json" `
  -Headers @{ Origin = "https://personalerp.theworkpc.com" } `
  -Body $body
```

## 9. 네트워크와 컨테이너 점검

모든 컨테이너가 `personal-erp` network에 있어야 합니다.

```powershell
docker network inspect personal-erp
```

정상이라면 `Containers` 안에 최소 아래 컨테이너가 보입니다.

```text
mysql
personal-erp-api
personal-erp-web
```

실행 상태 확인:

```powershell
docker ps
docker logs --tail 100 mysql
docker logs --tail 100 personal-erp-api
docker logs --tail 100 personal-erp-web
```

## 10. Web 이미지 API URL 확인

로그인은 API가 정상인데 브라우저에서만 안 되면 Web 이미지에 예전 API URL이 박혔는지 확인합니다.

```powershell
docker exec personal-erp-web /bin/sh -lc "grep -RIl -- 'localhost:4100' apps/web/.next 2>/dev/null || true"
docker exec personal-erp-web /bin/sh -lc "grep -RIl -- 'personalerp.theworkpc.com/api' apps/web/.next 2>/dev/null || true"
```

- `localhost:4100`이 나오면 Web 이미지를 public API URL 기준으로 다시 빌드해야 합니다.
- `personalerp.theworkpc.com/api`가 나오면 현재 공개 API URL이 Web bundle에 들어간 상태입니다.

## 11. 안전한 재시작 순서

운영 중 문제가 생겨 컨테이너를 순서대로 다시 올릴 때는 아래 흐름을 따릅니다.

```powershell
docker rm -f personal-erp-web
docker rm -f personal-erp-api
docker rm -f personal-erp-migrate

docker start mysql

docker run --name personal-erp-migrate --network personal-erp `
  --env-file "C:\secrets\personal-erp\.deploy\compose.env" `
  cheon0965/personal-erp-migrate:latest

docker run -d --name personal-erp-api --network personal-erp -p 4100:4100 `
  --env-file "C:\secrets\personal-erp\.deploy\compose.env" `
  -e NODE_ENV=production `
  -e PORT=4100 `
  cheon0965/personal-erp-api:latest

docker run -d --name personal-erp-web --network personal-erp -p 3100:3100 `
  --env-file "C:\secrets\personal-erp\.deploy\compose.env" `
  -e NODE_ENV=production `
  -e PORT=3100 `
  -e HOSTNAME=0.0.0.0 `
  cheon0965/personal-erp-web:latest
```

데모 데이터가 없거나 초기화가 필요할 때만 seed를 다시 실행합니다.

```powershell
docker exec personal-erp-api node apps/api/dist/apps/api/prisma/seed.js --reset
```
