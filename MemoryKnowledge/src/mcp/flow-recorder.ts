/**
 * Flow Recorder — Ghi nhận và phát luồng hoạt động:
 * Agent -> MCP Tool -> Target Wiki -> Page Overview
 */
import fs from "fs";
import path from "path";

const MONITOR_API_URL = process.env.FLOW_MONITOR_API_URL || "http://127.0.0.1:8126/api/events";
const LOCAL_DATA_FILE = path.resolve(process.cwd(), "custom/data/flow_events.json");

export interface FlowEventPayload {
  id?: string;
  timestamp?: string;
  agent?: string;
  mcp_server?: string;
  tool: string;
  wiki_id?: string;
  wiki_name?: string;
  query?: string;
  duration_ms: number;
  status: "SUCCESS" | "ERROR";
  page_overview?: Array<{
    title: string;
    ref?: string;
    score?: number;
    overview?: string;
  }>;
}

export function recordFlowEvent(payload: FlowEventPayload): void {
  const event: FlowEventPayload = {
    id: payload.id || `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: payload.timestamp || new Date().toLocaleTimeString(),
    agent: payload.agent || process.env.AGENT_NAME || "AI Agent",
    mcp_server: payload.mcp_server || process.env.MCP_SERVER_NAME || (payload.wiki_id === "wiki-jeq1u9eq" ? "tencent-memory-agent" : "tencent-memory-cueos"),
    tool: payload.tool,
    wiki_id: payload.wiki_id || "wiki-jeq1u9eq",
    wiki_name: payload.wiki_name || (payload.wiki_id === "wiki-jeq1u9eq" ? "Agent Memory" : payload.wiki_id === "wiki-9sr5qg3i" ? "Project Memory Cueos" : payload.wiki_id),
    query: payload.query || "",
    duration_ms: payload.duration_ms,
    status: payload.status,
    page_overview: payload.page_overview || [],
  };

  // 1. Non-blocking HTTP POST to flow-monitor service
  try {
    fetch(MONITOR_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    }).catch(() => {
      // Best-effort, ignore if monitor is not running
    });
  } catch (_) {}

  // 2. Direct write to custom/data/flow_events.json as reliable local fallback
  try {
    const dir = path.dirname(LOCAL_DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    let list: FlowEventPayload[] = [];
    if (fs.existsSync(LOCAL_DATA_FILE)) {
      try {
        list = JSON.parse(fs.readFileSync(LOCAL_DATA_FILE, "utf8"));
        if (!Array.isArray(list)) list = [];
      } catch (_) {
        list = [];
      }
    }
    list.unshift(event);
    if (list.length > 100) list.pop();
    fs.writeFileSync(LOCAL_DATA_FILE, JSON.stringify(list, null, 2), "utf8");
  } catch (_) {}
}
