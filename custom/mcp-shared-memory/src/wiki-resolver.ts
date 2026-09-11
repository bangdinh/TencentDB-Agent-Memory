/**
 * Phân giải wiki mặc định cho một lần chạy MCP server.
 *
 * Chế độ project (KNOWLEDGE_PROJECT_ID): tra wiki có `name` đúng bằng project id
 * trong team hiện tại; chưa có thì tạo. `/wiki/create` idempotent theo
 * (service_id, team_id, name) — đã có thì trả về đúng bản cũ, không tạo trùng —
 * nên gọi thẳng create là đủ, không cần list trước.
 *
 * Phân giải LƯỜI (lần gọi tool đầu tiên) chứ không phải lúc khởi động: MCP server
 * phải lên được kể cả khi stack Docker đang tắt, nếu không agent chỉ báo cụt lủn
 * "server failed to start". Kết quả thành công được cache; thất bại KHÔNG cache,
 * để bật stack lên rồi gọi lại là chạy.
 */

import type { Config } from "./config.ts";
import { callApi } from "./http.ts";
import { log } from "./log.ts";

let cached: string | undefined;
let inflight: Promise<string> | undefined;

/** Chỉ dùng trong test. */
export function resetWikiCache(): void {
  cached = undefined;
  inflight = undefined;
}

async function createOrGet(cfg: Config, projectId: string): Promise<string> {
  if (!cfg.defaultTeamId) {
    throw new Error("Chế độ project cần KNOWLEDGE_TEAM_ID để biết tạo wiki trong team nào");
  }
  const data = await callApi(cfg, "/wiki/create", {
    team_id: cfg.defaultTeamId,
    name: projectId,
  });
  const wikiId = (data as { wiki_id?: unknown } | null)?.wiki_id;
  if (typeof wikiId !== "string" || !wikiId) {
    throw new Error(`/wiki/create không trả về wiki_id hợp lệ cho project "${projectId}"`);
  }
  return wikiId;
}

/**
 * Trả về wiki_id dùng làm mặc định. Ném lỗi có thông điệp rõ ràng nếu không
 * phân giải được — lỗi này được bọc lại thành nội dung tool trả về cho agent.
 */
export async function resolveDefaultWikiId(cfg: Config): Promise<string | undefined> {
  if (!cfg.projectId) return cfg.defaultWikiId;
  if (cached) return cached;
  if (inflight) return inflight;

  const projectId = cfg.projectId;
  inflight = (async () => {
    const wikiId = await createOrGet(cfg, projectId);
    cached = wikiId;
    log.info(`project "${projectId}" → wiki ${wikiId}`);
    return wikiId;
  })();

  try {
    return await inflight;
  } catch (err) {
    inflight = undefined; // không cache thất bại
    throw err;
  } finally {
    if (cached) inflight = undefined;
  }
}
