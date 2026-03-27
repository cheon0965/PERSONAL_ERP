@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

set "DRY_RUN=0"

:parse_args
if "%~1"=="" goto :args_done
if /i "%~1"=="--dry-run" (
  set "DRY_RUN=1"
  shift
  goto :parse_args
)
if /i "%~1"=="--help" goto :help
echo [ERROR] Unknown option: %~1
echo Use --help to see supported options.
exit /b 1

:args_done
echo [INFO] Cleaning generated outputs and dependencies...
if "%DRY_RUN%"=="1" echo [INFO] Dry-run mode enabled. Nothing will be deleted.

call :remove_dir "node_modules"
call :remove_dir "apps\api\node_modules"
call :remove_dir "apps\web\node_modules"
call :remove_dir "packages\contracts\node_modules"
call :remove_dir "apps\api\dist"
call :remove_dir "apps\api\.test-dist"
call :remove_dir "apps\web\.next"
call :remove_dir "apps\web\out"
call :remove_dir "apps\web\.test-dist"
call :remove_dir "packages\contracts\dist"
call :remove_dir ".turbo"
call :remove_dir ".cache"

call :remove_file "apps\api\tsconfig.tsbuildinfo"
call :remove_file "apps\web\tsconfig.tsbuildinfo"
call :remove_file "packages\contracts\tsconfig.tsbuildinfo"
call :remove_file "apps\api\tsconfig.test.tsbuildinfo"
call :remove_file "apps\api\tsconfig.test-run.tsbuildinfo"
call :remove_file "apps\web\tsconfig.test.tsbuildinfo"
call :remove_file "apps\web\tsconfig.test-run.tsbuildinfo"
call :remove_file ".eslintcache"

for %%F in (npm-debug.log npm-debug.log.* yarn-debug.log yarn-error.log pnpm-debug.log) do (
  call :remove_file "%%~F"
)

echo [OK] Cleanup complete.
exit /b 0

:remove_dir
set "TARGET=%~1"
if exist "%TARGET%" (
  if "%DRY_RUN%"=="1" (
    echo [DRY-RUN] remove directory: %TARGET%
  ) else (
    rmdir /s /q "%TARGET%"
    if exist "%TARGET%" (
      echo [WARN] failed to remove directory: %TARGET%
    ) else (
      echo [DONE] removed directory: %TARGET%
    )
  )
) else (
  echo [SKIP] directory not found: %TARGET%
)
exit /b 0

:remove_file
set "TARGET=%~1"
if exist "%TARGET%" (
  if "%DRY_RUN%"=="1" (
    echo [DRY-RUN] remove file: %TARGET%
  ) else (
    del /f /q "%TARGET%" >nul 2>nul
    if exist "%TARGET%" (
      echo [WARN] failed to remove file: %TARGET%
    ) else (
      echo [DONE] removed file: %TARGET%
    )
  )
) else (
  echo [SKIP] file not found: %TARGET%
)
exit /b 0

:help
echo Usage: clean.bat [--dry-run]
echo   --dry-run  Print what would be removed without deleting anything.
echo This script removes build outputs, caches, and node_modules.
echo package-lock.json is preserved for reproducible installs and CI.
exit /b 0
