@echo off
REM Opens MyNearWallet (testnet) in your default browser with the OWNER key from your
REM keychain, so you can sign owner actions in the Throttle dashboard.
REM The key goes straight from near-cli-rs to the wallet; nothing is printed here.
setlocal
cd /d "%~dp0.."
for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env") do set "%%a=%%b"

echo Importing %OWNER_ACCOUNT_ID% into MyNearWallet (testnet)...
echo Your browser will open. Follow MyNearWallet's prompts to finish the import.
echo.
call near.cmd account export-account %OWNER_ACCOUNT_ID% using-web-wallet network-config testnet
echo.
echo When the wallet shows %OWNER_ACCOUNT_ID%, open http://localhost:5173 in the SAME browser
echo and click "Connect owner wallet", then choose MyNearWallet.
pause
