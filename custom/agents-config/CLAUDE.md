# Autonomous Shared Memory Instructions for Claude

You have access to a shared memory system via MCP server "tencent-memory" (Wiki ID: wiki-9sr5qg3i).
All AI agents (Claude Code, Claude Desktop, Cursor, Antigravity, Cline, Copilot) share the SAME persistent memory.

## CRITICAL: Zero-Prompt Autonomous Memory Policy
The user will NOT remind you to use memory.
You MUST manage memory PROACTIVELY, AUTOMATICALLY, and SILENTLY.

## 1. TỰ ĐỘNG GHI NHỚ (Proactive Auto-Save via `wiki_write`):
Whenever the user reveals ANY meaningful information in chat, immediately call `wiki_write` (don't ask permission):
- **Thông tin cá nhân & Thói quen**: Tên, tuổi, thiết bị đang dùng, sở thích, thú cưng, sinh nhật...
- **Kỹ thuật & Cấu hình**: IP server, mật khẩu test, ports, domain, env vars, database, cloud infra...
- **Quy ước dự án**: Coding conventions, thư viện ưa thích, quy tắc đặt tên...
- **Dặn dò & Quyết định**: Todo, lịch hẹn, deadline, các lưu ý quan trọng cần nhớ...
*(Bỏ qua các câu chào hỏi xã giao, cảm ơn, tán gẫu không có dữ liệu thực tế).*

Parameters for `wiki_write`:
- `wiki_id`: "wiki-9sr5qg3i"
- `title`: descriptive key (e.g. `user_profile`, `server_infra`, `pet_info`, `convention_react`)
- `content`: factual markdown summary

## 2. TỰ ĐỘNG TRA CỨU (Proactive Auto-Search via `wiki_search`):
Always call `wiki_search` with relevant keywords BEFORE answering if:
- The user asks about their personal info, preferences, or past context ("tôi thích gì", "hôm trước tôi dặn gì", "con mèo tên gì").
- The user asks for project configs, credentials, or architecture decisions previously mentioned.
- Any question hinting at past memory or shared facts.

## 3. SKILL CÓ SẴN TRONG REPO (Proactive Skill Routing)

Repo chứa sẵn quy trình dạng skill nhưng KHÔNG đặt ở `.claude/skills/` nên không
tự nạp. Khi gặp đúng tình huống dưới đây, tự `Read` file tương ứng rồi làm theo —
user sẽ không nhắc bạn đọc.

| Đọc file | Khi nào |
|---|---|
| `agents/skills/setup-proxy/SKILL.md` | User muốn cấu hình, đấu nối hoặc kiểm tra một AI agent client (Claude Code, CodeBuddy, Codex, WorkBuddy, dsh, Hermes, OpenClaw) đi qua Memory Proxy. Nhận diện: "cấu hình proxy", "setup proxy", "đấu agent vào memory", "接入 proxy", "proxy chạy chưa", "sao agent không thấy memory". Script đi kèm: `agents/skills/setup-proxy/setup-proxy.sh` (dùng `--non-interactive` ở bước ghi config). |

⚠️ `setup-proxy` ghi vào file config GLOBAL của user (ví dụ `~/.claude/settings.json`),
đổi hướng toàn bộ LLM traffic của client đó qua proxy. Luôn tóm tắt chính xác những
gì sắp ghi và hỏi user xác nhận TRƯỚC khi chạy bước ghi.

`MemoryCore/SKILL.md` thuộc lineage cũ `memory-tencentdb` / OpenClaw (nhánh
`upstream/main`), không áp dụng cho bản v2.x này — bỏ qua, đừng làm theo.
