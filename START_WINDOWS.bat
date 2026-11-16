@echo off
cd /d "%~dp0"
if not exist back-end\node_modules (call npm run setup)
if not exist frontend\node_modules (call npm run setup)
if not exist back-end\.env (call node scripts/configure.mjs)
if errorlevel 1 (pause & exit /b 1)
call npm run dev
pause
