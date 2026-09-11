# Custom Scripts

Thư mục này dùng để chứa các script tự động hóa (automation scripts) như: backup dữ liệu, dọn dẹp memory cũ (cleanup/pruning), đồng bộ dữ liệu theo lịch (cron/sync).

## Nguyên tắc:
- Chạy theo lượt (one-off hoặc định kỳ qua Task Scheduler/Cron).
- Giao tiếp với Core qua:
  - SDK: `sdk/memory-core/typescript` hoặc `sdk/memory-core/python`
  - REST API:
    - `http://127.0.0.1:8420` (MemoryCore)
    - `http://127.0.0.1:8424` (MemoryKnowledge)
- **Tuyệt đối không** import trực tiếp source code bên trong các thư mục `MemoryCore/`, `MemoryKnowledge/`, `MemoryPanel/`, `MemoryProxy/`.
- Đọc cấu hình từ `custom/.env`.

---

## Các công cụ đã tích hợp:

### 1. `backup.bat` (hoặc `backup.ps1`)
Dùng để tạo snapshot dự phòng trước khi viết code mới hoặc sửa đổi hệ thống.
* **Cách dùng**:
  - Chạy trực tiếp `.\backup.bat` từ root hoặc trong thư mục `custom\scripts\`.
  - Có 2 chế độ:
    - **[1] Full Backup**: Sao lưu toàn bộ mã nguồn `custom/`, file cấu hình (`.env`, `.admin-key`, `CLAUDE.md`, `mcp_config.json`) và toàn bộ **Docker Data Volumes** (`tdai-memory-core-data`, `tdai-panel-data`). Đảm bảo toàn vẹn dữ liệu SQLite & VectorDB.
    - **[2] Quick Backup**: Chỉ sao lưu mã nguồn `custom/` và cấu hình, diễn ra tức thì trong 1 giây mà không cần tạm dừng Docker.
  - Tự động lưu trữ vào thư mục `backups/backup_YYYYMMDD_HHMMSS/`.

### 2. `restore.bat` (hoặc `restore.ps1`)
Dùng để khôi phục lại trạng thái cũ khi code mới bị lỗi hoặc dữ liệu có sự cố.
* **Cách dùng**:
  - Chạy `.\restore.bat` từ root.
  - Script sẽ liệt kê danh sách các bản backup kèm thời gian và ghi chú.
  - Nhập số thứ tự bản backup muốn khôi phục. Hệ thống sẽ tự động khôi phục code, cấu hình và nạp lại Docker volume.
