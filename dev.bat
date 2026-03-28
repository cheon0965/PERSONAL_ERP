@echo off
setlocal
cd /d "%~dp0"
call run-server.bat dev
exit /b %ERRORLEVEL%
