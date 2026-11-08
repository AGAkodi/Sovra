@echo off
REM Double-click to deploy and configure the Throttle vault from .env.
REM Safe to re-run: completed steps are skipped.
cd /d "%~dp0.."
node scripts\setup-vault.mjs
echo.
pause
