@echo off
REM Double-click: owner approve on the Throttle vault (signed with your owner key).
cd /d "%~dp0.."
node scripts\owner.mjs approve
echo.
pause
