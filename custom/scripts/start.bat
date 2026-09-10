@echo off
REM Chay deploy/global-images/start-all.sh qua Git Bash.
setlocal
cd /d "%~dp0..\..\deploy\global-images"

if exist "C:\Program Files\Git\bin\bash.exe" (
    "C:\Program Files\Git\bin\bash.exe" start-all.sh
) else (
    bash start-all.sh
)
