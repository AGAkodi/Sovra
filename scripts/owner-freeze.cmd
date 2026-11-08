@echo off
REM Double-click: owner freeze on the Throttle vault (signed with your owner key).
cd /d "%~dp0.."
node scripts\owner.mjs freeze
echo.
pause
