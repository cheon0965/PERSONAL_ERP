@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title PERSONAL ERP - Docker Image Builder

set "ENV_FILE=.deploy\compose.env"
set "COMPOSE_FILE=docker-compose.prod.yml"
set "IMAGE_TAG="
set "IMAGE_TAG_FROM_ARG=0"
set "API_IMAGE_NAME="
set "WEB_IMAGE_NAME="
set "MIGRATE_IMAGE_NAME="
set "BUILD_FLAGS="
set "SAVE_IMAGES=0"
set "SKIP_CONFIG=0"
set "EXIT_CODE=0"

echo ============================================
echo   PERSONAL ERP - Docker Image Builder
echo ============================================
echo.

:parse_args
if "%~1"=="" goto :args_done
if /i "%~1"=="--env-file" (
  if "%~2"=="" goto :missing_arg
  set "ENV_FILE=%~2"
  shift
  shift
  goto :parse_args
)
if /i "%~1"=="--compose-file" (
  if "%~2"=="" goto :missing_arg
  set "COMPOSE_FILE=%~2"
  shift
  shift
  goto :parse_args
)
if /i "%~1"=="--tag" (
  if "%~2"=="" goto :missing_arg
  set "IMAGE_TAG=%~2"
  set "IMAGE_TAG_FROM_ARG=1"
  shift
  shift
  goto :parse_args
)
if /i "%~1"=="--no-cache" (
  set "BUILD_FLAGS=!BUILD_FLAGS! --no-cache"
  shift
  goto :parse_args
)
if /i "%~1"=="--pull" (
  set "BUILD_FLAGS=!BUILD_FLAGS! --pull"
  shift
  goto :parse_args
)
if /i "%~1"=="--save" (
  set "SAVE_IMAGES=1"
  shift
  goto :parse_args
)
if /i "%~1"=="--skip-config" (
  set "SKIP_CONFIG=1"
  shift
  goto :parse_args
)
if /i "%~1"=="--help" goto :help
echo [ERROR] Unknown option: %~1
echo Use --help to see supported options.
set "EXIT_CODE=1"
goto :wait_and_exit

:missing_arg
echo [ERROR] Missing value for option: %~1
set "EXIT_CODE=1"
goto :wait_and_exit

:args_done
where docker >nul 2>nul
if errorlevel 1 (
  echo [ERROR] docker was not found in PATH.
  echo         Install Docker Desktop or Docker Engine first.
  set "EXIT_CODE=1"
  goto :wait_and_exit
)

docker compose version >nul 2>nul
if errorlevel 1 (
  echo [ERROR] docker compose is not available.
  echo         Install a Docker version that includes Compose V2.
  set "EXIT_CODE=1"
  goto :wait_and_exit
)

if not exist "%COMPOSE_FILE%" (
  echo [ERROR] Compose file not found: %COMPOSE_FILE%
  set "EXIT_CODE=1"
  goto :wait_and_exit
)

if not exist "%ENV_FILE%" (
  echo [INFO] Env file not found: %ENV_FILE%
  if not exist ".deploy" mkdir ".deploy"
  if exist "env-examples\deploy.compose.env.example" (
    copy /Y "env-examples\deploy.compose.env.example" "%ENV_FILE%" >nul
    echo [INFO] Created %ENV_FILE% from env-examples\deploy.compose.env.example.
    echo [ACTION] Edit %ENV_FILE% and replace placeholder values, then run this script again.
    set "EXIT_CODE=1"
    goto :wait_and_exit
  )
  echo [ERROR] env-examples\deploy.compose.env.example was not found.
  set "EXIT_CODE=1"
  goto :wait_and_exit
)

call :read_env_defaults

if not defined IMAGE_TAG set "IMAGE_TAG=latest"
if not defined API_IMAGE_NAME set "API_IMAGE_NAME=cheon0965/personal-erp-api"
if not defined WEB_IMAGE_NAME set "WEB_IMAGE_NAME=cheon0965/personal-erp-web"
if not defined MIGRATE_IMAGE_NAME set "MIGRATE_IMAGE_NAME=cheon0965/personal-erp-migrate"
set "API_IMAGE_FILE_NAME=%API_IMAGE_NAME:/=-%"
set "WEB_IMAGE_FILE_NAME=%WEB_IMAGE_NAME:/=-%"
set "MIGRATE_IMAGE_FILE_NAME=%MIGRATE_IMAGE_NAME:/=-%"

findstr /i /c:"https://api.example.com/api" "%ENV_FILE%" >nul 2>nul
if not errorlevel 1 (
  echo [WARN] %ENV_FILE% still contains NEXT_PUBLIC_API_BASE_URL=https://api.example.com/api.
  echo        The Web image will bake this API URL into the production bundle.
  echo.
)

findstr /i /c:"NEXT_PUBLIC_API_BASE_URL=http://localhost" "%ENV_FILE%" >nul 2>nul
if not errorlevel 1 (
  echo [WARN] %ENV_FILE% uses localhost for NEXT_PUBLIC_API_BASE_URL.
  echo        External browsers will resolve localhost to the visitor machine, not the server.
  echo        Use the public HTTPS API URL before building the Web image.
  echo.
)

findstr /i /c:"NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1" "%ENV_FILE%" >nul 2>nul
if not errorlevel 1 (
  echo [WARN] %ENV_FILE% uses 127.0.0.1 for NEXT_PUBLIC_API_BASE_URL.
  echo        External browsers will resolve 127.0.0.1 to the visitor machine, not the server.
  echo        Use the public HTTPS API URL before building the Web image.
  echo.
)

