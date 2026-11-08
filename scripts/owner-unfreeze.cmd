@echo off
REM Double-click: owner unfreeze on the Throttle vault (signed with your owner key).
cd /d "%~dp0.."
node scripts\owner.mjs unfreeze
echo.
pause
