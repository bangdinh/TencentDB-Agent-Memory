# Hướng dẫn cài đặt & sử dụng bộ nhớ chung (TencentDB Agent Memory)

Tài liệu cho fork này. Mọi customize nằm trong `custom/` — xem
[`custom/README.md`](../README.md) để biết cấu trúc và cách sync upstream.

> Đường dẫn trong tài liệu này đều **tương đối so với thư mục gốc repo**.
> Chạy lệnh từ đó, không phải từ `custom/`.

---

## 1. Kiến trúc

Hệ thống gồm 3 container Docker, cộng một MCP server chạy ngoài Docker:

| Thành phần | Địa chỉ | Vai trò |
|---|---|---|
| **Memory Core** | `http://localhost:8420` | Người dùng, phân quyền (RBAC), metadata, vector DB |
| **Memory Hub** | Panel `:8125` · Knowledge API `:8424` | Giao diện quản lý + API Wiki/Code Graph |
| **Memory Proxy** | `http://localhost:8096` | Proxy LLM, tự tiêm ngữ cảnh nhớ vào coding agent |
| **MCP server** | stdio, không có cổng | Cầu nối giữa agent và Knowledge API |

**MCP server do agent tự khởi động**, bạn không chạy tay. Nó nằm ở
`custom/mcp-shared-memory/` — là code riêng của fork, không phải của upstream.
Nếu gọi `custom/scripts/start-mcp.sh` ngoài terminal, nó sẽ đứng im chờ JSON-RPC:
đúng như thiết kế, không phải lỗi.

---

## 2. Yêu cầu

- **Docker Desktop** đang chạy (Windows: bật WSL 2 backend)
- **Node.js ≥ 20**
- **API key LLM**: Gemini, OpenAI, hoặc bất kỳ endpoint tương thích OpenAI
- **Windows**: nên dùng Git Bash. Các script `.bat` gọi sang Git Bash ở
  `C:\Program Files\Git\bin\bash.exe`
- **macOS/Linux**: dùng bản `.sh`, không cần gì thêm

---

## 3. Cài lần đầu trên một máy

```bash
cp custom/env/local.env.example custom/env/local.env
bash custom/set-token.sh
(cd custom/mcp-shared-memory && npm ci)
bash custom/install.sh
bash custom/scripts/start.sh
```

Giải thích từng bước:

**`set-token.sh`** — nhập `KNOWLEDGE_API_TOKEN` (lấy từ Memory Core). Token nhập
kín, không hiện lên màn hình, không vào shell history. Các biến khác trong
`local.env` (`KNOWLEDGE_TEAM_ID`, `KNOWLEDGE_WIKI_ID`…) sửa tay bằng editor.

**`npm ci`** — cài dependency cho MCP server. Dùng `npm ci` chứ đừng
`npm install`, để khỏi làm trôi `package-lock.json`.

**`install.sh`** — sinh cấu hình agent ra thư mục gốc repo, **tự điền đường dẫn
thật của máy đang chạy**. Không còn phải sửa tay đường dẫn tuyệt đối như trước.

**`start.sh`** — gọi `deploy/global-images/start-all.sh`, chạy **tương tác**:
tự copy `.env` từ `.env.example` nếu chưa có, hỏi LLM key cho nhóm memory và
nhóm proxy, kiểm tra thông mạng rồi mới dựng container. Enter để giữ giá trị cũ.

Kiểm tra sau khi cài:

```bash
bash custom/verify.sh
```

Hoặc mở Panel UI `http://localhost:8125`, health check `http://localhost:8424/health`.

---

## 4. Dùng hằng ngày

```bash
bash custom/scripts/start.sh    # bật stack
bash custom/scripts/stop.sh     # tắt stack
```

Windows: `custom\scripts\start.bat` / `stop.bat`.

MCP server tự lên khi mở agent. Sửa `local.env` xong chỉ cần **restart agent**,
không phải build lại — script đọc lại file env mỗi lần khởi động.

Muốn nâng cấp image lên bản mới nhất:

```bash
cd deploy/global-images && PULL=1 ./start-all.sh
```

---

## 5. Cấu hình cho từng AI agent

