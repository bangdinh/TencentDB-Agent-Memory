# HƯỚNG DẪN CẤU HÌNH & SỬ DỤNG BỘ NHỚ CHUNG (TENCENTDB AGENT MEMORY)

Tài liệu này hướng dẫn chi tiết cách cài đặt, chạy hệ thống và cấu hình cho các AI Agent (**Antigravity**, **Claude Desktop**, **Claude Code**, **Cursor**, **VS Code / Cline / Roo Code**) dùng chung **Bộ Nhớ Bền Vững (Persistent Shared Memory)**.

---

## 1. TỔNG QUAN KIẾN TRÚC & CÁC DỊCH VỤ

Hệ thống TencentDB Agent Memory chạy qua 3 container Docker chính:
* **Panel UI** (`http://localhost:8125`): Giao diện web trực quan để quản lý các trang Wiki, Code Graph, Agent, xem logs và thống kê.
* **Knowledge API** (`http://localhost:8424`): API lưu trữ và trích xuất tri thức (Wiki & Code Graph), phục vụ MCP server.
* **Memory Core** (`http://localhost:8420`): Quản lý người dùng, phân quyền (RBAC), metadata và vector database.
* **Memory Proxy** (`http://localhost:8096`): Cổng proxy LLM tự động chặn và tiêm ngữ cảnh nhớ vào các coding agent.
* **MCP Server** (`start-mcp.bat`): Cầu nối chuẩn Model Context Protocol kết nối các AI (Antigravity, Claude, Cursor) với hệ sinh thái bộ nhớ.

---

## 2. YÊU CẦU TIỀN ĐỀ (PREREQUISITES)

1. **Hệ điều hành**: Windows 10/11 (khuyên dùng có Git Bash).
2. **Docker Desktop**: Đã cài đặt và đang bật (chọn WSL 2 backend).
3. **Node.js**: Phiên bản 18+ hoặc 20+.
4. **API Key LLM**: Google Gemini API Key hoặc OpenAI API Key.

---

## 3. CÁCH CHẠY HỆ THỐNG

### Bước 1: Cấu hình biến môi trường
Mở file `deploy/global-images/.env` (nếu chưa có thì copy từ `.env.example`):
```ini
# Cấu hình LLM cho Knowledge & Memory Core (ví dụ dùng Google Gemini)
MEMORY_LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
MEMORY_LLM_API_KEY=YOUR_GEMINI_API_KEY_HERE
MEMORY_LLM_MODEL=gemini-1.5-flash
MEMORY_LLM_PROTOCOL=openai

# Cấu hình LLM cho Proxy Upstream
PROXY_UPSTREAM_URL=https://generativelanguage.googleapis.com/v1beta/openai
PROXY_UPSTREAM_API_KEY=YOUR_GEMINI_API_KEY_HERE
PROXY_UPSTREAM_MODEL=gemini-1.5-flash
```

### Bước 2: Khởi động hệ thống
Mở terminal (PowerShell hoặc CMD) tại thư mục gốc dự án và chạy:
```powershell
.\start.bat
```
*(Script sẽ tự động khởi động các container Docker: `tdai-memory-core`, `tdai-memory-hub`, `tdai-proxy`).*

