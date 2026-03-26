@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

set "SKIP_INSTALL=0"

:parse_args
if "%~1"=="" goto :args_done
if /i "%~1"=="--skip-install" (
  set "SKIP_INSTALL=1"
  shift
  goto :parse_args
)
if /i "%~1"=="--help" goto :help
echo [ERROR] Unknown option: %~1
echo Use --help to see supported options.
exit /b 1

:args_done
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm.cmd not found in PATH.
  exit /b 1
)

if "%SKIP_INSTALL%"=="0" (
  if exist package-lock.json (
    echo [INFO] Installing dependencies with npm ci...
    call npm.cmd ci
  ) else (
    echo [INFO] Installing dependencies with npm install...
    call npm.cmd install
  )
  if errorlevel 1 goto :error
) else (
  echo [INFO] Skipping dependency installation.
)

echo [INFO] Generating Prisma client...
call npm.cmd run prisma:generate --workspace @personal-erp/api
if errorlevel 1 goto :error

echo [INFO] Running full workspace build...
call npm.cmd run build
if errorlevel 1 goto :error

echo [OK] Build completed successfully.
exit /b 0

:help
echo Usage: build.bat [--skip-install]
echo   --skip-install  Skip dependency installation and run generate/build only.
exit /b 0

:error
set "EXIT_CODE=%ERRORLEVEL%"
echo [ERROR] Build failed with exit code !EXIT_CODE!.
exit /b !EXIT_CODE!
