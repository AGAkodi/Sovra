@echo off
cd /d "%~dp0"
echo Signing in to HyperFrames (free). A browser window will open: sign in there, then come back here.
echo.
call npx.cmd --yes hyperframes@0.9.26 auth login
echo.
call npx.cmd --yes hyperframes@0.9.26 auth status
echo.
echo Done. You can close this window and tell Claude "Signed in".
pause