* Kiểm tra sức khỏe hệ thống:
  * Truy cập Panel UI: [http://localhost:8125](http://localhost:8125)
  * Kiểm tra API Knowledge: [http://localhost:8424/health](http://localhost:8424/health)

### Bước 3: Dừng hệ thống khi không sử dụng
```powershell
.\stop.bat
```

---

## 4. CẤU HÌNH CHO TỪNG AI AGENT

Bộ nhớ chung hoạt động thông qua **MCP (Model Context Protocol)** bằng script `start-mcp.bat`.

> **Lưu ý quan trọng**: Trước khi cấu hình, hãy mở file `start-mcp.bat` và đảm bảo đường dẫn đúng với thư mục trên máy bạn:
> ```bat
> cd /d "D:\path\to\TencentDB-Agent-Memory\MemoryKnowledge"
> ```

---

### A. Google Antigravity

Antigravity tự động tải cấu hình MCP trong thư mục `.agents` của workspace:

1. **File cấu hình MCP** (`.agents/mcp_config.json`):
   ```json
   {
     "mcpServers": {
       "tencent-memory": {
         "command": "cmd.exe",
         "args": [
           "/c",
           "D:\\path\\to\\TencentDB-Agent-Memory\\start-mcp.bat"
         ]
       }
     }
   }
   ```
2. **Quy tắc bộ nhớ tự động (Zero-Prompt Policy)**:
   File `AGENTS.md` tại thư mục gốc đã định nghĩa sẵn quy tắc tự động lưu (`wiki_write`) và tự động tìm (`wiki_search`). Antigravity sẽ tự động đọc file này mỗi phiên chat.

---

### B. Claude Desktop

1. Mở file cấu hình Claude Desktop:
   * Nhấn `Win + R`, nhập: `%APPDATA%\Claude\claude_desktop_config.json`
2. Thêm server `tencent-memory` vào mục `mcpServers`:
   ```json
   {
     "mcpServers": {
       "tencent-memory": {
         "command": "cmd.exe",
         "args": [
           "/c",
           "D:\\path\\to\\TencentDB-Agent-Memory\\start-mcp.bat"
         ]
       }
     }
   }
   ```
3. Khởi động lại Claude Desktop (thoát hoàn toàn ở khay Taskbar rồi bật lại).
4. Biểu tượng 🔨 (Tools) sẽ xuất hiện các công cụ: `wiki_write`, `wiki_read`, `wiki_search`, `wiki_list`, `code_search`...
5. Để Claude tự động đọc/ghi bộ nhớ mà không cần nhắc nhở, copy nội dung trong file `CLAUDE.md` vào phần **System Prompt / Custom Instructions** của Claude hoặc mở workspace có file `CLAUDE.md`.

---

### C. Claude Code (CLI)

Nếu sử dụng Claude Code trên terminal:
```bash
claude mcp add tencent-memory -- cmd.exe /c "D:\path\to\TencentDB-Agent-Memory\start-mcp.bat"
```
Kiểm tra kết nối:
```bash
claude mcp list
```

---

### D. Cursor

1. Trong dự án, tạo hoặc sửa file `.cursor/mcp.json` (hoặc mở Cursor -> Settings -> Features -> MCP -> Add new MCP Server):
   ```json
   {
     "mcpServers": {
       "tencent-memory": {
         "command": "cmd.exe",
         "args": [
           "/c",
           "D:\\path\\to\\TencentDB-Agent-Memory\\start-mcp.bat"
         ]
       }
     }
   }
   ```
2. File quy tắc hoạt động cho Cursor: File `.cursorrules` tại thư mục gốc đã kích hoạt quy tắc Proactive Memory.

---

### E. VS Code / Cline / Roo Code / GitHub Copilot

1. Cấu hình cho VS Code nằm tại `.vscode/mcp.json`:
   ```json
   {
     "servers": {
       "tencent-memory": {
         "type": "stdio",
         "command": "cmd.exe",
         "args": [
           "/c",
           "D:\\path\\to\\TencentDB-Agent-Memory\\start-mcp.bat"
         ]
       }
     }
   }
   ```
2. Các file rules tương ứng:
   * Cline: `.clinerules`
   * Copilot: `.github/copilot-instructions.md`

---

## 5. NGUYÊN TẮC HOẠT ĐỘNG: ZERO-PROMPT AUTONOMOUS MEMORY

Người dùng **KHÔNG BAO GIỜ** cần phải ra lệnh: *"Hãy lưu vào bộ nhớ"* hay *"Hãy tìm trong bộ nhớ"*. Các AI Agent được cấu hình hoạt động hoàn toàn tự động:

1. **Tự động ghi nhớ (`wiki_write`)**:
   Khi người dùng nhắc tới:
   * Thông tin cá nhân, thói quen, sở thích, thú cưng, tên tuổi...
   * Cấu hình kỹ thuật: IP server, tài khoản/mật khẩu test, domain, port, database schema, tech stack...
   * Quy tắc dự án: Code conventions, thư viện ưa thích, quy chuẩn đặt tên...
   * Ghi chú dặn dò: Lịch trình, deadline, task quan trọng...
   👉 AI sẽ **ngay lập tức âm thầm gọi `wiki_write`** để lưu lại vào Wiki chung.

2. **Tự động tra cứu (`wiki_search`)**:
   Khi người dùng hỏi bất kỳ câu hỏi nào gợi nhớ quá khứ hoặc liên quan đến cấu hình hệ thống:
   👉 AI sẽ **tự động gọi `wiki_search`** tìm trong bộ nhớ trước khi trả lời.

---

## 6. DANH SÁCH CÁC CÔNG CỤ MCP (TOOLS) ĐƯỢC CUNG CẤP

| Công cụ | Mô tả chức năng |
| :--- | :--- |
| `wiki_write` | Ghi hoặc cập nhật một trang tri thức vào bộ nhớ chung (`title`, `content`). |
| `wiki_read` | Đọc nội dung chi tiết của một trang wiki (`ref`). |
| `wiki_search` | Tìm kiếm ngữ nghĩa / từ khóa trên toàn bộ các trang trong Wiki (`query`). |
| `wiki_list` | Liệt kê danh sách tất cả các trang tri thức hiện có. |
| `wiki_graph` | Lấy đồ thị liên kết giữa các khái niệm và trang tài liệu. |
| `code_search` | Tìm kiếm ngữ nghĩa trong đồ thị mã nguồn (Code Graph). |
| `code_explore` | Khám phá cây thư mục mã nguồn và các file liên quan. |
| `code_callers` | Tìm các vị trí gọi đến một hàm/class cụ thể. |
| `code_callees` | Tìm các hàm/hàm phụ trợ mà một hàm đang gọi. |
| `code_impact` | Phân tích phạm vi ảnh hưởng khi chỉnh sửa một file/hàm. |

---

## 7. XỬ LÝ LỖI PHỔ BIẾN (TROUBLESHOOTING)

1. **Lỗi Docker không khởi động**:
   * Đảm bảo Docker Desktop đang chạy trước khi gõ `.\start.bat`.
   * Kiểm tra port bị xung đột: 8125, 8424, 8420, 8096.

2. **Lỗi `AI_RetryError: Service Unavailable` khi Ingest**:
   * Do máy chủ LLM (như Google Gemini) bị quá tải tạm thời (HTTP 503).
   * Khắc phục: Đợi 1-2 phút bấm thử lại, hoặc đổi sang model ổn định hơn trong `deploy/global-images/.env` (ví dụ `gemini-1.5-flash`).

3. **AI không nhận công cụ MCP**:
   * Kiểm tra terminal chạy thử `start-mcp.bat`. Nếu script báo lỗi đường dẫn node hoặc thư viện `tsx`, chạy `npm install` bên trong thư mục `MemoryKnowledge`.
   * Khởi động lại ứng dụng AI (Antigravity / Claude Desktop / Cursor) sau khi chỉnh sửa file json config.

---

## 8. CHIA SẺ HỆ THỐNG TRONG MẠNG LAN CHO MÁY KHÁC DÙNG CHUNG

Để đồng nghiệp hoặc các máy tính khác trong cùng mạng nội bộ (Wi-Fi/LAN) có thể kết nối vào hệ thống trên máy chủ của bạn:

### Bước 1: Mở cổng trên Windows Defender Firewall (Máy Host)
Chạy lệnh sau trên **PowerShell (Run as Administrator)** của máy host:
```powershell
New-NetFirewallRule -DisplayName "TencentDB-Agent-Memory" -Direction Inbound -LocalPort 8125,8096,8424,8420 -Protocol TCP -Action Allow
```

### Bước 2: Xác định IP máy Host và cấu hình Proxy URL
1. Gõ lệnh `ipconfig` trong terminal để xem IP card mạng Wi-Fi/Ethernet (ví dụ: `192.168.1.50`).
2. Mở file `deploy/global-images/.env` và cập nhật:
   ```properties
   MEMORY_HUB_PROXY_PUBLIC_URL=http://<IP_MÁY_BẠN>:8096
   # Ví dụ: MEMORY_HUB_PROXY_PUBLIC_URL=http://192.168.1.50:8096
   ```
3. Khởi động lại hệ thống: chạy `.\stop.bat` rồi `.\start.bat`.

### Bước 3: Cách máy khác kết nối sử dụng
* **Vào Web Dashboard**: Truy cập `http://<IP_MÁY_HOST>:8125` từ trình duyệt máy khác.
  * Instance: `default`
  * User Key đăng nhập: Lấy trong file `deploy/global-images/.admin-key`.
* **Dùng Proxy LLM (Cursor, Claude Code, Cline...)**:
  * Base URL: `http://<IP_MÁY_HOST>:8096/v1`
  * API Key: Lấy theo User Key đã tạo
  * Model: `gemini-flash-latest` (hoặc model đã cấu hình)
* **Dùng MCP Tool từ xa**: Trong file cấu hình MCP của máy khác, trỏ biến môi trường:
  ```json
  "env": {
    "KNOWLEDGE_API_URL": "http://<IP_MÁY_HOST>:8424",
    "KNOWLEDGE_API_TOKEN": "<YOUR_API_TOKEN>",
    "KNOWLEDGE_TEAM_ID": "team-default",
    "KNOWLEDGE_WIKI_ID": "wiki-9sr5qg3i"
  }
  ```

---

## 9. QUY TẮC PHÁT TRIỂN CODE TÙY BIẾN (THƯ MỤC `custom/`)

Dự án áp dụng **Mô hình Thư mục Độc lập (Independent Custom Folder)** để đảm bảo khi cập nhật mã nguồn gốc từ TencentCloud sẽ không bao giờ bị xung đột hoặc mất tính năng tự code:

```
custom/
├── services/          # Chứa microservice, background worker
│   └── README.md
├── agents/            # Chứa AI Agent tự viết dùng Shared Memory
│   └── README.md
├── mcp-tools/         # Chứa custom MCP server mở rộng (Jira, GitHub...)
│   └── README.md
├── scripts/           # Chứa script tự động hóa (backup, sync, clean)
│   └── README.md
├── .env.example       # Mẫu biến môi trường riêng cho custom/
└── start-custom.bat   # Script khởi chạy tập trung các custom services
```

### 4 Nguyên tắc cốt lõi:
1. **Bất khả xâm phạm 4 thư mục Core**: Tuyệt đối KHÔNG sửa, xóa, hoặc tạo file trong: `MemoryCore/`, `MemoryKnowledge/`, `MemoryPanel/`, `MemoryProxy/`.
2. **Khu vực làm việc duy nhất**: Mọi tính năng custom phải nằm hoàn toàn trong thư mục `custom/`.
3. **Chỉ giao tiếp qua API / SDK**: Code trong `custom/` chỉ giao tiếp với Core qua:
   - REST API: `http://127.0.0.1:8420` (Core), `http://127.0.0.1:8424` (Knowledge)
   - SDK: `sdk/memory-core/typescript` hoặc `sdk/memory-core/python`
   - *Tuyệt đối không import trực tiếp source code của core.*
4. **Cấu hình độc lập**: Sử dụng `custom/.env` riêng, không ghi đè vào `.env` gốc của hệ thống.

---

## 10. SAO LƯU & PHỤC HỒI DỰ PHÒNG (BACKUP & RESTORE)

Hệ thống đã tích hợp sẵn công cụ sao lưu toàn diện để an tâm thử nghiệm tính năng mới:

### Tạo bản sao lưu (Backup)
Chạy script tại thư mục gốc:
```cmd
.\backup.bat
```
Lựa chọn 2 chế độ:
* **[1] Full Backup**: Sao lưu toàn bộ mã nguồn `custom/`, file cấu hình (`.env`, `.admin-key`, `CLAUDE.md`, `mcp_config.json`) và toàn bộ **Docker Data Volumes** (`tdai-memory-core-data`, `tdai-panel-data`). Tự động tạm dừng container để nén dữ liệu SQLite/VectorDB mà không sợ hỏng database.
* **[2] Quick Backup**: Chỉ sao lưu mã nguồn `custom/` và cấu hình (chạy siêu nhanh trong **1 giây**, không cần dừng Docker). Thích hợp trước khi chuẩn bị sửa logic code.

*Dữ liệu backup được lưu trong thư mục `backups/backup_YYYYMMDD_HHMMSS/`.*

### Khôi phục khi gặp lỗi (Rollback / Restore)
Chạy script:
```cmd
.\restore.bat
```
1. Script sẽ hiển thị danh sách tất cả các bản backup kèm ngày giờ và ghi chú.
2. Nhập số thứ tự bản backup muốn khôi phục.
3. Bấm `Y` xác nhận. Toàn bộ code và cơ sở dữ liệu sẽ được đưa về chính xác trạng thái tại thời điểm backup.

---

## 11. GIẢI PHÁP TRÁNH "LOẠN BỘ NHỚ" KHI DÙNG NHIỀU PROJECT

Nếu bạn dùng 1 hệ thống TencentDB-Agent-Memory cho nhiều dự án khác nhau:
1. **Tách `wiki_id` riêng cho mỗi Project**:
   - Trên Web Panel, tạo 1 Wiki riêng cho từng project (ví dụ: `wiki-project-shop`, `wiki-project-blog`).
   - Trong file cấu hình MCP của từng project, truyền `KNOWLEDGE_WIKI_ID` tương ứng vào `env`:
     ```json
     "env": {
       "KNOWLEDGE_WIKI_ID": "wiki-project-shop"
     }
     ```
2. **Cấu hình Dual MCP Server (1 IDE kết nối cùng lúc 2 Wiki)**:
   Khai báo 2 server trong file cấu hình MCP (`.agents/mcp_config.json` hoặc `claude_desktop_config.json`):
   ```json
   {
     "mcpServers": {
       "tencent-memory-agent": {
         "command": "node",
         "args": ["--no-warnings", "d:\\path\\MemoryKnowledge\\node_modules\\tsx\\dist\\cli.mjs", "d:\\path\\MemoryKnowledge\\src\\mcp\\server.ts"],
         "env": {
           "KNOWLEDGE_API_URL": "http://192.168.1.50:8424",
           "KNOWLEDGE_API_TOKEN": "<YOUR_API_TOKEN>",
           "KNOWLEDGE_TEAM_ID": "team-default",
           "KNOWLEDGE_WIKI_ID": "wiki-jeq1u9eq"
         }
       },
       "tencent-memory-cueos": {
         "command": "node",
         "args": ["--no-warnings", "d:\\path\\MemoryKnowledge\\node_modules\\tsx\\dist\\cli.mjs", "d:\\path\\MemoryKnowledge\\src\\mcp\\server.ts"],
         "env": {
           "KNOWLEDGE_API_URL": "http://192.168.1.50:8424",
           "KNOWLEDGE_API_TOKEN": "<YOUR_API_TOKEN>",
           "KNOWLEDGE_TEAM_ID": "team-default",
           "KNOWLEDGE_WIKI_ID": "wiki-9sr5qg3i"
         }
       }
     }
   }
   ```
3. **Quy ước đặt tên (Naming Convention)**:


