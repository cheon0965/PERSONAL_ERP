@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title PERSONAL ERP - Server Launcher

set "MODE=dev"
set "BUILD_FIRST=0"
set "RUN_MIGRATIONS=1"
set "MIGRATION_SCRIPT=db:deploy"
set "RUN_PHASE1_BACKFILL=1"
set "PHASE1_BACKFILL_SCRIPT=db:backfill:phase1"
set "RUN_DEMO_SEED=1"
set "DEMO_SEED_SCRIPT=db:seed"
set "EXIT_CODE=0"

echo ============================================
echo   PERSONAL ERP - Server Launcher
echo ============================================
echo.

set "SHOW_HELP=0"
set "ARG_ERROR="
for %%A in (%*) do (
  if /i "%%~A"=="dev" set "MODE=dev"
  if /i "%%~A"=="--dev" set "MODE=dev"
  if /i "%%~A"=="prod" set "MODE=prod"
  if /i "%%~A"=="--prod" set "MODE=prod"
  if /i "%%~A"=="--build-first" set "BUILD_FIRST=1"
  if /i "%%~A"=="--skip-migrate" set "RUN_MIGRATIONS=0"
  if /i "%%~A"=="--skip-backfill" set "RUN_PHASE1_BACKFILL=0"
  if /i "%%~A"=="--skip-seed" set "RUN_DEMO_SEED=0"
  if /i "%%~A"=="--seed-demo" set "RUN_DEMO_SEED=1" & set "DEMO_SEED_SCRIPT=db:seed"
  if /i "%%~A"=="--seed-reset" set "RUN_DEMO_SEED=1" & set "DEMO_SEED_SCRIPT=db:seed:reset"
  if /i "%%~A"=="--migrate-dev" set "RUN_MIGRATIONS=1" & set "MIGRATION_SCRIPT=db:migrate"
  if /i "%%~A"=="--migrate-deploy" set "RUN_MIGRATIONS=1" & set "MIGRATION_SCRIPT=db:deploy"
  if /i "%%~A"=="--help" set "SHOW_HELP=1"
  if /i not "%%~A"=="dev" if /i not "%%~A"=="--dev" if /i not "%%~A"=="prod" if /i not "%%~A"=="--prod" if /i not "%%~A"=="--build-first" if /i not "%%~A"=="--skip-migrate" if /i not "%%~A"=="--skip-backfill" if /i not "%%~A"=="--skip-seed" if /i not "%%~A"=="--seed-demo" if /i not "%%~A"=="--seed-reset" if /i not "%%~A"=="--migrate-dev" if /i not "%%~A"=="--migrate-deploy" if /i not "%%~A"=="--help" set "ARG_ERROR=%%~A"
)
if defined ARG_ERROR (
  echo [ERROR] Unknown option: !ARG_ERROR!
  echo Use --help to see supported options.
  set "EXIT_CODE=1"
  goto :wait_and_exit
)
if "%SHOW_HELP%"=="1" goto :help