`install.sh` đã sinh sẵn phần lớn. Bảng dưới nói rõ cái nào tự động, cái nào
còn phải làm tay:

| Agent | MCP đăng ký | Rule tự động |
|---|---|---|
| VS Code / Copilot | ✅ `.vscode/mcp.json` | ✅ `.github/copilot-instructions.md` |
| Cline / Roo Code | ✅ `.vscode/mcp.json` | ✅ `.clinerules` |
| Antigravity | ✅ `.agents/mcp_config.json` | ✅ `AGENTS.md` + `.agents/rules/` |
| Cursor | ❌ tự khai (xem dưới) | ✅ `.cursorrules` |
| Claude Code | ❌ tự khai (xem dưới) | ✅ `CLAUDE.md` |
| Claude Desktop | ❌ tự khai (xem dưới) | copy `CLAUDE.md` vào Custom Instructions |

> Mọi file sinh ra ở gốc repo **đều đã gitignore**. Muốn sửa nội dung rule thì
> sửa trong `custom/agents-config/` rồi chạy lại `bash custom/install.sh`,
> đừng sửa trực tiếp bản ở gốc — lần install sau sẽ ghi đè mất.

### Lệnh khởi động MCP để khai tay

macOS/Linux:

```
bash <ĐƯỜNG_DẪN_REPO>/custom/scripts/start-mcp.sh
```

Windows:

```
cmd.exe /c <ĐƯỜNG_DẪN_REPO>\custom\scripts\start-mcp.bat
```

Lấy đường dẫn tuyệt đối bằng `pwd` (macOS/Linux) hoặc `cd` (Windows) ở gốc repo.

### Cursor

Settings → Features → MCP → Add new MCP Server, hoặc tạo `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "tencent-memory": {
      "command": "bash",
      "args": ["/ĐƯỜNG_DẪN_REPO/custom/scripts/start-mcp.sh"]
    }
  }
}
```

Windows thì `"command": "cmd.exe"` và `"args": ["/c", "C:\\...\\custom\\scripts\\start-mcp.bat"]`.

### Claude Code (CLI)

```bash
claude mcp add tencent-memory -- bash /ĐƯỜNG_DẪN_REPO/custom/scripts/start-mcp.sh
claude mcp list
```

### Claude Desktop

Sửa file config:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Thêm vào `mcpServers` theo mẫu Cursor ở trên. Thoát hẳn Claude Desktop (kể cả
icon ở khay hệ thống) rồi mở lại. Biểu tượng 🔨 sẽ hiện các tool `wiki_*`, `code_*`.

---

## 6. Tách bộ nhớ theo project (multi-tenant)

Mặc định mọi project dùng chung một wiki. Muốn mỗi project một vùng nhớ riêng
trên **cùng một stack**:

```bash
bash custom/new-project.sh <project-id> /đường/dẫn/tới/project
```

Lệnh ghi `.vscode/mcp.json`, `.agents/mcp_config.json`, `.cursor/mcp.json` vào
project đó (không ghi đè file có sẵn — nếu đã có nó in ra khối cần thêm tay),
và in luôn lệnh `claude mcp add` cho Claude Code.

Điểm mấu chốt: chỉ `KNOWLEDGE_PROJECT_ID` là khai riêng cho từng project, còn
token / API URL / team id vẫn dùng chung từ `custom/env/local.env`.

```json
{
  "servers": {
    "tencent-memory": {
      "type": "stdio",
      "command": "bash",
      "args": ["/ĐƯỜNG_DẪN_REPO/custom/scripts/start-mcp.sh"],
      "env": { "KNOWLEDGE_PROJECT_ID": "cueos" }
    }
  }
}
```

**Cách hoạt động**

Lần đầu agent gọi một tool `wiki_*`, server gọi `/wiki/create` với
`name = <project id>`. Endpoint này idempotent theo `(service_id, team_id, name)`
nên đã có thì trả về wiki cũ, chưa có thì tạo — bạn không phải tạo tay. Wiki id
phân giải được sẽ cache cho tới khi tắt tiến trình.

**Thứ tự ưu tiên khi chọn wiki**

1. `wiki_id` agent truyền thẳng vào tool
2. Wiki của `KNOWLEDGE_PROJECT_ID` (nếu có)
3. `KNOWLEDGE_WIKI_ID`

