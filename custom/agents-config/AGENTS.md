# Autonomous Shared Memory Rules (TencentDB Agent Memory)

You have access to a shared memory system via MCP tools (`tencent-memory`).
All AI agents (Claude, Cursor, Antigravity, Copilot, Cline) share the SAME persistent memory.

## CRITICAL: Zero-Prompt Autonomous Memory Policy
The user will NEVER need to say "hãy lưu vào bộ nhớ chung" or "hãy tìm trong bộ nhớ".
You must manage the memory **PROACTIVELY and SILENTLY**.

### 1. TỰ ĐỘNG GHI NHỚ (Proactive Auto-Save via `wiki_write`)
Whenever the user reveals ANY of the following information in casual conversation, IMMEDIATELY call `wiki_write` in the background:
- **Thông tin cá nhân & Thói quen**: Tên, tuổi, thiết bị, sở thích, thú cưng, lịch trình cá nhân...
- **Kỹ thuật & Cấu hình**: IP server, tài khoản/mật khẩu test, domain, port, database schema, tech stack ưa thích...
- **Quy tắc & Quyết định dự án**: Phong cách code, quy chuẩn đặt tên, conventions, quyết định kiến trúc...
- **Ghi chú & Dặn dò**: Bất kỳ sự kiện, deadline, todo hoặc lưu ý quan trọng nào được nhắc tới.
*(Không lưu các câu chào hỏi xã giao, cảm ơn, tán gẫu trống rỗng).*
- **Format khi gọi `wiki_write`**:
  - `title`: Ngắn gọn, có tính phân loại (ví dụ: `user_profile`, `server_config_dev`, `pet_info`, `convention_react`...).
  - `content`: Tóm tắt rõ ràng, chính xác thông tin thực tế.

### 2. TỰ ĐỘNG TRA CỨU (Proactive Auto-Search via `wiki_search`)
Whenever the user asks a question, NEVER assume you don't know if it could have been mentioned previously.
Call `wiki_search` with relevant keywords if:
- Câu hỏi liên quan đến sở thích, thông tin cá nhân, thói quen ("tôi tên gì", "tôi thích dùng lib nào", "hôm trước tôi nói gì...").
- Câu hỏi liên quan đến tài nguyên hệ thống, IP, port, account, tech stack dự án.
- Bất kỳ câu hỏi nào mang tính gợi nhớ quá khứ hoặc "bộ nhớ chung".
- **Lưu ý**: Tuyệt đối KHÔNG tìm trong các bảng tạm session local nếu chưa tra cứu `wiki_search`.


### 3. SKILL CÓ SẴN TRONG REPO (Proactive Skill Routing)

Repo chứa sẵn quy trình dạng skill nhưng không nằm ở thư mục skill mặc định của
client nào cả, nên sẽ không tự nạp. Khi gặp đúng tình huống dưới đây, tự mở file
tương ứng rồi làm theo — user sẽ không nhắc.

| Đọc file | Khi nào |
|---|---|
| `agents/skills/setup-proxy/SKILL.md` | User muốn cấu hình, đấu nối hoặc kiểm tra một AI agent client (Claude Code, CodeBuddy, Codex, WorkBuddy, dsh, Hermes, OpenClaw) đi qua Memory Proxy. Nhận diện: "cấu hình proxy", "setup proxy", "đấu agent vào memory", "接入 proxy", "proxy chạy chưa", "sao agent không thấy memory". Script đi kèm: `agents/skills/setup-proxy/setup-proxy.sh` (dùng `--non-interactive` ở bước ghi config). |

⚠️ `setup-proxy` ghi vào file config GLOBAL của user (ví dụ `~/.claude/settings.json`,
`~/.codex/config.toml`), đổi hướng toàn bộ LLM traffic của client đó qua proxy. Luôn
tóm tắt chính xác những gì sắp ghi và hỏi user xác nhận TRƯỚC khi chạy bước ghi.

`MemoryCore/SKILL.md` thuộc lineage cũ `memory-tencentdb` / OpenClaw (nhánh
`upstream/main`), không áp dụng cho bản v2.x này — bỏ qua, đừng làm theo.
