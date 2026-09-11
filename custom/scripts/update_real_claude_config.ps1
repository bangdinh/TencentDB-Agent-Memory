$paths = @(
    "$env:LOCALAPPDATA\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json",
    "$env:APPDATA\Claude\claude_desktop_config.json"
)

$repoRoot = (Resolve-Path "$PSScriptRoot\..\..").Path
$nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $nodePath) { $nodePath = "node" }
$tsxPath = Join-Path $repoRoot "MemoryKnowledge\node_modules\tsx\dist\cli.mjs"
$serverPath = Join-Path $repoRoot "MemoryKnowledge\src\mcp\server.ts"
$apiUrl = if ($env:KNOWLEDGE_API_URL) { $env:KNOWLEDGE_API_URL } else { "http://127.0.0.1:8424" }
$apiToken = if ($env:KNOWLEDGE_API_TOKEN) { $env:KNOWLEDGE_API_TOKEN } else { "sk-mem-token-placeholder" }
$teamId = if ($env:KNOWLEDGE_TEAM_ID) { $env:KNOWLEDGE_TEAM_ID } else { "team-default" }

$servers = [ordered]@{
    "1Agent" = [ordered]@{
        command = $nodePath
        args = @(
            "--no-warnings",
            $tsxPath,
            $serverPath
        )
        env = [ordered]@{
            AGENT_NAME = "Claude Desktop"
            MCP_SERVER_NAME = "1Agent"
            KNOWLEDGE_API_URL = $apiUrl
            KNOWLEDGE_API_TOKEN = $apiToken
            KNOWLEDGE_TEAM_ID = $teamId
            KNOWLEDGE_WIKI_ID = "wiki-jeq1u9eq"
        }
    }
    "2Cueos" = [ordered]@{
        command = $nodePath
        args = @(
            "--no-warnings",
            $tsxPath,
            $serverPath
        )
        env = [ordered]@{
            AGENT_NAME = "Claude Desktop"
            MCP_SERVER_NAME = "2Cueos"
            KNOWLEDGE_API_URL = $apiUrl
            KNOWLEDGE_API_TOKEN = $apiToken
            KNOWLEDGE_TEAM_ID = $teamId
            KNOWLEDGE_WIKI_ID = "wiki-9sr5qg3i"
        }
    }
}

foreach ($p in $paths) {
    if (Test-Path $p) {
        $content = Get-Content $p -Raw | ConvertFrom-Json
        $content.mcpServers = $servers
        $json = $content | ConvertTo-Json -Depth 20
        Set-Content -Path $p -Value $json -Encoding UTF8
        Write-Host "Successfully updated: $p" -ForegroundColor Green
    }
}
