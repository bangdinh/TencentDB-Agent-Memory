/**
 * MCP stdio server cho shared memory.
 *
 * Thay thế hoàn toàn việc patch MemoryKnowledge/src/mcp/ — MemoryKnowledge giờ
 * giữ nguyên bản upstream, merge không bao giờ conflict ở đó nữa.
 *
 * Chạy qua custom/scripts/start-mcp.sh (macOS/Linux) hoặc start-mcp.bat (Windows).
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { buildTools, type McpToolDef } from "./tools.ts";
import { callApi } from "./http.ts";
import { loadConfig, type Config } from "./config.ts";
import { log } from "./log.ts";

/**
 * Dựng request body cho một tool call.
 * - tool wiki_* : tự điền wiki_id mặc định nếu agent không truyền
 * - wiki_write  : gộp {title, content} thành shape {team_id, wiki_id, pages[]} mà API yêu cầu
 */
export function buildBody(
  cfg: Config,
  name: string,
  args: Record<string, unknown>,
): Record<string, unknown> {
  if (name === "wiki_write") {
    const wikiId = (args.wiki_id as string) || cfg.defaultWikiId;
    if (!wikiId) throw new Error("Thiếu wiki_id: truyền vào tham số hoặc đặt KNOWLEDGE_WIKI_ID");
    if (!cfg.defaultTeamId && !args.team_id) throw new Error("Thiếu team_id: đặt KNOWLEDGE_TEAM_ID");
    return {
      team_id: (args.team_id as string) || cfg.defaultTeamId,
      wiki_id: wikiId,
      pages: [
        {
          ref: (args.title as string) || (args.ref as string) || "note",
          content: (args.content as string) || "",
        },
      ],
    };
  }

  const body = { ...args };
  if (name.startsWith("wiki_") && !body.wiki_id && cfg.defaultWikiId) {
    body.wiki_id = cfg.defaultWikiId;
  }
  return body;
}

export function createServer(cfg: Config): Server {
  const tools = buildTools();
  const byName = new Map<string, McpToolDef>(tools.map((t) => [t.name, t]));

  const server = new Server(
    { name: "shared-memory-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = byName.get(name);
    if (!tool) {
      log.warn(`tool không tồn tại: "${name}"`);
      return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }

    try {
      const body = buildBody(cfg, name, (args ?? {}) as Record<string, unknown>);
      const data = await callApi(cfg, tool.endpoint, body);

      // code-graph trả sẵn {text, isError} — đẩy thẳng ra
      if (data && typeof data === "object" && "text" in data && "isError" in data) {
        const r = data as { text: string; isError: boolean };
        return { content: [{ type: "text", text: r.text || "(empty result)" }], isError: r.isError };
      }

      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], isError: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`tool ${name} lỗi: ${msg}`);
      return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
    }
  });

  return server;
}

async function main() {
  const cfg = loadConfig();
  log.info(`khởi động, API=${cfg.baseUrl} service=${cfg.serviceId}`, {
    wiki: cfg.defaultWikiId ?? "(chưa đặt)",
    team: cfg.defaultTeamId ?? "(chưa đặt)",
    auth: cfg.token ? "có token" : "không token",
  });
  if (!cfg.defaultWikiId) {
    log.warn("chưa đặt KNOWLEDGE_WIKI_ID — agent sẽ phải tự truyền wiki_id ở mỗi lần gọi");
  }

  const server = createServer(cfg);
  await server.connect(new StdioServerTransport());
  log.info("đã kết nối qua stdio");
}

// Chỉ chạy khi được gọi trực tiếp (không chạy khi bị import trong test).
const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.filename !== undefined &&
  import.meta.filename === process.argv[1];

if (invokedDirectly) {
  main().catch((err) => {
    log.error(`không khởi động được: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
