@echo off
title Rocky Orchestrator Boot Sequence
echo [SYSTEM] Booting Rocky...

REM  1. WAIT FOR SYSTEM STABILITY
REM  Laptop startup can be busy; waiting 10 seconds allows services and Drive E: to initialize.
echo [SYSTEM] Waiting 10 seconds for services to settle...
timeout /t 10 /nobreak > nul

REM  2. VERIFY DRIVE ACCESSIBILITY
echo [SYSTEM] Verifying Drive E: access...
if not exist "e:\" (
    echo [CRITICAL ERROR] Drive E: is not accessible. 
    echo Please ensure your external drive is plugged in or the partition is mounted.
    pause
    exit /b
)

REM  3. SWITCH DIRECTORY
echo [SYSTEM] Entering Workspace...
cd /d e:\Autonomous\files\jarvis
if %errorlevel% neq 0 (
    echo [ERROR] Could not enter directory e:\Autonomous\files\jarvis
    pause
    exit /b
)

REM  3a. VERIFY COMMANDS IN PATH
set "ANTIGRAVITY_BIN=C:\Users\Raakesh R\AppData\Local\Programs\Antigravity IDE\bin\antigravity-ide.cmd"
where node >nul 2>nul || (echo [ERROR] node not found & pause & exit /b)
where npm >nul 2>nul || (echo [ERROR] npm not found & pause & exit /b)
if not exist "%ANTIGRAVITY_BIN%" (echo [ERROR] Antigravity not found at %ANTIGRAVITY_BIN% & pause & exit /b)

REM  4. LAUNCH IDE (Antigravity)
echo [SYSTEM] Launching Antigravity IDE...
start "" "%ANTIGRAVITY_BIN%" --remote-debugging-port=9015 .

REM  5. BOOT BACKEND
echo [SYSTEM] Launching Node Backend...
cd backend
start "Rocky Backend" cmd /k "npm run dev"

REM  6. BOOT TUNNEL
echo [SYSTEM] Establishing Global Port Tunnel...
start "Rocky Localtunnel" cmd /k "npm run tunnel"

REM  7. BOOT MOBILE APP
echo [SYSTEM] Launching Mobile App (Expo)...
cd ..\mobile-app
start "Rocky Mobile" cmd /k "npx expo start"

cd ..
echo [SYSTEM] Boot Sequence Complete.
echo.
echo [IMPORTANT] Check the "Rocky Localtunnel" window for your mobile URL.
echo Enter that URL into your Rocky mobile app Setup screen.
echo.
timeout /t 15
exit
