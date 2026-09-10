#!/usr/bin/env bash
# Kiểm tra mọi customize còn nguyên vẹn. Chạy sau MỖI lần merge upstream.
#   bash custom/verify.sh
set -uo pipefail

CUSTOM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$CUSTOM_DIR/.." && pwd)"
cd "$REPO_ROOT"

FAIL=0
ok()   { echo "  ✅ $1"; }
bad()  { echo "  ❌ $1"; FAIL=1; }

# ─── 1. Patch trên file upstream ──────────────────────────────────────
# Mỗi dòng: <file>|<chuỗi phải tồn tại>|<mô tả>
echo "1. Patch trên file upstream"
while IFS='|' read -r file marker desc; do
  [[ -z "${file:-}" ]] && continue
  if [[ ! -f "$file" ]]; then
    bad "$desc — thiếu file $file"
  elif grep -qF -- "$marker" "$file"; then
    ok "$desc"
  else
    bad "$desc — mất trong $file"
  fi
done <<'PATCHES'
MemoryKnowledge/src/logger.ts|shouldLog("info")) console.error|logger ghi ra stderr (stdout phải sạch cho MCP stdio)
MemoryKnowledge/src/mcp/http-client.ts|x-tdai-service-id|header x-tdai-service-id
MemoryKnowledge/src/mcp/server.ts|const defaultWikiId = process.env.KNOWLEDGE_WIKI_ID|inject wiki_id mặc định từ env
MemoryKnowledge/src/mcp/server.ts|const isMain|phát hiện entrypoint chuẩn trên Windows
MemoryKnowledge/src/mcp/tools.ts|name: "wiki_write"|tool wiki_write
MemoryKnowledge/src/mcp/tools.ts|required: ["query"]|wiki_search không bắt buộc wiki_id
deploy/global-images/_lib.sh|MSYS_NO_PATHCONV|Git Bash không đổi path khi mount docker
deploy/global-images/verify.sh|command -v curl|dùng curl trong PATH
deploy/global-images/start-memory-core.sh|127.0.0.1|gọi 127.0.0.1 thay vì localhost
PATCHES

# ─── 2. Không có secret trong file được git theo dõi ──────────────────
echo "2. Rò rỉ secret"
if git grep -nI -E 'KNOWLEDGE_API_TOKEN[[:space:]]*=[[:space:]]*[^ ]*sk-' -- . >/dev/null 2>&1; then
  bad "có token trong file được git theo dõi:"
  git grep -nI -E 'KNOWLEDGE_API_TOKEN[[:space:]]*=[[:space:]]*[^ ]*sk-' -- . | sed 's/^/     /'
else
  ok "không có KNOWLEDGE_API_TOKEN trong file được theo dõi"
fi
if git check-ignore -q custom/env/local.env; then
  ok "custom/env/local.env đã được gitignore"
else
  bad "custom/env/local.env KHÔNG được gitignore"
fi

# ─── 3. File sinh ra ở gốc repo có khớp custom/agents-config không ────
echo "3. Cấu hình agent ở gốc repo"
if [[ ! -f "$CUSTOM_DIR/env/local.env" ]]; then
  bad "thiếu custom/env/local.env (cp từ local.env.example)"
else
  ok "custom/env/local.env tồn tại"
fi
for f in .clinerules .cursorrules AGENTS.md CLAUDE.md .vscode/mcp.json \
         .github/copilot-instructions.md .agents/mcp_config.json; do
  [[ -f "$f" ]] && ok "$f" || bad "$f — chạy: bash custom/install.sh"
done
if [[ -f .vscode/mcp.json ]] && grep -q '__MCP_' .vscode/mcp.json; then
  bad ".vscode/mcp.json còn placeholder — chạy lại custom/install.sh"
fi

echo
if [[ $FAIL -eq 0 ]]; then echo "✅ Tất cả customize còn nguyên."; else echo "❌ Có customize bị mất — xem custom/patches/ để khôi phục."; fi
exit $FAIL
