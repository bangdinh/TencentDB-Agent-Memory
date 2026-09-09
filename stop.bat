@echo off
setlocal
cd /d "%~dp0deploy\global-images"

if exist "C:\Program Files\Git\bin\bash.exe" (
    "C:\Program Files\Git\bin\bash.exe" stop-all.sh
) else (
    bash stop-all.sh
)
