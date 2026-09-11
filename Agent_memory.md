# Agent Memory Overview

## Giới thiệu
Agent Memory là hệ thống bộ nhớ bền vững (Persistent Shared Memory) dành cho các AI Agent (Antigravity, Cursor, Claude, Cline) phối hợp làm việc chung trong dự án.

## Thông tin Dự án
- **Tên dự án**: TencentDB Agent Memory
- **Kiến trúc**: Microservices chạy trên nền tảng Docker
- **Các cổng dịch vụ chính**:
  - Web Panel: 8125
  - Knowledge API: 8424
  - Memory Core API: 8420
  - LLM Proxy: 8096

## Quy tắc Hoạt động
- **Tự động tìm kiếm**: AI tự động gọi `wiki_search` để lấy ngữ cảnh trước khi trả lời.
- **Tự động ghi nhớ**: AI tự động gọi `wiki_write` để lưu các quyết định kỹ thuật và ghi chú.
- **Cô lập dự án**: Mỗi dự án sử dụng một Wiki ID riêng biệt để tránh nhầm lẫn dữ liệu.
