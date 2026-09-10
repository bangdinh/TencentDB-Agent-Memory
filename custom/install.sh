#!/usr/bin/env bash
# Sinh các file cấu hình agent ở thư mục gốc repo từ template trong custom/agents-config/.
#
# Các file sinh ra đều nằm trong .gitignore: custom/ là nguồn sự thật duy nhất.
# Chạy lại script này sau khi clone, sau khi đổi template, hoặc sau khi đổi máy.
set -euo pipefail

CUSTOM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$CUSTOM_DIR/.." && pwd)"
SRC="$CUSTOM_DIR/agents-config"

# ─── Xác định cách gọi MCP server theo hệ điều hành ────────────────────
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    # Git Bash trên Windows: cần đường dẫn kiểu Windows, escape cho JSON
    win_root="$(cd "$REPO_ROOT" && pwd -W 2>/dev/null || echo "$REPO_ROOT")"
    bat_path="${win_root//\//\\}\\custom\\scripts\\start-mcp.bat"
    MCP_COMMAND="cmd.exe"
    MCP_ARGS="[\"/c\", \"${bat_path//\\/\\\\}\"]"
    ;;
  *)
    MCP_COMMAND="bash"
    MCP_ARGS="[\"$REPO_ROOT/custom/scripts/start-mcp.sh\"]"
    ;;
esac

render() {  # render <src> <dest>
  mkdir -p "$(dirname "$2")"
  sed -e "s|__MCP_COMMAND__|$MCP_COMMAND|g" \
      -e "s|__MCP_ARGS__|$MCP_ARGS|g" \
      "$1" > "$2"
  echo "  → ${2#$REPO_ROOT/}"
}

echo "Sinh cấu hình agent vào $REPO_ROOT"

render "$SRC/clinerules"                "$REPO_ROOT/.clinerules"
render "$SRC/cursorrules"               "$REPO_ROOT/.cursorrules"
render "$SRC/AGENTS.md"                 "$REPO_ROOT/AGENTS.md"
render "$SRC/CLAUDE.md"                 "$REPO_ROOT/CLAUDE.md"
render "$SRC/copilot-instructions.md"   "$REPO_ROOT/.github/copilot-instructions.md"
render "$SRC/vscode-mcp.json"           "$REPO_ROOT/.vscode/mcp.json"

# .agents/ giữ nguyên cây thư mục
rm -rf "$REPO_ROOT/.agents"
while IFS= read -r f; do
  render "$f" "$REPO_ROOT/.agents/${f#$SRC/agents/}"
done < <(find "$SRC/agents" -type f)

# ─── Nhắc về file env ─────────────────────────────────────────────────
if [[ ! -f "$CUSTOM_DIR/env/local.env" ]]; then
  echo
  echo "⚠️  Chưa có custom/env/local.env — MCP server sẽ không chạy được."
  echo "    cp custom/env/local.env.example custom/env/local.env"
  echo "    rồi điền KNOWLEDGE_API_TOKEN / TEAM_ID / WIKI_ID."
fi

if [[ ! -d "$CUSTOM_DIR/mcp-shared-memory/node_modules" ]]; then
  echo
  echo "⚠️  MCP server chưa cài dependency."
  echo "    (cd custom/mcp-shared-memory && npm ci)"
fi

echo
echo "✅ Xong."
