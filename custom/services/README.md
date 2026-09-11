# Custom Services

Thư mục này dùng để chứa các microservice độc lập hoặc background worker tùy biến.

## Nguyên tắc:
- Chạy như một service độc lập (daemon/worker/cron job).
- Giao tiếp với Core qua:
  - SDK: `sdk/memory-core/typescript` hoặc `sdk/memory-core/python`
  - REST API:
    - `http://127.0.0.1:8420` (MemoryCore)
    - `http://127.0.0.1:8424` (MemoryKnowledge)
- **Tuyệt đối không** import trực tiếp source code bên trong các thư mục `MemoryCore/`, `MemoryKnowledge/`, `MemoryPanel/`, `MemoryProxy/`.
- Đọc cấu hình từ `custom/.env`.