Có `KNOWLEDGE_PROJECT_ID` thì `KNOWLEDGE_WIKI_ID` bị bỏ qua hoàn toàn.

**Khi stack đang tắt**

Việc phân giải là *lười*, không chạy lúc khởi động — nên MCP server vẫn lên bình
thường dù Docker chưa bật, agent không báo "server failed to start". Tool sẽ trả
lỗi nói rõ nguyên nhân, và bật stack lên gọi lại là chạy (thất bại không bị cache).

**Cách ly mạnh hơn**

Wiki riêng đã tách hoàn toàn nội dung: mỗi wiki là một thư mục `.md` + `index.db`
riêng. Muốn tách cả ở tầng liệt kê (project này không thấy wiki của project kia
khi gọi `/wiki/list`) thì cho project dùng `KNOWLEDGE_TEAM_ID` riêng — thêm biến
đó vào cùng khối `env`. Trục tenancy của hệ thống là `(service_id, team_id)`.

---

## 7. Cơ chế: bộ nhớ tự động, không cần ra lệnh

Bạn **không cần** nói *"lưu vào bộ nhớ"* hay *"tìm trong bộ nhớ"*. Rule trong
`custom/agents-config/` dạy agent tự làm:

1. **Tự ghi (`wiki_write`)** — khi bạn nhắc tới thông tin mới: tên tuổi, sở
   thích, cấu hình kỹ thuật, quy ước dự án, deadline, ghi chú…
2. **Tự tra (`wiki_search`)** — khi bạn hỏi câu gợi nhớ quá khứ hoặc liên quan
   tới cấu hình hệ thống, agent tìm trong bộ nhớ trước khi trả lời.

`wiki_id` và `team_id` được MCP server tự điền từ `KNOWLEDGE_WIKI_ID` /
`KNOWLEDGE_TEAM_ID` trong `local.env`, nên agent không phải truyền mỗi lần gọi.

> ⚠️ Wiki này **dùng chung cho mọi agent và mọi người trong team**. Cân nhắc kỹ
> trước khi để rule tự lưu mật khẩu, API key hay thông tin nhạy cảm vào đó.

---

## 8. Danh sách 13 tool MCP

**Wiki (5)**

| Tool | Tham số bắt buộc | Chức năng |
|---|---|---|
| `wiki_write` | `title`, `content` | Ghi/cập nhật một trang vào bộ nhớ chung |
| `wiki_search` | `query` | Tìm theo từ khoá (BM25), có thể mở rộng theo đồ thị |
| `wiki_read` | `refs` (mảng) | Đọc nội dung một hoặc nhiều trang |
| `wiki_list` | — | Liệt kê mọi trang kèm metadata |
| `wiki_graph` | — | Lấy đồ thị liên kết giữa các trang |

**Code Graph (8)**

| Tool | Tham số bắt buộc | Chức năng |
|---|---|---|
| `code_search` | `code_graph_id`, `query` | Tìm symbol theo tên, chỉ trả vị trí |
| `code_explore` | `code_graph_id`, `query` | Tìm và trả kèm mã nguồn |
| `code_callers` | `code_graph_id`, `symbol` | Ai gọi hàm/class này |
| `code_callees` | `code_graph_id`, `symbol` | Hàm này gọi những gì |
| `code_impact` | `code_graph_id`, `symbol` | Phạm vi ảnh hưởng khi sửa |
| `code_node` | `code_graph_id`, `symbol` | Chi tiết một node |
| `code_status` | `code_graph_id` | Trạng thái index của code graph |
| `code_files` | `code_graph_id` | Danh sách file trong graph |

Nhóm `wiki_*` không cần truyền `wiki_id`; nhóm `code_*` giữ nguyên schema upstream.

---

## 9. Dữ liệu lưu ở đâu, dùng DB gì

**Mặc định không có DB server riêng.** Toàn bộ là SQLite + file trên đĩa, nằm
trong Docker named volume — nên gỡ container không mất dữ liệu, nhưng
`docker volume rm` thì mất sạch.