:args_done
if /i "%MODE%"=="prod" if "%RUN_DEMO_SEED%"=="1" if /i "%DEMO_SEED_SCRIPT%"=="db:seed" (
  echo [INFO] Prod mode detected. Automatic demo seed is disabled by default.
  echo        Use --seed-demo or --seed-reset only when you explicitly want demo data.
  set "RUN_DEMO_SEED=0"
  echo.
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm.cmd not found in PATH.
  echo         Please check whether Node.js is installed.
  set "EXIT_CODE=1"
  goto :wait_and_exit
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

if "%RUN_MIGRATIONS%"=="1" (
  echo [INFO] Running database migration: %MIGRATION_SCRIPT%...
  call npm.cmd run %MIGRATION_SCRIPT%
  if errorlevel 1 goto :error
  echo [OK] Database migration completed.
  echo.
) else (
  echo [INFO] Skipping database migration.
  echo.
)

if "%RUN_PHASE1_BACKFILL%"=="1" (
  echo [INFO] Running Phase 1 backbone backfill: %PHASE1_BACKFILL_SCRIPT%...
  call npm.cmd run %PHASE1_BACKFILL_SCRIPT%
  if errorlevel 1 goto :error
  echo [OK] Phase 1 backbone backfill completed.
  echo.
) else (
  echo [INFO] Skipping Phase 1 backbone backfill.
  echo.
)

if "%RUN_DEMO_SEED%"=="1" (
  echo [INFO] Ensuring demo account and sample data: %DEMO_SEED_SCRIPT%...
  call npm.cmd run %DEMO_SEED_SCRIPT%
  if errorlevel 1 goto :error
  echo [OK] Demo account and sample data are ready.
  echo.
) else (
  echo [INFO] Skipping demo data seed.
  echo.
)

if /i "%MODE%"=="prod" (
  if not exist apps\api\dist\apps\api\src\main.js (
    echo [INFO] API production build output not found. Enabling build-first.
    set "BUILD_FIRST=1"
  )
  if not exist apps\web\.next\prerender-manifest.json (
    echo [INFO] Web production build output not found. Enabling build-first.
    set "BUILD_FIRST=1"
  )
)

if "%BUILD_FIRST%"=="1" (
  echo [INFO] Running build before starting servers...
  call build.bat --skip-install
  if errorlevel 1 goto :error
  echo.
)

if /i "%MODE%"=="dev" (
  echo [INFO] Launching development server windows...
  echo        Web:     http://localhost:3000
  echo        API:     http://localhost:4000/api
  echo        Swagger: http://localhost:4000/api/docs
  echo.
  echo        API and Web will run in separate Command Prompt windows.
  echo.
  start "PERSONAL ERP API (Dev)" cmd.exe /k "cd /d ""%~dp0"" && npm.cmd run dev --workspace @personal-erp/api"
  start "PERSONAL ERP Web (Dev)" cmd.exe /k "cd /d ""%~dp0"" && npm.cmd run dev --workspace @personal-erp/web"
  echo [OK] Development server windows launched.
) else (
  echo [INFO] Launching production server windows...
  echo        Production build output will be used.
  echo.
  echo        API and Web will run in separate Command Prompt windows.
  echo.
  start "PERSONAL ERP API (Prod)" cmd.exe /k "cd /d ""%~dp0"" && npm.cmd run start --workspace @personal-erp/api"
  start "PERSONAL ERP Web (Prod)" cmd.exe /k "cd /d ""%~dp0"" && npm.cmd run start --workspace @personal-erp/web"
  echo [OK] Production server windows launched.
)
exit /b 0

:help
echo Usage: run-server.bat [dev or --dev or prod or --prod] [--build-first] [--skip-migrate] [--skip-backfill] [--skip-seed] [--seed-demo or --seed-reset] [--migrate-dev or --migrate-deploy]
echo   dev,--dev       Start in development mode (default)
echo   prod,--prod     Start in production mode (npm run start)
echo   --build-first   Run build.bat --skip-install before starting servers
echo   --skip-migrate  Skip database migration before startup
echo   --skip-backfill Skip Phase 1 backbone backfill before startup
echo   --skip-seed     Skip demo account and sample data seed before startup
echo   --seed-demo     Ensure the demo account and sample data exist before startup
echo   --seed-reset    Recreate only the demo account and its sample data before startup
echo   --migrate-dev   Use npm run db:migrate before startup
echo   --migrate-deploy Use npm run db:deploy before startup (default)
echo.
echo Tip:
echo   - For local work, use run-server.bat or dev.bat.
echo   - For production, use run-server.bat prod or run-server.bat --prod.
echo   - Database migration runs before API and Web are launched.
echo   - Phase 1 backbone backfill runs after migration unless you pass --skip-backfill.
echo   - In dev mode, demo data is ensured automatically unless you pass --skip-seed.
echo   - In prod mode, demo data is skipped unless you explicitly pass --seed-demo or --seed-reset.
echo   - API and Web are launched in separate Command Prompt windows.
exit /b 0

:error
set "EXIT_CODE=%ERRORLEVEL%"
echo [ERROR] Server command failed with exit code !EXIT_CODE!.
echo.
echo [HINT] Check these items:
echo   1. Required values exist in c:\secrets\personal-erp\api.env and web.env
echo   2. Database connection is reachable and migration credentials are correct
echo   3. Phase 1 backbone backfill can connect to the database
echo   4. Demo seed can connect to the database and the demo email is valid
echo   5. In prod mode, build outputs exist
echo   6. In dev mode, npm run dev shows the same error in a terminal

:wait_and_exit
echo.
echo   Press any key to close this window...
pause >nul
exit /b !EXIT_CODE!
