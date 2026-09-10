#!/usr/bin/env bash
# Chạy deploy/global-images/start-all.sh trên macOS/Linux.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../../deploy/global-images"
exec bash start-all.sh
