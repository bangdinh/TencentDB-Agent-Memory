/** Cấu hình đọc từ env — nạp bởi custom/scripts/start-mcp.{sh,bat} từ custom/env/local.env. */

export interface Config {
  baseUrl: string;
  token?: string;
  serviceId: string;
  /** Team dùng để tạo/tra wiki và để ghi. */
  defaultTeamId?: string;
  /**
   * Multi-tenant: mỗi project một wiki riêng.
   * Khi đặt, server tra (hoặc tạo) wiki tên đúng bằng giá trị này trong team
   * hiện tại, rồi dùng làm wiki mặc định — bỏ qua KNOWLEDGE_WIKI_ID.
   * Khai trong `env` của MCP config từng project.
   */
  projectId?: string;
  /** Wiki mặc định khi KHÔNG dùng chế độ project. */
  defaultWikiId?: string;
}

export function loadConfig(): Config {
  return {
    baseUrl: (process.env.KNOWLEDGE_API_URL || "http://127.0.0.1:8424").replace(/\/$/, ""),
    token: process.env.KNOWLEDGE_API_TOKEN || undefined,
    serviceId: process.env.KNOWLEDGE_SERVICE_ID || "default",
    defaultTeamId: process.env.KNOWLEDGE_TEAM_ID || undefined,
    projectId: process.env.KNOWLEDGE_PROJECT_ID || undefined,
    defaultWikiId: process.env.KNOWLEDGE_WIKI_ID || undefined,
  };
}

/** Mô tả chế độ đang chạy, để log lúc khởi động. */
export function describeMode(cfg: Config): string {
  return cfg.projectId
    ? `project="${cfg.projectId}" (wiki riêng, tra/tạo theo tên)`
    : cfg.defaultWikiId
      ? `wiki chung ${cfg.defaultWikiId}`
      : "chưa cấu hình wiki";
}
