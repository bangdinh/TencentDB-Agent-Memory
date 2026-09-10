#!/usr/bin/env bash
# Cập nhật KNOWLEDGE_API_TOKEN trong custom/env/local.env.
#
#   bash custom/set-token.sh
#
# Token nhập kín, không hiện lên màn hình, không vào shell history, không in ra
# log. Dùng mỗi khi rotate key. Chỉ sửa đúng một dòng, các biến khác giữ nguyên.
set -euo pipefail

CUSTOM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$CUSTOM_DIR/env/local.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Thiếu $ENV_FILE — chạy: cp custom/env/local.env.example custom/env/local.env" >&2
  exit 1
fi

# Chốt an toàn: file này tuyệt đối không được để git theo dõi.
cd "$CUSTOM_DIR/.."
if git ls-files --error-unmatch custom/env/local.env >/dev/null 2>&1; then
  echo "DỪNG: custom/env/local.env đang bị git theo dõi. Gỡ ra trước:" >&2
  echo "  git rm --cached custom/env/local.env" >&2
  exit 1
fi

printf 'Dán KNOWLEDGE_API_TOKEN mới (không hiện lên màn hình): '
read -rs TOKEN
printf '\n'

if [[ -z "$TOKEN" ]]; then
  echo "Token rỗng — không thay đổi gì." >&2
  exit 1
fi
if [[ "$TOKEN" == *$'\n'* || "$TOKEN" == *$'\r'* ]]; then
  echo "Token chứa ký tự xuống dòng — có vẻ dán nhầm. Không thay đổi gì." >&2
  exit 1
fi

TMP="$(mktemp)"
chmod 600 "$TMP"
# Ghi lại từng dòng bằng bash, không đưa token qua sed/awk (tránh lọt vào ps/args).
found=0
while IFS= read -r line || [[ -n "$line" ]]; do
  if [[ "$line" == KNOWLEDGE_API_TOKEN=* ]]; then
    printf 'KNOWLEDGE_API_TOKEN=%s\n' "$TOKEN" >> "$TMP"
    found=1
  else
    printf '%s\n' "$line" >> "$TMP"
  fi
done < "$ENV_FILE"
[[ "$found" -eq 1 ]] || printf 'KNOWLEDGE_API_TOKEN=%s\n' "$TOKEN" >> "$TMP"

mv "$TMP" "$ENV_FILE"
chmod 600 "$ENV_FILE"

# Chỉ in dấu vân tay, không in token.
fp="$(printf '%s' "$TOKEN" | shasum -a 256 | cut -c1-8)"
len=${#TOKEN}
unset TOKEN

echo "✅ Đã cập nhật $ENV_FILE"
echo "   độ dài $len ký tự, sha256 bắt đầu bằng $fp"
echo "   (đối chiếu dấu vân tay này với token trong MemoryCore để chắc dán đúng)"
echo
echo "Khởi động lại MCP server để nạp token mới:"
echo "   bạn chỉ cần restart agent / VS Code — start-mcp.sh đọc lại local.env mỗi lần chạy."
