#!/usr/bin/env bash
# Sinh lại custom/patches/*.patch từ chênh lệch giữa upstream và cây làm việc.
# Dùng để: (1) xem chính xác mình đã sửa gì trên code upstream,
#          (2) khôi phục bằng `git apply` nếu một lần merge làm mất patch.
set -euo pipefail

CUSTOM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$CUSTOM_DIR/.."
UPSTREAM_REF="${UPSTREAM_REF:-upstream/feat/server_team}"

git rev-parse --verify -q "$UPSTREAM_REF" >/dev/null || {
  echo "Không thấy $UPSTREAM_REF — chạy: git fetch upstream" >&2; exit 1; }

gen() {  # gen <tên file patch> <path...>
  local name="$1"; shift
  local out="$CUSTOM_DIR/patches/$name"
  git diff "$UPSTREAM_REF" -- "$@" > "$out"
  if [[ -s "$out" ]]; then
    echo "  → patches/$name ($(grep -c '^@@' "$out") hunk)"
  else
    rm -f "$out"; echo "  (bỏ qua $name — không có thay đổi)"
  fi
}

echo "Sinh patch so với $UPSTREAM_REF"
# MemoryKnowledge KHÔNG còn patch nào — toàn bộ đã chuyển sang
# custom/mcp-shared-memory/. Dòng dưới là chốt chặn: nếu có ai lỡ sửa lại
# vào đó thì patch sẽ được sinh ra và verify.sh sẽ báo.
gen 001-memoryknowledge-KHONG-DUOC-CO.patch MemoryKnowledge/
gen 002-deploy-windows-compat.patch deploy/global-images/
echo "✅ Xong."
