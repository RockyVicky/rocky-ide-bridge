@echo off
setlocal
title Rocky Ecosystem Manual Boot
echo [SYSTEM] Initializing Rocky Workspace...

REM  1. VERIFY DRIVE ACCESSIBILITY
if not exist "e:\" (
    echo [ERROR] Drive E: is not accessible.
    pause
    exit /b
)

REM  2. SET BASE PATH
set "BASE_PATH=%~dp0"
cd /d "%BASE_PATH%"

REM  3. BOOT BACKEND
echo [SYSTEM] Launching Node Backend...
if exist "backend" (
    cd /d "%BASE_PATH%\backend"
    start "Rocky Backend" cmd /k "npm run dev"
) else (
    echo [ERROR] Backend directory not found!
)

REM  4. BOOT TUNNEL
echo [SYSTEM] Establishing Global Port Tunnel...
if exist "%BASE_PATH%\backend\package.json" (
    cd /d "%BASE_PATH%\backend"
    start "Rocky Localtunnel" cmd /k "npm run tunnel"
)

REM  5. BOOT MOBILE APP
echo [SYSTEM] Launching Mobile App (Expo)...
if exist "%BASE_PATH%\mobile-app" (
    cd /d "%BASE_PATH%\mobile-app"
    start "Rocky Mobile" cmd /k "npm start"
) else (
    echo [ERROR] Mobile-app directory not found!
)

echo.
echo [SYSTEM] All systems engaged. (Voice disabled)
timeout /t 5
exit
