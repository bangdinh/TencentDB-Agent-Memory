# Custom MCP Tools

Thư mục này dùng để chứa các Custom MCP (Model Context Protocol) Server mở rộng cho IDE và AI Agent (như Claude, Cursor, Antigravity, Cline...).

## Nguyên tắc:
- Cung cấp các công cụ (tools/resources/prompts) mới tích hợp với các hệ thống ngoài (ví dụ: Jira, GitHub, Slack, Notion...).
- Giao tiếp với Core qua:
  - SDK: `sdk/memory-core/typescript` hoặc `sdk/memory-core/python`
  - REST API:
    - `http://127.0.0.1:8420` (MemoryCore)
    - `http://127.0.0.1:8424` (MemoryKnowledge)
- **Tuyệt đối không** import trực tiếp source code bên trong các thư mục `MemoryCore/`, `MemoryKnowledge/`, `MemoryPanel/`, `MemoryProxy/`.
- Đọc cấu hình từ `custom/.env`.
