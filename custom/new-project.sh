#!/usr/bin/env bash
# Sinh cấu hình MCP cho MỘT project, ở chế độ bộ nhớ riêng theo project id.
#
#   bash custom/new-project.sh <project-id>              # in ra màn hình
#   bash custom/new-project.sh <project-id> <thư-mục>    # ghi file vào project đó
#
# Mỗi project id ứng với một wiki riêng. Wiki được tra-hoặc-tạo tự động ở lần
# gọi tool đầu tiên (/wiki/create idempotent theo tên), không phải tạo tay.
set -euo pipefail

CUSTOM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PROJECT_ID="${1:-}"
TARGET_DIR="${2:-}"

if [[ -z "$PROJECT_ID" ]]; then
  echo "Dùng: bash custom/new-project.sh <project-id> [thư-mục-project]" >&2
  exit 1
fi
if ! [[ "$PROJECT_ID" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "project-id chỉ được gồm chữ, số, . _ - (nhận được: '$PROJECT_ID')" >&2
  exit 1
fi

case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    win_root="$(cd "$CUSTOM_DIR/.." && pwd -W 2>/dev/null || (cd "$CUSTOM_DIR/.." && pwd))"
    bat="${win_root//\//\\}\\custom\\scripts\\start-mcp.bat"
    MCP_COMMAND="cmd.exe"
    MCP_ARGS="[\"/c\", \"${bat//\\/\\\\}\"]"
    CLI_CMD="cmd.exe /c \"${bat}\""
    ;;
  *)
    sh_path="$(cd "$CUSTOM_DIR/.." && pwd)/custom/scripts/start-mcp.sh"
    MCP_COMMAND="bash"
    MCP_ARGS="[\"$sh_path\"]"
    CLI_CMD="bash $sh_path"
    ;;
esac

mcp_servers_json() {  # <khoá gốc> <có type stdio hay không>
  local root="$1" with_type="$2"
  cat <<JSON
{
  "$root": {
    "tencent-memory": {$( [[ "$with_type" == "yes" ]] && printf '\n      "type": "stdio",' )
      "command": "$MCP_COMMAND",
      "args": $MCP_ARGS,
      "env": {
        "KNOWLEDGE_PROJECT_ID": "$PROJECT_ID"
      }
    }
  }
}
JSON
}

write_if_absent() {  # <đường dẫn> <nội dung>
  if [[ -e "$1" ]]; then
    echo "  ⏭  $1 đã tồn tại — KHÔNG ghi đè. Tự thêm khối \"tencent-memory\" bên dưới vào đó."
    return 1
  fi
  mkdir -p "$(dirname "$1")"
  printf '%s\n' "$2" > "$1"
  echo "  ✅ $1"
  return 0
}

echo "Project: $PROJECT_ID"
echo

if [[ -n "$TARGET_DIR" ]]; then
  [[ -d "$TARGET_DIR" ]] || { echo "Không thấy thư mục: $TARGET_DIR" >&2; exit 1; }
  TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"
  echo "Ghi cấu hình vào $TARGET_DIR"
  all_written=1
  write_if_absent "$TARGET_DIR/.vscode/mcp.json"        "$(mcp_servers_json servers yes)"    || all_written=0
  write_if_absent "$TARGET_DIR/.agents/mcp_config.json" "$(mcp_servers_json mcpServers no)"  || all_written=0
  write_if_absent "$TARGET_DIR/.cursor/mcp.json"        "$(mcp_servers_json mcpServers no)"  || all_written=0
  echo
  [[ "$all_written" -eq 1 ]] || { echo "Khối cần thêm tay:"; echo; mcp_servers_json mcpServers no; echo; }
else
  echo "VS Code / Cline — .vscode/mcp.json:"; echo
  mcp_servers_json servers yes
  echo
  echo "Antigravity (.agents/mcp_config.json) và Cursor (.cursor/mcp.json):"; echo
  mcp_servers_json mcpServers no
  echo
fi

cat <<TXT
Claude Code (CLI), chạy TRONG thư mục project:

  claude mcp add tencent-memory --env KNOWLEDGE_PROJECT_ID=$PROJECT_ID -- $CLI_CMD

Ghi chú:
  - Token, API URL, team id vẫn lấy chung từ custom/env/local.env.
    Chỉ KNOWLEDGE_PROJECT_ID là khai riêng cho từng project.
  - Wiki tên "$PROJECT_ID" sẽ được tự tạo ở lần gọi tool đầu tiên nếu chưa có.
  - Muốn dùng team khác cho project này thì thêm "KNOWLEDGE_TEAM_ID" vào cùng
    khối "env" ở trên.
TXT
