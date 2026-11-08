@echo off
REM Double-click: apply the Supabase schema using SUPABASE_DB_URL from .env.
cd /d "%~dp0.."
node scriptspply-migrations.mjs
echo.
pause
