#!/usr/bin/env bash
# Khởi động MCP server "tencent-memory" (custom/mcp-shared-memory) trên macOS/Linux.
# Config đọc từ custom/env/local.env — không hardcode secret ở đây.
set -euo pipefail

CUSTOM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKG_DIR="$CUSTOM_DIR/mcp-shared-memory"
ENV_FILE="$CUSTOM_DIR/env/local.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Thiếu $ENV_FILE — chạy: cp custom/env/local.env.example custom/env/local.env" >&2
  exit 1
fi
if [[ ! -d "$PKG_DIR/node_modules" ]]; then
  echo "Chưa cài dependency — chạy: (cd custom/mcp-shared-memory && npm ci)" >&2
  exit 1
fi

# local.env chỉ là GIÁ TRỊ MẶC ĐỊNH: biến nào agent đã truyền qua `env` trong MCP
# config thì giữ nguyên. Nhờ vậy mỗi project khai được KNOWLEDGE_PROJECT_ID riêng
# mà vẫn dùng chung token/URL trong local.env.
while IFS='=' read -r key val || [[ -n "${key:-}" ]]; do
  [[ -z "$key" || "$key" == \#* ]] && continue
  key="${key%"${key##*[![:space:]]}"}"   # bỏ khoảng trắng cuối tên biến
  [[ -z "$key" ]] && continue
  if [[ -z "${!key:-}" ]]; then
    export "$key=$val"
  fi
done < "$ENV_FILE"

cd "$PKG_DIR"
exec node node_modules/tsx/dist/cli.mjs src/server.ts
