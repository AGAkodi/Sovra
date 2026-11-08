@echo off
REM Double-click: owner reject on the Throttle vault (signed with your owner key).
cd /d "%~dp0.."
node scripts\owner.mjs reject
echo.
pause
