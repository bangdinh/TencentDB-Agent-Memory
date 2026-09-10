@echo off
REM Khoi dong MCP server "tencent-memory" (custom\mcp-shared-memory) tren Windows.
REM Config doc tu custom\env\local.env — khong hardcode secret o day.
setlocal

set "CUSTOM_DIR=%~dp0.."
set "PKG_DIR=%CUSTOM_DIR%\mcp-shared-memory"
set "ENV_FILE=%CUSTOM_DIR%\env\local.env"

if not exist "%ENV_FILE%" (
    echo Thieu %ENV_FILE% - chay: copy custom\env\local.env.example custom\env\local.env 1>&2
    exit /b 1
)
if not exist "%PKG_DIR%\node_modules" (
    echo Chua cai dependency - chay: cd custom\mcp-shared-memory ^&^& npm install 1>&2
    exit /b 1
)

REM eol=# lam cmd bo qua cac dong comment trong local.env
for /f "usebackq eol=# tokens=1,* delims==" %%a in ("%ENV_FILE%") do (
    if not "%%a"=="" set "%%a=%%b"
)

cd /d "%PKG_DIR%"

where node >nul 2>nul
if %errorlevel% equ 0 (
    node node_modules\tsx\dist\cli.mjs src\server.ts
) else (
    "C:\Program Files\nodejs\node.exe" node_modules\tsx\dist\cli.mjs src\server.ts
)
