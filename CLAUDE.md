# Autonomous Shared Memory Instructions for Claude

## CRITICAL: Zero-Prompt Autonomous Memory Policy
**Người dùng KHÔNG BAO GIỜ cần nhắc tên MCP hoặc yêu cầu "lưu vào bộ nhớ" / "tìm trong bộ nhớ".**
Bạn phải tự động nhận diện ngữ cảnh và gọi công cụ MCP phù hợp trong background một cách hoàn toàn tự động và âm thầm.

---

### 1. NGUYÊN TẮC TỰ ĐỘNG PHÂN LUỒNG MCP (Auto-Routing)

Khi hệ thống có 2 server MCP kết nối song song, Claude phải tự động chọn đúng MCP dựa vào nội dung:

| Loại thông tin | MCP Server cần gọi | Wiki ID tương ứng | Ví dụ nội dung |
|---|---|---|---|
| **Cá nhân & Thiết bị** | `1Agent` | `wiki-jeq1u9eq` | Tên, tuổi, IP laptop cá nhân, máy tính ASUS, sở thích, thú cưng, thói quen cá nhân |
| **Dự án Cueos & Kỹ thuật** | `2Cueos` | `wiki-9sr5qg3i` | Architecture, Database schema, API endpoints, code conventions, config server dự án Cueos |

*(Nếu cấu hình chỉ có 1 server MCP chung `tencent-memory`, hãy truyền đúng tham số `wiki_id` tương ứng với bảng trên).*

---

### 2. TỰ ĐỘNG GHI NHỚ (Proactive Auto-Save via `wiki_write`)
Bất cứ khi nào người dùng tiết lộ thông tin mới trong câu chuyện thường ngày, LẬP TỨC âm thầm gọi `wiki_write`:
- **Thông tin cá nhân & Thiết bị** → Gọi qua `1Agent` (hoặc `wiki-jeq1u9eq`).
- **Thông tin dự án & Kỹ thuật Cueos** → Gọi qua `2Cueos` (hoặc `wiki-9sr5qg3i`).
- **Format**:
  - `title`: Ngắn gọn, có tính phân loại (ví dụ: `laptop_specs`, `user_profile`, `cueos_api_routes`...).
  - `content`: Tóm tắt rõ ràng, súc tích, chính xác sự thật.

---

### 3. TỰ ĐỘNG TRA CỨU (Proactive Auto-Search via `wiki_search`)
Khi người dùng hỏi bất kỳ câu hỏi nào gợi nhớ quá khứ, sở thích, thông số máy tính, hoặc tài nguyên dự án:
- Tra cứu tại `1Agent` nếu câu hỏi liên quan đến cá nhân/thiết bị người dùng.
- Tra cứu tại `2Cueos` nếu câu hỏi liên quan đến dự án Cueos.
- Nếu chưa chắc chắn, tra cứu cả 2 để đảm bảo không bỏ sót thông tin.
- **Tuyệt đối KHÔNG** yêu cầu người dùng phải nhắc lại hoặc phải chỉ định tên MCP.
