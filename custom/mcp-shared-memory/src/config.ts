/** Cấu hình đọc từ env — nạp bởi custom/scripts/start-mcp.{sh,bat} từ custom/env/local.env. */

export interface Config {
  baseUrl: string;
  token?: string;
  serviceId: string;
  /** Wiki mặc định, để agent không phải truyền wiki_id mỗi lần gọi tool. */
  defaultWikiId?: string;
  /** Team mặc định, chỉ dùng khi ghi. */
  defaultTeamId?: string;
}

export function loadConfig(): Config {
  const cfg: Config = {
    baseUrl: (process.env.KNOWLEDGE_API_URL || "http://127.0.0.1:8424").replace(/\/$/, ""),
    token: process.env.KNOWLEDGE_API_TOKEN || undefined,
    serviceId: process.env.KNOWLEDGE_SERVICE_ID || "default",
    defaultWikiId: process.env.KNOWLEDGE_WIKI_ID || undefined,
    defaultTeamId: process.env.KNOWLEDGE_TEAM_ID || undefined,
  };
  return cfg;
}
