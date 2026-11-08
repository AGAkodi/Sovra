@echo off
REM Prints the OWNER account's private key from your keychain so you can import it
REM into Meteor Wallet ("Import wallet" -> "Private key"). TESTNET ONLY.
REM The key is shown only in this window. Do not share or screenshot it.
setlocal
cd /d "%~dp0.."
for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env") do set "%%a=%%b"

echo ===================================================================
echo  Owner account: %OWNER_ACCOUNT_ID%  (testnet)
echo  The private key below controls this account. Paste it ONLY into
echo  Meteor Wallet's import screen. Do not share it or screenshot it.
echo ===================================================================
echo.
call near.cmd account export-account %OWNER_ACCOUNT_ID% using-private-key network-config testnet
echo.
echo Next: in Meteor Wallet choose Import wallet ^> Private key, paste the key
echo (it starts with ed25519:), select Testnet, then close this window.
pause
cls
