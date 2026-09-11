@echo off
REM Wrapper goi custom\install.sh qua Git Bash tren Windows.
setlocal
if exist "C:\Program Files\Git\bin\bash.exe" (
    "C:\Program Files\Git\bin\bash.exe" "%~dp0install.sh"
) else (
    bash "%~dp0install.sh"
)
