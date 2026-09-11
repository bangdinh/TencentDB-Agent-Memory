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
| `docs/USER_GUIDE.md` | Hướng dẫn cài đặt & sử dụng (tiếng Việt) |
| `mcp-shared-memory/` | **MCP server riêng** — thay cho việc patch `MemoryKnowledge/src/mcp/` |
| `patches/` | Diff của những chỗ **buộc phải sửa trực tiếp** trên code upstream |
| `install.sh` / `install.bat` | Sinh cấu hình agent ra gốc repo |
| `set-token.sh` | Đổi `KNOWLEDGE_API_TOKEN` (nhập kín, không lộ ra history/log) |
| `new-project.sh` | Sinh MCP config cho một project ở chế độ bộ nhớ riêng |
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

## Đổi token

```bash
bash custom/set-token.sh
```

Token nhập kín — không hiện trên màn hình, không vào shell history, không đi qua
`sed`/`awk` nên cũng không lộ trong `ps`. Script chỉ sửa đúng dòng
`KNOWLEDGE_API_TOKEN`, giữ nguyên các biến khác, đặt quyền file về `600`, rồi in
dấu vân tay sha256 8 ký tự để bạn đối chiếu với token trong MemoryCore.

`verify.sh` có một chốt riêng cho việc này: nếu `local.env` vẫn đang dùng token
từng bị commit lên repo public (commit `29c8534`), nó báo đỏ. So sánh bằng dấu
vân tay, không nhúng token đã lộ vào file nào cả.

MCP server đọc lại `local.env` mỗi lần khởi động, nên đổi token xong chỉ cần
restart agent / VS Code, không phải build lại gì.

## Tách bộ nhớ theo project (multi-tenant)

Mặc định mọi agent dùng chung một wiki. Muốn mỗi project một vùng nhớ riêng
trên cùng một stack:

```bash
bash custom/new-project.sh cueos /đường/dẫn/tới/project
```

Mỗi project được cấp **riêng cả team lẫn wiki**:

| | Giá trị | Đổi bằng |
|---|---|---|
| `KNOWLEDGE_PROJECT_ID` | `cueos` | tham số thứ nhất |
| `KNOWLEDGE_TEAM_ID` | `team-cueos` | `--team <team-id>` |
| Wiki | tên `cueos`, tự tạo | — |

Lệnh ghi `.vscode/mcp.json`, `.agents/mcp_config.json`, `.cursor/mcp.json` vào
project đó (không ghi đè file có sẵn) và in lệnh `claude mcp add` tương ứng.

### Vì sao tách tới tận team

`team_id` là **một cấp thư mục thật trên đĩa**:
`data/<service_id>/<team_id>/<resource_id>/` (`MemoryKnowledge/src/api-helpers.ts`).
Tách team nghĩa là tách cây thư mục — project này không đọc được, và cũng không
**liệt kê** được wiki của project kia. Nếu chỉ tách ở tầng wiki thì nội dung có
riêng, nhưng `/wiki/list` trong cùng team vẫn thấy tên wiki của nhau.

### Cơ chế

- **Token và API URL vẫn dùng chung** từ `custom/env/local.env`; chỉ project id
  và team id là riêng. `start-mcp.sh` coi `local.env` là *giá trị mặc định* —
  biến nào agent đã truyền qua `env` thì giữ nguyên. Đây là điều kiện sống còn
  của tính năng này, có test riêng (`test/env-precedence.mjs`) canh chừng.
- Lần gọi tool `wiki_*` đầu tiên, server gọi `/wiki/create` với
  `name = <project id>`. Endpoint idempotent theo `(service_id, team_id, name)`
  nên đã có thì trả wiki cũ, chưa có thì tạo. Kết quả cache theo tiến trình.
- Thứ tự ưu tiên chọn wiki: `wiki_id` agent truyền thẳng → wiki của
  `KNOWLEDGE_PROJECT_ID` → `KNOWLEDGE_WIKI_ID`.
- Phân giải là **lười**, không phải lúc khởi động: stack tắt thì MCP server vẫn
  lên, tool báo lỗi rõ ràng, bật stack lên gọi lại là chạy — thất bại không cache.

### Giới hạn cần biết

Team suy ra kiểu `team-<project-id>` **chưa được đăng ký trong MemoryCore**.
Với Knowledge thì không sao — nó chỉ dùng `team_id` làm cấp thư mục và cột DB,
không kiểm tra team có tồn tại hay không, nên **cách ly có hiệu lực ngay**.
Nhưng Panel UI sẽ không thấy team đó và RBAC của MemoryCore không áp lên nó.

Muốn đầy đủ thì tạo team trong MemoryCore trước — API `/v3/meta/team/create`
ở cổng 8420, cần admin key trong `deploy/global-images/.admin-key` — rồi chạy
`new-project.sh <project> <thư-mục> --team <team_id thật>`.

Lưu ý định dạng: `project-id` và `team-id` chỉ nhận `A-Za-z0-9_-`, tối đa 200 ký
tự, **không có dấu chấm** — vì chúng bị nối thẳng vào đường dẫn file. Script
kiểm tra ngay lúc tạo config để khỏi nhận lỗi 400 khó hiểu lúc chạy.

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
