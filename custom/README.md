# `custom/` — toàn bộ customize của fork này

Fork của [TencentCloud/TencentDB-Agent-Memory](https://github.com/TencentCloud/TencentDB-Agent-Memory).
Mục tiêu của thư mục này: **mọi thứ là của mình đều nằm ở đây**, để merge upstream
không đụng độ và để nhìn một chỗ là biết đã sửa gì.

> **Remote**: `origin` = `bangdinh/TencentDB-Agent-Memory` (fork thật của upstream,
> nhánh làm việc là `main`), `upstream` = `TencentCloud/TencentDB-Agent-Memory`.
>
> ⚠️ Fork bám nhánh **`feat/server_team`** (dòng v2.x: MemoryCore / MemoryKnowledge /
> MemoryPanel / MemoryProxy). `upstream/main` là lineage **khác hoàn toàn**
> (v0.x–v1.x, `memory-tencentdb` / Hermes) — merge vào sẽ báo *no merge base* và hỏng repo.

## Bắt đầu

```bash
cp custom/env/local.env.example custom/env/local.env   # rồi điền token thật
(cd custom/mcp-shared-memory && npm ci)                 # dependency của MCP server
bash custom/install.sh                                  # sinh cấu hình agent ra gốc repo
bash custom/verify.sh                                   # kiểm tra mọi thứ đúng chỗ
```

Trên Windows dùng `custom\install.bat`.

## Cấu trúc

| Đường dẫn | Là gì |
|---|---|
| `env/local.env` | Secret + ID local. **Đã gitignore, không bao giờ commit.** |
| `env/local.env.example` | Template có commit, dùng để biết cần khai báo biến nào |
| `agents-config/` | Nguồn sự thật của các file rule/MCP. `install.sh` sinh ra bản ở gốc repo |
| `scripts/` | `start-mcp`, `start`, `stop` cho cả macOS/Linux (`.sh`) và Windows (`.bat`) |
| `docs/HUONG_DAN_SU_DUNG.md` | Hướng dẫn sử dụng tiếng Việt |
| `mcp-shared-memory/` | **MCP server riêng** — thay cho việc patch `MemoryKnowledge/src/mcp/` |
| `patches/` | Diff của những chỗ **buộc phải sửa trực tiếp** trên code upstream |
| `install.sh` / `install.bat` | Sinh cấu hình agent ra gốc repo |
| `sync-upstream.sh` | Kéo tính năng mới từ upstream |
| `verify.sh` | Kiểm tra customize còn nguyên sau merge |
| `refresh-patches.sh` | Sinh lại `patches/*.patch` từ cây làm việc |

## File sinh ra ở gốc repo

`install.sh` sinh ra các file dưới đây và **tất cả đều đã được gitignore** —
sửa ở `custom/agents-config/` rồi chạy lại install, đừng sửa trực tiếp:

```
.agents/          .clinerules   .cursorrules   .vscode/mcp.json
AGENTS.md         CLAUDE.md     .github/copilot-instructions.md
```

Lý do phải sinh ra chứ không symlink: Git trên Windows mặc định không tạo symlink
thật, nên symlink sẽ biến thành file text vô nghĩa khi clone trên máy Windows.
Việc sinh file cũng thay luôn đường dẫn tuyệt đối của MCP server theo từng máy —
trước đây chỗ này hardcode `d:\lehuynhthuan\TencentDB-Agent-Memory\`.

## Kéo tính năng mới từ upstream

```bash
bash custom/sync-upstream.sh            # xem trước: có gì mới, có conflict không
bash custom/sync-upstream.sh --merge    # merge thật, tự chạy install + verify
```

Script dùng **merge** chứ không rebase, vì `main` đã push lên `origin` — rebase sẽ
rewrite history chung. Trước khi merge nó tự tạo tag `backup/pre-sync-<timestamp>`,
muốn quay lại thì `git reset --hard <tag>`.

Muốn bám bản ổn định thay vì tip nhánh thì merge theo tag release:

```bash
git fetch upstream --tags && git merge v2.0.2-beta.1
```

## MCP server riêng: `custom/mcp-shared-memory/`

Đây là chỗ chứa toàn bộ hành vi shared-memory. Trước kia những thứ này được vá
thẳng vào `MemoryKnowledge/src/mcp/` nên mỗi lần merge upstream là một lần rủi ro.
Giờ **`MemoryKnowledge/` giữ nguyên 100% bản upstream** — `verify.sh` chặn cứng,
sửa vào đó là fail.

| File | Việc |
|---|---|
| `src/server.ts` | MCP server stdio: list/call tool, tự điền `wiki_id`, map `wiki_write` sang shape `{team_id, wiki_id, pages[]}` |
| `src/tools.ts` | Lấy `MCP_TOOLS` của upstream rồi phủ lớp overlay lên: bỏ `wiki_id` khỏi `required`, đổi description, thêm `wiki_write` |
| `src/http.ts` | HTTP client, luôn gửi header `x-tdai-service-id` |
| `src/log.ts` | Log ra **stderr**, vì stdout dành riêng cho JSON-RPC |
| `src/config.ts` | Đọc cấu hình từ env |
| `test/smoke.mjs` | Bắt tay MCP thật, kiểm tra 13 tool và stdout sạch — không cần MemoryCore chạy |

Điểm đáng chú ý: `src/tools.ts` **import thẳng** `MCP_TOOLS` từ
`MemoryKnowledge/src/mcp/tools.ts` thay vì chép lại. Nhờ vậy 8 tool `code_*` tự
động bám theo upstream, không bị trôi. Đây là file duy nhất đọc vào source
upstream, và chỉ đọc chứ không sửa. Nếu upstream đổi tên hay dời file đó, server
chết ngay lúc khởi động với lỗi import rõ ràng — dễ thấy hơn hẳn kiểu patch âm
thầm biến mất sau một lần merge.

Chạy test:

```bash
cd custom/mcp-shared-memory && node test/smoke.mjs
```

`package-lock.json` **có commit**, dù `.gitignore` của upstream ignore nó (họ dùng
pnpm) — `.gitignore` có một dòng negation riêng cho nó. Lý do: server này chạy hằng
ngày, cần version giống hệt nhau trên mọi máy. Cài bằng `npm ci` chứ đừng
`npm install` để khỏi làm trôi lockfile.

## Chỗ duy nhất còn phải sửa trực tiếp upstream

`002-deploy-windows-compat.patch` — `deploy/global-images/`, cho Windows/Git Bash:

- `_lib.sh`: `export MSYS_NO_PATHCONV=1` (MSYS viết lại `-v /data/...` thành
  `-v C:/Program Files/Git/data/...`, mount trỏ sai chỗ mà không báo lỗi)
- `start-memory-core.sh`: dùng `$CURL` mà `_lib.sh` đã resolve, thay vì gọi thẳng
  `/usr/bin/curl` — Git Bash để curl ở `/mingw64/bin/curl`
- `verify.sh`: bỏ dòng gán đè `CURL=`, vì nó ghi đè đúng cái fallback vừa được
  `_lib.sh` tính ra
- `start-memory-core.sh`: hai lời gọi loopback đổi `localhost` → `127.0.0.1`
  (Windows resolve `localhost` ra `::1` trước, còn Docker chỉ publish IPv4)

Không tách ra folder riêng được vì đây là shell script deploy của upstream.
`verify.sh` kiểm tra chúng còn nguyên (cả check dương lẫn check âm); mất thì
khôi phục bằng `git apply custom/patches/002-deploy-windows-compat.patch`.

**Nội dung này khớp hệt bản đã gửi upstream ở
[PR #1330](https://github.com/TencentCloud/TencentDB-Agent-Memory/pull/1330)**
(base `feat/server_team`). Nếu PR được merge, `refresh-patches.sh` sẽ tự sinh ra
file rỗng và xoá `patches/002` — lúc đó fork hết chỗ phải patch upstream.

PR mở được là nhờ đây là fork thật của upstream. Trước đó repo dùng làm `origin`
là `bangdinh/agents-memory` — một repo độc lập chứ không phải GitHub fork
(`isFork: false`), nên GitHub từ chối mở PR chéo. Từ 2026-09-11, `origin` trỏ vào
`bangdinh/TencentDB-Agent-Memory` và repo cũ đã ngừng dùng.
