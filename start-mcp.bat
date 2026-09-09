@echo off
cd /d "%~dp0MemoryKnowledge"
set KNOWLEDGE_API_URL=http://127.0.0.1:8424
set KNOWLEDGE_API_TOKEN=sk-mem-new-key123456
set KNOWLEDGE_SERVICE_ID=default
set KNOWLEDGE_TEAM_ID=team-lgjymhjjpp
set KNOWLEDGE_WIKI_ID=wiki-9sr5qg3i

where node >nul 2>nul
if %errorlevel% equ 0 (
    node --no-warnings node_modules\tsx\dist\cli.mjs src\mcp\server.ts
) else (
    "C:\Program Files\nodejs\node.exe" --no-warnings node_modules\tsx\dist\cli.mjs src\mcp\server.ts
)