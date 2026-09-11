@echo off
REM Chay deploy/global-images/stop-all.sh qua Git Bash.
setlocal
cd /d "%~dp0..\..\deploy\global-images"

if exist "C:\Program Files\Git\bin\bash.exe" (
    "C:\Program Files\Git\bin\bash.exe" stop-all.sh
) else (
    bash stop-all.sh
)
