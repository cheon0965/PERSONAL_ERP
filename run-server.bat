@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

set "MODE=prod"
set "BUILD_FIRST=0"

:parse_args
if "%~1"=="" goto :args_done
if /i "%~1"=="dev" (
  set "MODE=dev"
  shift
  goto :parse_args
)
if /i "%~1"=="--dev" (
  set "MODE=dev"
  shift
  goto :parse_args
)
if /i "%~1"=="--build-first" (
  set "BUILD_FIRST=1"
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

if not exist node_modules (
  echo [INFO] node_modules not found. Installing dependencies...
  if exist package-lock.json (
    call npm.cmd ci
  ) else (
    call npm.cmd install
  )
  if errorlevel 1 goto :error
)

if "%BUILD_FIRST%"=="1" (
  echo [INFO] Running build before starting servers...
  call build.bat --skip-install
  if errorlevel 1 goto :error
)

if /i "%MODE%"=="dev" (
  echo [INFO] Starting development servers...
  call npm.cmd run dev
) else (
  echo [INFO] Starting production servers...
  call npm.cmd run start
)
if errorlevel 1 goto :error

exit /b 0

:help
echo Usage: run-server.bat [dev^|--dev] [--build-first]
echo   dev,--dev       Start in development mode ^(npm run dev^)
echo   --build-first   Run build.bat --skip-install before starting servers
echo Default mode is production ^(npm run start^).
exit /b 0

:error
set "EXIT_CODE=%ERRORLEVEL%"
echo [ERROR] Server command failed with exit code !EXIT_CODE!.
exit /b !EXIT_CODE!
