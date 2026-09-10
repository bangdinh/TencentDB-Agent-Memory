/**
 * HTTP client gọi MemoryCore/MemoryKnowledge API.
 *
 * Khác bản upstream ở một chỗ: luôn gửi header `x-tdai-service-id` —
 * MemoryCore cần header này để định tuyến service.
 */

import type { Config } from "./config.ts";
import { log } from "./log.ts";

interface ApiEnvelope {
  code: number;
  message: string;
  data: unknown;
}

export async function callApi(
  cfg: Config,
  endpoint: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const url = `${cfg.baseUrl}/v3${endpoint}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-tdai-service-id": cfg.serviceId,
  };
  if (cfg.token) headers["Authorization"] = `Bearer ${cfg.token}`;

  log.debug(`POST ${url}`);

  let resp: Response;
  try {
    resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`fetch thất bại ${endpoint}: ${msg}`);
    throw new Error(`Không gọi được ${url}: ${msg}`);
  }

  let json: ApiEnvelope;
  try {
    json = (await resp.json()) as ApiEnvelope;
  } catch {
    log.error(`response không phải JSON ${endpoint} (status=${resp.status})`);
    throw new Error(`API lỗi ${resp.status}: response không phải JSON`);
  }

  if (resp.status >= 400 || json.code !== 0) {
    log.warn(`API lỗi ${endpoint}`, { status: resp.status, code: json.code, message: json.message });
    throw new Error(json.message || `API lỗi ${resp.status}`);
  }

  return json.data;
}
