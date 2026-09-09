@echo off
setlocal
cd /d "%~dp0deploy\global-images"

if exist "C:\Program Files\Git\bin\bash.exe" (
    "C:\Program Files\Git\bin\bash.exe" start-all.sh
) else (
    bash start-all.sh
)
