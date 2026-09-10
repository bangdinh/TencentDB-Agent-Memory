# `custom/` — toàn bộ customize của fork này

Fork của [TencentCloud/TencentDB-Agent-Memory](https://github.com/TencentCloud/TencentDB-Agent-Memory).
Mục tiêu của thư mục này: **mọi thứ là của mình đều nằm ở đây**, để merge upstream
không đụng độ và để nhìn một chỗ là biết đã sửa gì.

> ⚠️ Fork bám nhánh **`feat/server_team`** (dòng v2.x: MemoryCore / MemoryKnowledge /
> MemoryPanel / MemoryProxy). `upstream/main` là lineage **khác hoàn toàn**
> (v0.x–v1.x, `memory-tencentdb` / Hermes) — merge vào sẽ báo *no merge base* và hỏng repo.

## Bắt đầu

```bash
cp custom/env/local.env.example custom/env/local.env   # rồi điền token thật
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

## Những chỗ buộc phải sửa trên code upstream

Đây là phần **chưa** tách được ra folder riêng — xem `patches/` để biết nội dung.
Nếu một lần merge làm mất chúng, `verify.sh` sẽ báo, và khôi phục bằng
`git apply custom/patches/00X-*.patch`.

**`001-memoryknowledge-mcp.patch`**

| File | Sửa gì | Vì sao |
|---|---|---|
| `MemoryKnowledge/src/logger.ts` | `console.log` → `console.error` | MCP stdio yêu cầu stdout chỉ chứa JSON-RPC; log ra stdout làm hỏng protocol |
| `MemoryKnowledge/src/mcp/http-client.ts` | thêm header `x-tdai-service-id` | MemoryCore cần header này để định tuyến service |
| `MemoryKnowledge/src/mcp/server.ts` | tự điền `wiki_id`/`team_id` từ env; sửa cách nhận diện entrypoint | Agent không phải truyền `wiki_id` mỗi lần; `import.meta.url === file://argv[1]` sai trên Windows |
| `MemoryKnowledge/src/mcp/tools.ts` | bỏ `wiki_id` khỏi `required`, thêm tool `wiki_write`, viết lại description | Để agent tự động gọi nhớ/tra cứu |

**`002-deploy-windows-compat.patch`** — `deploy/global-images/`: `MSYS_NO_PATHCONV=1`
cho Git Bash, dùng `curl` trong PATH thay vì hardcode `/usr/bin/curl`, gọi `127.0.0.1`
thay `localhost` (tránh IPv6 `::1`). Mấy fix này có ích cho mọi người —
đáng gửi PR ngược lên upstream để khỏi phải maintain.

## Bước tiếp theo: xoá hẳn `001-memoryknowledge-mcp.patch`

Cách dứt điểm là **không patch `MemoryKnowledge` nữa**: viết MCP server riêng ở
`custom/mcp-shared-memory/`, gọi thẳng HTTP API `/v3/wiki/*` của MemoryCore.
Khi đó default `wiki_id`, tool `wiki_write`, header service-id và cả chuyện
stdout/stderr đều nằm trong code của mình → `MemoryKnowledge` sạch 100%,
merge upstream vĩnh viễn không conflict. Patch hiện tại nhỏ nên viết lại chỉ ~150 dòng.
