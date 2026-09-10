#!/usr/bin/env bash
# Kéo tính năng mới từ TencentCloud/TencentDB-Agent-Memory.
#
#   bash custom/sync-upstream.sh            # xem trước, không đổi gì
#   bash custom/sync-upstream.sh --merge    # merge thật
#
# LƯU Ý: fork này bám nhánh feat/server_team (dòng v2.x), KHÔNG phải main.
# upstream/main là một lineage khác hoàn toàn — merge vào sẽ hỏng repo.
set -euo pipefail

CUSTOM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$CUSTOM_DIR/.."
UPSTREAM_REF="${UPSTREAM_REF:-upstream/feat/server_team}"
DO_MERGE=0
[[ "${1:-}" == "--merge" ]] && DO_MERGE=1

if ! git remote get-url upstream >/dev/null 2>&1; then
  echo "Thêm remote upstream…"
  git remote add upstream https://github.com/TencentCloud/TencentDB-Agent-Memory.git
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "❌ Cây làm việc chưa sạch — commit hoặc stash trước đã." >&2
  exit 1
fi

echo "Fetch upstream…"
git fetch upstream --tags --quiet

echo
echo "── Commit upstream chưa có ở local ──"
git log --oneline "HEAD..$UPSTREAM_REF" || true
n=$(git rev-list --count "HEAD..$UPSTREAM_REF")
if [[ "$n" -eq 0 ]]; then echo "  (đã mới nhất)"; exit 0; fi

echo
echo "── Thử merge (dry-run) ──"
set +e
out=$(git merge-tree --write-tree --name-only HEAD "$UPSTREAM_REF" 2>&1); rc=$?
set -e
case "$rc" in
  0) echo "  ✅ Không conflict." ;;
  1) echo "  ⚠️  Sẽ conflict ở các file:"
     # dòng 1 là OID của tree; danh sách file nằm tới dòng trống đầu tiên
     echo "$out" | tail -n +2 | sed -n '/^$/q;p' | sed 's/^/     /' ;;
  *) echo "  ❌ Không merge được với $UPSTREAM_REF:" >&2
     echo "$out" | sed 's/^/     /' >&2
     echo "     (nhánh này có lineage khác — fork bám feat/server_team)" >&2
     exit 1 ;;
esac

if [[ "$DO_MERGE" -eq 0 ]]; then
  echo
  echo "Chạy lại với --merge để merge thật."
  exit 0
fi

TAG="backup/pre-sync-$(date +%Y%m%d-%H%M%S)"
git tag "$TAG"
echo
echo "Đã tạo tag khôi phục: $TAG  (git reset --hard $TAG để quay lại)"
git merge --no-edit "$UPSTREAM_REF"

echo
bash "$CUSTOM_DIR/install.sh"
echo
bash "$CUSTOM_DIR/verify.sh"
