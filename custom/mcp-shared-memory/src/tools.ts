/**
 * Danh sách tool = định nghĩa upstream + lớp overlay của mình.
 *
 * Cố tình import thẳng MCP_TOOLS của upstream thay vì chép lại: 8 tool code_*
 * nhờ vậy tự động bám theo upstream, không bị trôi. Đây là file DUY NHẤT
 * đọc vào source của MemoryKnowledge — và chỉ đọc, không sửa.
 *
 * Nếu upstream đổi tên / dời file này, server sẽ chết ngay lúc khởi động với
 * lỗi import rõ ràng — dễ phát hiện hơn nhiều so với kiểu patch âm thầm biến mất.
 */

import { MCP_TOOLS as UPSTREAM_TOOLS, type McpToolDef } from "../../../MemoryKnowledge/src/mcp/tools.ts";
import { log } from "./log.ts";

export type { McpToolDef };

/** Mô tả viết lại, để agent chủ động gọi tool thay vì chỉ trả lời suông. */
const DESCRIPTION_OVERRIDES: Record<string, string> = {
  wiki_search:
    "Tìm trong shared memory và wiki theo từ khoá, dùng chung cho mọi AI agent. " +
    "LUÔN gọi TRƯỚC KHI TRẢ LỜI mọi câu hỏi có thể đã bàn trước đó: quyết định cũ, " +
    "quy ước, cấu hình đã chốt, sở thích, 'hôm trước mình chốt gì'. Đừng kết luận " +
    "là không biết khi chưa tra. Truy vấn đặt bằng tiếng Việt cho khớp nội dung đã lưu.",
  wiki_list: "Liệt kê toàn bộ trang trong shared memory kèm metadata (title, type, path).",
};

/** Tool ghi — upstream không có, đây là tool của mình. */
const WIKI_WRITE: McpToolDef = {
  name: "wiki_write",
  // Luật ghi nhớ đặt ở ĐÂY chứ không nhân bản vào CLAUDE.md từng project: mọi
  // server (memory-vm, memory-b2b, ...) chạy chung codebase này nên sửa một chỗ
  // là cả hệ thống thấy ngay, không phải sinh lại file nào.
  description:
    "Lưu dữ kiện, quyết định, quy ước hoặc thông tin dự án vào shared memory. " +
    "LUÔN gọi ngay khi người dùng để lộ thông tin có giá trị lâu dài — cấu hình, " +
    "quyết định kiến trúc kèm lý do, quy ước, dặn dò có hạn. Đừng chỉ trả lời " +
    "bằng văn bản, đừng hỏi xin phép. Bỏ qua chào hỏi, tán gẫu, và những gì đọc " +
    "thẳng từ code ra được. " +
    "TITLE: tiếng Anh, snake_case (decision_auth_flow, naming_convention) — page " +
    "id sinh ra bằng cách bỏ dấu khỏi title nên tiếng Việt có dấu bị băm nát. " +
    "CONTENT: tiếng Việt có dấu, giữ nguyên thuật ngữ tiếng Anh (MQTT, Compose, " +
    "RPC) — BM25 không dịch, viết nội dung tiếng Anh là tự làm trượt truy vấn " +
    "tiếng Việt của người dùng. Nêu cả lý do, không chỉ kết luận. " +
    "CHỈ GHI MỘT CHỖ: thuộc project nào thì ghi vào server của project đó và chỉ " +
    "vào đó, đừng ghi thêm bản sao sang memory-general — nhân đôi thì sau này sửa " +
    "một bản, bản kia lặng lẽ thành sai.",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Khoá của trang: TIẾNG ANH, snake_case (vd: decision_auth_flow, working_preferences)" },
      content: { type: "string", description: "Nội dung markdown, viết TIẾNG VIỆT có dấu, giữ thuật ngữ tiếng Anh" },
      wiki_id: { type: "string", description: "Wiki ID (không bắt buộc, mặc định lấy từ KNOWLEDGE_WIKI_ID)" },
    },
    required: ["title", "content"],
  },
  endpoint: "/wiki/page/write",
};

/** Tool wiki_* nào được phép bỏ wiki_id khỏi required (vì server tự điền). */
const WIKI_ID_OPTIONAL = new Set(["wiki_search", "wiki_read", "wiki_list", "wiki_graph"]);

function overlay(tool: McpToolDef): McpToolDef {
  if (!WIKI_ID_OPTIONAL.has(tool.name)) return tool;
  return {
    ...tool,
    description: DESCRIPTION_OVERRIDES[tool.name] ?? tool.description,
    inputSchema: {
      ...tool.inputSchema,
      properties: {
        ...tool.inputSchema.properties,
        wiki_id: { type: "string", description: "Wiki ID (không bắt buộc, mặc định lấy từ KNOWLEDGE_WIKI_ID)" },
      },
      required: tool.inputSchema.required.filter((r) => r !== "wiki_id"),
    },
  };
}

export function buildTools(): McpToolDef[] {
  const seen = new Set(UPSTREAM_TOOLS.map((t) => t.name));

  // Cảnh báo sớm nếu upstream đổi tên tool mà overlay không còn khớp.
  for (const name of WIKI_ID_OPTIONAL) {
    if (!seen.has(name)) log.warn(`upstream không còn tool "${name}" — overlay có thể đã lỗi thời`);
  }
  if (seen.has(WIKI_WRITE.name)) {
    log.warn(`upstream đã có tool "${WIKI_WRITE.name}" — dùng bản upstream, bỏ bản custom`);
    return UPSTREAM_TOOLS.map(overlay);
  }

  return [...UPSTREAM_TOOLS.map(overlay), WIKI_WRITE];
}
