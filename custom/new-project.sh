#!/usr/bin/env bash
# ⚠️  ĐÃ THAY THẾ — dùng custom/provision-project.mjs.
#
#     node custom/provision-project.mjs <project-id> <thư-mục-project>
#
# Script này đặt team_id kiểu "team-<project-id>" do mình tự nghĩ ra. Knowledge
# chấp nhận (nó chỉ dùng team_id làm tên thư mục), nhưng MemoryCore KHÔNG biết
# team đó nên Panel :8125 không nhìn thấy và RBAC không áp được. Nó cũng không
# sinh .mcp.json (file Claude Code đọc), và không bootstrap wiki khỏi trạng thái
# draft — hệ quả là wiki_write báo thành công mà wiki_list trả rỗng.
# Giữ lại để tham khảo và cho trường hợp stack chưa chạy.
#
# Sinh cấu hình MCP cho MỘT project, với bộ nhớ tách riêng hoàn toàn.
#
#   bash custom/new-project.sh <project-id> [thư-mục-project] [--team <team-id>]
#
# Mỗi project được cấp RIÊNG cả team lẫn wiki:
#   - team_id mặc định = "team-<project-id>", đổi bằng --team
#   - wiki tên = "<project-id>", tự tạo ở lần gọi tool đầu tiên
#
# team_id là một cấp thư mục thật trên đĩa (data/<service_id>/<team_id>/...),
# nên tách team là cách ly vật lý: project này không đọc được, cũng không liệt kê
# được wiki của project kia.
set -euo pipefail

CUSTOM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PROJECT_ID=""
TARGET_DIR=""
TEAM_ID=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --team) TEAM_ID="${2:-}"; shift 2 ;;
    --team=*) TEAM_ID="${1#*=}"; shift ;;
    -h|--help)
      sed -n '2,14p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) echo "Tham số lạ: $1" >&2; exit 1 ;;
    *)
      if [[ -z "$PROJECT_ID" ]]; then PROJECT_ID="$1"
      elif [[ -z "$TARGET_DIR" ]]; then TARGET_DIR="$1"
      else echo "Thừa tham số: $1" >&2; exit 1; fi
      shift ;;
  esac
done

# Knowledge nối các id này thành đường dẫn file nên chỉ nhận [A-Za-z0-9_-],
# tối đa 200 ký tự (MemoryKnowledge/src/api-helpers.ts). Siết đúng luật đó ở đây
# để lỗi hiện ra ngay lúc tạo config, thay vì thành lỗi 400 khó hiểu lúc chạy.
valid_segment() { [[ "$1" =~ ^[A-Za-z0-9_-]+$ && ${#1} -le 200 ]]; }

if [[ -z "$PROJECT_ID" ]]; then
  echo "Dùng: bash custom/new-project.sh <project-id> [thư-mục-project] [--team <team-id>]" >&2
  exit 1
fi
if ! valid_segment "$PROJECT_ID"; then
  echo "project-id chỉ được gồm A-Z a-z 0-9 _ - (không dấu chấm), tối đa 200 ký tự." >&2
  echo "Nhận được: '$PROJECT_ID'" >&2
  exit 1
fi

TEAM_ID="${TEAM_ID:-team-$PROJECT_ID}"
if ! valid_segment "$TEAM_ID"; then
  echo "team-id chỉ được gồm A-Z a-z 0-9 _ - , tối đa 200 ký tự. Nhận được: '$TEAM_ID'" >&2
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
        "KNOWLEDGE_PROJECT_ID": "$PROJECT_ID",
        "KNOWLEDGE_TEAM_ID": "$TEAM_ID"
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

echo "Project : $PROJECT_ID"
echo "Team    : $TEAM_ID"
echo "Wiki    : sẽ tự tạo với tên \"$PROJECT_ID\" trong team trên"
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

  claude mcp add tencent-memory \\
    --env KNOWLEDGE_PROJECT_ID=$PROJECT_ID \\
    --env KNOWLEDGE_TEAM_ID=$TEAM_ID \\
    -- $CLI_CMD

Ghi chú:
  - Token và API URL vẫn dùng chung từ custom/env/local.env. Chỉ project id và
    team id là riêng cho project này.
  - "$TEAM_ID" chưa được đăng ký trong MemoryCore. Với Knowledge thì không sao —
    nó chỉ dùng team_id làm cấp thư mục, và cách ly đã có hiệu lực ngay. Nhưng
    Panel UI sẽ không thấy team này và RBAC của MemoryCore không áp lên nó.
    Muốn đầy đủ thì tạo team trong MemoryCore trước (API /v3/meta/team/create ở
    cổng 8420, cần admin key trong deploy/global-images/.admin-key), rồi chạy
    lại lệnh này với --team <team_id thật>.
TXT