findstr /i /c:"replace-with" "%ENV_FILE%" >nul 2>nul
if not errorlevel 1 (
  echo [WARN] %ENV_FILE% still contains one or more placeholder values.
  echo        Image build can continue, but containers will not be production-ready.
  echo.
)

set "DOCKER_BUILDKIT=1"
set "COMPOSE_DOCKER_CLI_BUILD=1"

echo [INFO] Compose file: %COMPOSE_FILE%
echo [INFO] Env file:     %ENV_FILE%
echo [INFO] Image tag:    %IMAGE_TAG%
echo [INFO] API image:    %API_IMAGE_NAME%:%IMAGE_TAG%
echo [INFO] Web image:    %WEB_IMAGE_NAME%:%IMAGE_TAG%
echo [INFO] Migrate image:%MIGRATE_IMAGE_NAME%:%IMAGE_TAG%
echo.

if "%SKIP_CONFIG%"=="0" (
  echo [INFO] Validating compose configuration...
  docker compose --env-file "%ENV_FILE%" -f "%COMPOSE_FILE%" config >nul
  if errorlevel 1 goto :error
  echo [OK] Compose configuration is valid.
  echo.
) else (
  echo [INFO] Skipping compose config validation.
  echo.
)

echo [INFO] Building Docker images: migrate, api, web...
docker compose --env-file "%ENV_FILE%" -f "%COMPOSE_FILE%" build %BUILD_FLAGS% migrate api web
if errorlevel 1 goto :error

echo.
echo [OK] Docker images built successfully.
echo     %MIGRATE_IMAGE_NAME%:%IMAGE_TAG%
echo     %API_IMAGE_NAME%:%IMAGE_TAG%
echo     %WEB_IMAGE_NAME%:%IMAGE_TAG%
echo.

if "%SAVE_IMAGES%"=="1" (
  if not exist ".deploy" mkdir ".deploy"
  if not exist ".deploy\images" mkdir ".deploy\images"
  echo [INFO] Saving Docker image tar files to .deploy\images...
  docker save -o ".deploy\images\%MIGRATE_IMAGE_FILE_NAME%-%IMAGE_TAG%.tar" "%MIGRATE_IMAGE_NAME%:%IMAGE_TAG%"
  if errorlevel 1 goto :error
  docker save -o ".deploy\images\%API_IMAGE_FILE_NAME%-%IMAGE_TAG%.tar" "%API_IMAGE_NAME%:%IMAGE_TAG%"
  if errorlevel 1 goto :error
  docker save -o ".deploy\images\%WEB_IMAGE_FILE_NAME%-%IMAGE_TAG%.tar" "%WEB_IMAGE_NAME%:%IMAGE_TAG%"
  if errorlevel 1 goto :error
  echo [OK] Docker image tar files saved.
  echo.
)

echo [NEXT] To run the stack:
if "%IMAGE_TAG%"=="latest" (
  echo        docker compose --env-file "%ENV_FILE%" -f "%COMPOSE_FILE%" up -d
) else (
  echo        set "IMAGE_TAG=%IMAGE_TAG%"
  echo        docker compose --env-file "%ENV_FILE%" -f "%COMPOSE_FILE%" up -d
  echo.
  echo        Or set IMAGE_TAG=%IMAGE_TAG% in %ENV_FILE% before running compose.
)
exit /b 0

:read_env_defaults
for /f "usebackq tokens=1,* delims==" %%K in ("%ENV_FILE%") do (
  if /i "%%~K"=="IMAGE_TAG" if "%IMAGE_TAG_FROM_ARG%"=="0" set "IMAGE_TAG=%%~L"
  if /i "%%~K"=="API_IMAGE_NAME" set "API_IMAGE_NAME=%%~L"
  if /i "%%~K"=="WEB_IMAGE_NAME" set "WEB_IMAGE_NAME=%%~L"
  if /i "%%~K"=="MIGRATE_IMAGE_NAME" set "MIGRATE_IMAGE_NAME=%%~L"
)
exit /b 0

:help
echo Usage: build-docker-images.bat [--env-file PATH] [--compose-file PATH] [--tag TAG] [--no-cache] [--pull] [--save] [--skip-config]
echo.
echo Options:
echo   --env-file PATH      Compose env file. Default: .deploy\compose.env
echo   --compose-file PATH  Compose file. Default: docker-compose.prod.yml
echo   --tag TAG            Image tag. Default: latest
echo   --no-cache           Build without Docker layer cache
echo   --pull               Pull newer base images before building
echo   --save               Export built images to .deploy\images\*.tar
echo   --skip-config        Skip docker compose config validation
echo   --help               Show this help
echo.
echo Examples:
echo   build-docker-images.bat
echo   build-docker-images.bat --tag 2026-04-30
echo   build-docker-images.bat --tag 2026-04-30 --pull --save
exit /b 0

:error
set "EXIT_CODE=%ERRORLEVEL%"
echo.
echo [ERROR] Docker image build failed with exit code !EXIT_CODE!.
echo.
echo [HINT] Check these items:
echo   1. Docker Desktop or Docker Engine is running
echo   2. %ENV_FILE% exists and has real values
echo   3. NEXT_PUBLIC_API_BASE_URL points to the API URL clients will use
echo   4. Build logs above show whether npm, Prisma, API, or Web failed

:wait_and_exit
echo.
echo   Press any key to close this window...
pause >nul
exit /b !EXIT_CODE!
