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
    "LUÔN gọi tool này khi người dùng hỏi về dữ kiện cũ, sở thích, ngày tháng, mật khẩu hoặc bối cảnh đã trao đổi trước đó.",
  wiki_list: "Liệt kê toàn bộ trang trong shared memory kèm metadata (title, type, path).",
};

/** Tool ghi — upstream không có, đây là tool của mình. */
const WIKI_WRITE: McpToolDef = {
  name: "wiki_write",
  description:
    "Lưu dữ kiện, sở thích người dùng, sự kiện, ngày tháng, ghi chú hoặc thông tin dự án vào shared memory. " +
    "LUÔN gọi tool này ngay khi người dùng cung cấp thông tin mới (ví dụ 'hôm nay là...', 'nhớ là...', 'tôi tên...'). " +
    "Đừng chỉ trả lời bằng văn bản — hãy gọi tool.",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Tiêu đề / khoá của trang (vd: su_kien_hom_nay, note_thuan)" },
      content: { type: "string", description: "Nội dung text hoặc markdown cần lưu" },
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
