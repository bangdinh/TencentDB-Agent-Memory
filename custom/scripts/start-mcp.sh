#!/usr/bin/env bash
# Khởi động MCP server "tencent-memory" (MemoryKnowledge) trên macOS/Linux.
# Config đọc từ custom/env/local.env — không hardcode secret ở đây.
set -euo pipefail

CUSTOM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$CUSTOM_DIR/.." && pwd)"
ENV_FILE="$CUSTOM_DIR/env/local.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Thiếu $ENV_FILE — chạy: cp custom/env/local.env.example custom/env/local.env" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

cd "$REPO_ROOT/MemoryKnowledge"
exec node --no-warnings node_modules/tsx/dist/cli.mjs src/mcp/server.ts
