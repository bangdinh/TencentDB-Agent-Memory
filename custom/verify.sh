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

# ─── 1b. Patch buộc phải giữ trên deploy/ ─────────────────────────────
# Khớp hệt nội dung đã gửi upstream ở PR #1330. Nếu PR được merge thì mấy
# check này vẫn xanh và patches/002 sẽ tự rỗng đi ở lần refresh-patches kế.
echo "1b. Patch Windows/Git Bash trên deploy/ (= PR #1330)"

has() {  # has <file> <chuỗi> <mô tả>
  if [[ ! -f "$1" ]]; then bad "$3 — thiếu file $1"
  elif grep -qF -- "$2" "$1"; then ok "$3"
  else bad "$3 — mất trong $1"; fi
}
hasnt() {  # hasnt <file> <regex> <mô tả>
  if [[ ! -f "$1" ]]; then bad "$3 — thiếu file $1"
  elif grep -qE -- "$2" "$1"; then bad "$3 — vẫn còn trong $1"
  else ok "$3"; fi
}

has   deploy/global-images/_lib.sh "export MSYS_NO_PATHCONV=1" \
      "_lib.sh: tắt path conversion của Git Bash"
has   deploy/global-images/start-memory-core.sh 'code=$("$CURL" -sS' \
      "start-memory-core.sh: verify_user_key dùng \$CURL"
has   deploy/global-images/start-memory-core.sh 'init_resp=$("$CURL" -sS' \
      "start-memory-core.sh: init-admin dùng \$CURL"
hasnt deploy/global-images/start-memory-core.sh '\$\(/usr/bin/curl' \
      "start-memory-core.sh: không còn hardcode /usr/bin/curl"
has   deploy/global-images/start-memory-core.sh "127.0.0.1" \
      "start-memory-core.sh: gọi 127.0.0.1 thay localhost (Windows resolve ::1)"
# Dòng gán đè phải biến mất để fallback trong _lib.sh còn tác dụng.
hasnt deploy/global-images/verify.sh '^CURL=' \
      "verify.sh: không đè lên \$CURL mà _lib.sh đã resolve"

# ─── 1c. MCP server riêng ─────────────────────────────────────────────
echo "1c. custom/mcp-shared-memory"
if git ls-files --error-unmatch custom/mcp-shared-memory/package-lock.json >/dev/null 2>&1; then
  ok "package-lock.json được git theo dõi (pin version)"
else
  bad "package-lock.json KHÔNG được theo dõi — .gitignore của upstream đè mất negation?"
fi
if [[ ! -d "$CUSTOM_DIR/mcp-shared-memory/node_modules" ]]; then
  bad "chưa cài dependency — (cd custom/mcp-shared-memory && npm install)"
else
  run_test() {  # run_test <file> <mô tả>
    local out; out="$(mktemp)"
    if node "$CUSTOM_DIR/mcp-shared-memory/test/$1" >"$out" 2>&1; then
      ok "$2"
    else
      bad "$2 — FAIL:"; sed 's/^/     /' "$out"
    fi
    rm -f "$out"
  }
  run_test smoke.mjs         "smoke test (13 tool, stdout sạch JSON-RPC)"
  run_test project-mode.mjs  "chế độ project (project id → wiki riêng, cache 1 lần)"
  run_test project-retry.mjs "đường lỗi chế độ project (API chết vẫn lên, retry được)"
  run_test env-precedence.mjs "env của agent thắng local.env (điều kiện của multi-tenant)"
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
# So bằng dấu vân tay chứ không nhúng token đã lộ vào file này.
LEAKED_TOKEN_FP="ae6425817aa3467c"
if [[ -f "$CUSTOM_DIR/env/local.env" ]]; then
  cur="$(grep -m1 '^KNOWLEDGE_API_TOKEN=' "$CUSTOM_DIR/env/local.env" | cut -d= -f2-)"
  if [[ -n "$cur" ]] && [[ "$(printf '%s' "$cur" | shasum -a 256 | cut -c1-16)" == "$LEAKED_TOKEN_FP" ]]; then
    bad "local.env VẪN dùng token đã lộ lên repo public — chạy: bash custom/set-token.sh"
  else
    ok "local.env không còn dùng token đã lộ"
  fi
  perm="$(stat -f '%Lp' "$CUSTOM_DIR/env/local.env" 2>/dev/null || stat -c '%a' "$CUSTOM_DIR/env/local.env" 2>/dev/null)"
  if [[ "$perm" == "600" ]]; then ok "local.env quyền 600"
  else bad "local.env quyền $perm — nên là 600: chmod 600 custom/env/local.env"; fi
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
