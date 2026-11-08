@echo off
REM Creates the five Sovra testnet accounts listed in .env using the NEAR faucet.
REM Double-click to run. Keys are saved to your Windows keychain by near-cli-rs.
setlocal
cd /d "%~dp0.."

if not exist ".env" (
  echo .env not found in %CD%
  pause
  exit /b 1
)

for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env") do set "%%a=%%b"

echo Creating Sovra testnet accounts on %NEAR_NETWORK%...
for %%i in (%OWNER_ACCOUNT_ID% %VAULT_CONTRACT_ID% %AGENT_ACCOUNT_ID% %RECIPIENT_ACCOUNT_ID% %ATTACKER_ACCOUNT_ID%) do (
  echo.
  echo ============ %%i ============
  call near.cmd account create-account sponsor-by-faucet-service %%i autogenerate-new-keypair --signature-scheme ed25519 save-to-keychain network-config testnet create
  timeout /t 5 /nobreak >nul
)

echo.
echo Finished. You can close this window and tell Claude it's done
echo (or describe any error you saw above).
pause
