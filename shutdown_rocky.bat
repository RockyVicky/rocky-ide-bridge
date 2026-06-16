@echo off
setlocal
title Rocky Ecosystem Shutdown
echo [SYSTEM] Shutting down Rocky Ecosystem...

REM  1. KILL BACKEND
echo [SHUTDOWN] Closing Rocky Backend...
taskkill /FI "WINDOWTITLE eq Rocky Backend*" /T /F >nul 2>&1

REM  2. KILL TUNNEL
echo [SHUTDOWN] Closing Rocky Localtunnel...
taskkill /FI "WINDOWTITLE eq Rocky Localtunnel*" /T /F >nul 2>&1

REM  3. KILL MOBILE APP
echo [SHUTDOWN] Closing Rocky Mobile...
taskkill /FI "WINDOWTITLE eq Rocky Mobile*" /T /F >nul 2>&1

REM  4. CLEANUP ANY REMAINING NODE PROCESSES (Optional but helpful)
echo [SHUTDOWN] Cleaning up background processes...
taskkill /IM node.exe /F >nul 2>&1

echo.
echo [SYSTEM] All systems deactivated.
timeout /t 3
exit
