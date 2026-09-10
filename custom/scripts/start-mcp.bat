@echo off
REM Khoi dong MCP server "tencent-memory" (MemoryKnowledge) tren Windows.
REM Config doc tu custom\env\local.env — khong hardcode secret o day.
setlocal

set "CUSTOM_DIR=%~dp0.."
set "REPO_ROOT=%~dp0..\.."
set "ENV_FILE=%CUSTOM_DIR%\env\local.env"

if not exist "%ENV_FILE%" (
    echo Thieu %ENV_FILE% - chay: copy custom\env\local.env.example custom\env\local.env 1>&2
    exit /b 1
)

REM eol=# lam cmd bo qua cac dong comment trong local.env
for /f "usebackq eol=# tokens=1,* delims==" %%a in ("%ENV_FILE%") do (
    if not "%%a"=="" set "%%a=%%b"
)

cd /d "%REPO_ROOT%\MemoryKnowledge"

where node >nul 2>nul
if %errorlevel% equ 0 (
    node --no-warnings node_modules\tsx\dist\cli.mjs src\mcp\server.ts
) else (
    "C:\Program Files\nodejs\node.exe" --no-warnings node_modules\tsx\dist\cli.mjs src\mcp\server.ts
)
