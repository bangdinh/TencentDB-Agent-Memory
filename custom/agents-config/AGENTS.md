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

