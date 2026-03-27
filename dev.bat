@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Personal ERP - Dev Server

echo ============================================
echo   Personal ERP - Development Server
echo ============================================
echo.

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm.cmd not found in PATH.
  echo         Node.js가 설치되어 있는지 확인하세요.
  goto :wait_and_exit
)

if not exist node_modules (
  echo [INFO] node_modules not found. Installing dependencies...
  echo        처음 실행 시 몇 분 소요될 수 있습니다.
  echo.
  if exist package-lock.json (
    call npm.cmd ci
  ) else (
    call npm.cmd install
  )
  if errorlevel 1 (
    echo.
    echo [ERROR] 패키지 설치에 실패했습니다.
    goto :wait_and_exit
  )
  echo.
)

echo [INFO] Starting dev servers...
echo        Web:     http://localhost:3000
echo        API:     http://localhost:4000/api
echo        Swagger: http://localhost:4000/api/docs
echo.
echo        종료하려면 Ctrl+C 를 누르세요.
echo ============================================
echo.

call npm.cmd run dev

echo.
echo ============================================
echo   서버가 종료되었습니다.
echo ============================================

:wait_and_exit
echo.
echo   이 창을 닫으려면 아무 키나 누르세요...
pause >nul
exit /b 0
