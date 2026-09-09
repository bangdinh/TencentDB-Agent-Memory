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
