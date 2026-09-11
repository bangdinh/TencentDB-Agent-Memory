@echo off
REM =========================================================================
REM Script khoi chay tat ca service/agent trong custom/
REM =========================================================================

echo [CUSTOM] Starting custom services and agents...

echo [CUSTOM] Starting Flow Monitor Service on port 8126...
start "Flow Monitor Service" /b "C:\Program Files\nodejs\node.exe" "%~dp0services\flow-monitor\server.mjs"

echo [CUSTOM] Flow Monitor started at http://localhost:8126
echo [CUSTOM] All custom services started successfully.
