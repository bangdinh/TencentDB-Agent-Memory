# Custom Agents

Thư mục này dùng để chứa các AI Agent tùy biến sử dụng hệ thống Shared Memory.

## Nguyên tắc:
- Tự động tra cứu và lưu trữ ngữ cảnh thông qua Shared Memory API / SDK.
- Giao tiếp với Core qua:
  - SDK: `sdk/memory-core/typescript` hoặc `sdk/memory-core/python`
  - REST API:
    - `http://127.0.0.1:8420` (MemoryCore)
    - `http://127.0.0.1:8424` (MemoryKnowledge)
- **Tuyệt đối không** import trực tiếp source code bên trong các thư mục `MemoryCore/`, `MemoryKnowledge/`, `MemoryPanel/`, `MemoryProxy/`.
- Đọc cấu hình từ `custom/.env`.
