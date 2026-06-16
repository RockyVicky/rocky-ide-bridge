@echo off
title Rocky Orchestrator Boot Sequence (Test Mode)
echo [SYSTEM] Booting Rocky (TEST MODE)...

REM  1. WAIT FOR SYSTEM STABILITY
timeout /t 10 /nobreak > nul

REM  2. VERIFY DRIVE ACCESSIBILITY
if not exist "e:\" (
    echo [CRITICAL ERROR] Drive E: is not accessible.
    pause
    exit /b
)

REM  3. SWITCH DIRECTORY
cd /d e:\Autonomous\files\jarvis
if %errorlevel% neq 0 (
    echo [ERROR] Could not enter directory e:\Autonomous\files\jarvis
    pause
    exit /b
)

REM  4. LAUNCH IDE (Antigravity)
set "ANTIGRAVITY_BIN=C:\Users\Raakesh R\AppData\Local\Programs\Antigravity IDE\bin\antigravity-ide.cmd"
echo [SYSTEM] Launching Antigravity IDE...
start "" "%ANTIGRAVITY_BIN%" --remote-debugging-port=9015 .

REM  5. BOOT BACKEND
echo [SYSTEM] Launching Node Backend...
cd backend
start "Rocky Backend" cmd /k "npm run dev"

REM  6. BOOT TUNNEL
echo [SYSTEM] Establishing Global Port Tunnel...
start "Rocky Localtunnel" cmd /k "npm run tunnel"

echo [SYSTEM] Test Boot Sequence Complete.
timeout /t 5
exit
