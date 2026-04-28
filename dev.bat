@echo off
setlocal
cd /d "%~dp0"
call run-server.bat dev --local-db
exit /b %ERRORLEVEL%
