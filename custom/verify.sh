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

# ─── 1. MemoryKnowledge phải sạch 100% ────────────────────────────────
# Toàn bộ customize MCP đã chuyển sang custom/mcp-shared-memory/.
# Sửa trực tiếp vào MemoryKnowledge là đi lùi — chặn ngay tại đây.
echo "1. MemoryKnowledge giữ nguyên bản upstream"
UPSTREAM_REF="${UPSTREAM_REF:-upstream/feat/server_team}"
if ! git rev-parse --verify -q "$UPSTREAM_REF" >/dev/null; then
  echo "  ⏭  bỏ qua (chưa có $UPSTREAM_REF — chạy: git fetch upstream)"
elif [[ -z "$(git diff "$UPSTREAM_REF" -- MemoryKnowledge/)" ]]; then
  ok "MemoryKnowledge khớp $UPSTREAM_REF"
else
  bad "MemoryKnowledge đã bị sửa — customize phải nằm ở custom/mcp-shared-memory/:"
  git diff --stat "$UPSTREAM_REF" -- MemoryKnowledge/ | sed 's/^/     /'
fi

# ─── 1b. Patch buộc phải giữ trên file upstream ───────────────────────
echo "1b. Patch trên deploy/ (chưa tách ra được)"
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
deploy/global-images/_lib.sh|MSYS_NO_PATHCONV|Git Bash không đổi path khi mount docker
deploy/global-images/verify.sh|command -v curl|dùng curl trong PATH
deploy/global-images/start-memory-core.sh|127.0.0.1|gọi 127.0.0.1 thay vì localhost
PATCHES

# ─── 1c. MCP server riêng ─────────────────────────────────────────────
echo "1c. custom/mcp-shared-memory"
if [[ ! -d "$CUSTOM_DIR/mcp-shared-memory/node_modules" ]]; then
  bad "chưa cài dependency — (cd custom/mcp-shared-memory && npm install)"
elif node "$CUSTOM_DIR/mcp-shared-memory/test/smoke.mjs" >/tmp/smoke.$$ 2>&1; then
  ok "smoke test MCP server pass (13 tool, stdout sạch JSON-RPC)"
  rm -f /tmp/smoke.$$
else
  bad "smoke test MCP server FAIL:"
  sed 's/^/     /' /tmp/smoke.$$; rm -f /tmp/smoke.$$
fi

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
