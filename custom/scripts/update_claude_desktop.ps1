$targetPath = Join-Path $env:APPDATA "Claude\claude_desktop_config.json"
$repoRoot = (Resolve-Path "$PSScriptRoot\..\..").Path
$nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $nodePath) { $nodePath = "node" }
$tsxPath = Join-Path $repoRoot "MemoryKnowledge\node_modules\tsx\dist\cli.mjs"
$serverPath = Join-Path $repoRoot "MemoryKnowledge\src\mcp\server.ts"
$apiUrl = if ($env:KNOWLEDGE_API_URL) { $env:KNOWLEDGE_API_URL } else { "http://127.0.0.1:8424" }
$apiToken = if ($env:KNOWLEDGE_API_TOKEN) { $env:KNOWLEDGE_API_TOKEN } else { "sk-mem-token-placeholder" }
$teamId = if ($env:KNOWLEDGE_TEAM_ID) { $env:KNOWLEDGE_TEAM_ID } else { "team-default" }

$config = @{
    mcpServers = [ordered]@{
        "tencent-memory-agent" = [ordered]@{
            command = $nodePath
            args = @(
                "--no-warnings",
                $tsxPath,
                $serverPath
            )
            env = [ordered]@{
                KNOWLEDGE_API_URL = $apiUrl
                KNOWLEDGE_API_TOKEN = $apiToken
                KNOWLEDGE_TEAM_ID = $teamId
                KNOWLEDGE_WIKI_ID = "wiki-jeq1u9eq"
            }
        }
        "tencent-memory-cueos" = [ordered]@{
            command = $nodePath
            args = @(
                "--no-warnings",
                $tsxPath,
                $serverPath
            )
            env = [ordered]@{
                KNOWLEDGE_API_URL = $apiUrl
                KNOWLEDGE_API_TOKEN = $apiToken
                KNOWLEDGE_TEAM_ID = $teamId
                KNOWLEDGE_WIKI_ID = "wiki-9sr5qg3i"
            }
        }
    }
}

$json = $config | ConvertTo-Json -Depth 10
Set-Content -Path $targetPath -Value $json -Encoding UTF8
Write-Host "Updated Claude Desktop config with absolute node path at: $targetPath" -ForegroundColor Green