| Container | Volume | Mount | Chứa gì |
|---|---|---|---|
| memory-core | `tdai-memory-core-data` | `/data/tdai-memory` | L0/L1, profile, skill, metadata (team/user/agent/ACL), vector index |
| memory-hub | `tdai-panel-data` | `/data/knowledge` | Wiki + Code Graph |

### Memory Core

`MemoryCore/src/config.ts` khai ba backend, đổi bằng `MEMORY_CORE_STORE_MODE`
trong `deploy/global-images/.env`:

- **`sqlite`** — mặc định. SQLite cộng extension `sqlite-vec`, tức là **vector
  search chạy ngay trong file SQLite**, không cần dịch vụ ngoài.
- **`mongodb`** — thử nghiệm, mặc định tắt. Cần Mongo 7.0+ **có mongot** (Atlas
  hoặc `mongodb-atlas-local`) để dùng BM25 native; thiếu mongot thì báo lỗi lúc
  init chứ không âm thầm hạ cấp. Bật bằng `./start-all-mongo.sh`, dữ liệu vào DB
  `tdai_memory`, metadata tách sang `tdai_metadata_<instance>`.
- **`tcvdb`** — Tencent Cloud VectorDB, dịch vụ cloud.

Mã hoá sparse vector BM25 dùng package local `@tencentdb-agent-memory/tcvdb-text`,
không gọi ra ngoài.

### Knowledge — chỗ wiki của bạn nằm

Điểm đáng chú ý: **nội dung trang wiki là file `.md` thật trên đĩa, không nằm
trong DB.** SQLite ở đây chỉ đóng vai trò chỉ mục.

- Mỗi wiki có một file SQLite riêng `index.db`, đặt cùng thư mục với các `.md`,
  chứa `wiki_fts` (FTS5 cho BM25), `page_meta` (title/type/path/snippet),
  `graph_edge` (cạnh đồ thị cho tìm nhiều hop) và `source`.
- Ngoài ra có `knowledge.db` cấp service (`KNOWLEDGE_DB_PATH`, mặc định
  `./data/knowledge.db`) chạy qua drizzle + better-sqlite3.

Hệ quả thực tế: `wiki_write` cuối cùng chỉ là ghi một file markdown rồi cập nhật
chỉ mục. Bộ nhớ chung của bạn đọc được bằng mắt thường, không cần công cụ gì.

### Xem và backup

```bash
docker run --rm -v tdai-panel-data:/data alpine find /data -maxdepth 3
```

```bash
docker run --rm -v tdai-panel-data:/data -v "$PWD:/backup"   alpine tar czf /backup/knowledge-backup.tgz -C /data .
```

Đổi `tdai-panel-data` thành `tdai-memory-core-data` để làm tương tự với core.
Nhớ `stop.sh` trước khi backup, tránh chép trúng lúc SQLite đang ghi.

---

## 10. Xử lý lỗi

**Docker không khởi động**
Bật Docker Desktop trước khi chạy `start.sh`. Kiểm tra xung đột cổng
8420 / 8125 / 8424 / 8096.

**`AI_RetryError: Service Unavailable` khi ingest**
Máy chủ LLM quá tải (HTTP 503). Đợi 1–2 phút thử lại, hoặc đổi model trong
`deploy/global-images/.env`.

**Agent không thấy tool MCP**
Chạy smoke test — không cần stack đang chạy:

```bash
cd custom/mcp-shared-memory && node test/smoke.mjs
```

Pass mà agent vẫn không thấy thì lỗi ở khâu đăng ký: kiểm tra đường dẫn trong
file config của agent, rồi restart agent. Fail thì thường do chưa `npm ci`, hoặc
thiếu `custom/env/local.env`.

**Tool trả `Error: Không gọi được http://127.0.0.1:8424/...`**
Stack chưa chạy. `bash custom/scripts/start.sh`.

**Tool trả lỗi 401/403**
Token sai hoặc đã bị rotate. Chạy `bash custom/set-token.sh` rồi restart agent.

**Kiểm tra tổng thể**

```bash
bash custom/verify.sh
```

Script này soát: `MemoryKnowledge/` còn nguyên bản upstream không, patch Windows
trên `deploy/` còn không, MCP server có pass smoke test không, có rò rỉ token
không, và cấu hình agent ở gốc repo đã được sinh chưa.
