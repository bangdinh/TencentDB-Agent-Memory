---
name: setup-proxy
description: Cấu hình, đấu nối hoặc kiểm tra một AI agent client (Claude Code, CodeBuddy, Codex, WorkBuddy, dsh, Hermes, OpenClaw) đi qua Memory Proxy để được inject team memory trước khi gọi LLM. Dùng khi user nói "setup proxy", "cấu hình proxy", "đấu agent vào memory", "接入 proxy", "proxy chạy chưa", hoặc than "agent không thấy memory".
---

# Setup Proxy

File này chỉ là con trỏ. **Quy trình đầy đủ nằm ở file của upstream — đọc nó trước khi làm bất cứ việc gì:**

```
agents/skills/setup-proxy/SKILL.md
```

Script đi kèm: `agents/skills/setup-proxy/setup-proxy.sh` (bước ghi config gọi ở mode `--non-interactive`).

Cả hai đường dẫn tính từ gốc repo `agents-memory`.

## Bắt buộc

⚠️ Skill này ghi vào file config **GLOBAL** của user (`~/.claude/settings.json`,
`~/.codex/config.toml`, …) và đổi hướng **toàn bộ** LLM traffic của client đó qua
proxy. Tóm tắt chính xác nội dung sắp ghi rồi xin xác nhận TRƯỚC khi chạy bước ghi.

Không làm theo `MemoryCore/SKILL.md` — file đó thuộc lineage cũ
`memory-tencentdb` / OpenClaw (`upstream/main`), không áp dụng cho bản v2.x này.
