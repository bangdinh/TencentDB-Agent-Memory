/**
 * Chốt hành vi mà tính năng multi-tenant phụ thuộc vào:
 * env agent truyền qua MCP config phải THẮNG custom/env/local.env.
 *
 * Nếu local.env thắng thì mọi project sẽ dùng chung team/wiki của local.env và
 * việc tách tenant hỏng âm thầm — không lỗi, chỉ là dữ liệu chảy nhầm chỗ.
 * Vì vậy test này chạy qua đúng custom/scripts/start-mcp.sh chứ không gọi thẳng
 * src/server.ts.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const customDir = path.resolve(pkgRoot, "..");
const startScript = path.join(customDir, "scripts", "start-mcp.sh");
const envFile = path.join(customDir, "env", "local.env");

const localEnv = Object.fromEntries(
  readFileSync(envFile, "utf8").split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1)]; }),
);

const OVERRIDE_TEAM = "team-override-test";
const OVERRIDE_PROJECT = "proj-override";
if (localEnv.KNOWLEDGE_TEAM_ID === OVERRIDE_TEAM) {
  console.log("  ❌ local.env tình cờ trùng giá trị test — đổi OVERRIDE_TEAM"); process.exit(1);
}

const calls = [];
const api = createServer((req, res) => {
  let raw = ""; req.on("data", (d) => (raw += d));
  req.on("end", () => {
    calls.push({ url: req.url, body: raw ? JSON.parse(raw) : {}, auth: req.headers.authorization });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ code: 0, message: "ok",
      data: req.url === "/v3/wiki/create" ? { wiki_id: "wiki-ok" } : { hits: [] } }));
  });
});
await new Promise((r) => api.listen(0, "127.0.0.1", r));
const port = api.address().port;

const child = spawn("bash", [startScript], {
  stdio: ["pipe", "pipe", "pipe"],
  env: {
    ...process.env,
    KNOWLEDGE_API_URL: `http://127.0.0.1:${port}`,   // đè URL trong local.env
    KNOWLEDGE_TEAM_ID: OVERRIDE_TEAM,                // đè team trong local.env
    KNOWLEDGE_PROJECT_ID: OVERRIDE_PROJECT,
  },
});

let stderr = "";
child.stderr.on("data", (d) => (stderr += d));
const send = (o) => child.stdin.write(JSON.stringify(o) + "\n");
send({ jsonrpc: "2.0", id: 1, method: "initialize", params: {
  protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "t", version: "1" } } });
send({ jsonrpc: "2.0", method: "notifications/initialized" });
setTimeout(() => send({ jsonrpc: "2.0", id: 2, method: "tools/call",
  params: { name: "wiki_search", arguments: { query: "x" } } }), 700);
setTimeout(() => child.kill(), 1800);

child.on("exit", () => {
  api.close();
  let fail = 0;
  const ok = (c, m) => { console.log(`  ${c ? "✅" : "❌"} ${m}`); if (!c) fail = 1; };

  ok(calls.length > 0, `gọi được API giả (URL của agent thắng local.env) — ${calls.length} request`);
  const create = calls.find((c) => c.url === "/v3/wiki/create");
  ok(!!create, "có gọi /wiki/create");
  ok(create?.body?.team_id === OVERRIDE_TEAM,
     `create dùng team của agent "${OVERRIDE_TEAM}", không phải "${localEnv.KNOWLEDGE_TEAM_ID}" trong local.env`);
  ok(create?.body?.name === OVERRIDE_PROJECT, "create dùng project id của agent");

  // Biến agent KHÔNG truyền thì vẫn phải lấy từ local.env.
  const expectAuth = localEnv.KNOWLEDGE_API_TOKEN ? `Bearer ${localEnv.KNOWLEDGE_API_TOKEN}` : undefined;
  ok(create?.auth === expectAuth, "token không bị truyền vào thì vẫn nạp từ local.env");
  ok(!JSON.stringify(calls).includes(localEnv.KNOWLEDGE_WIKI_ID ?? "__none__"),
     "KNOWLEDGE_WIKI_ID trong local.env bị bỏ qua ở chế độ project");

  if (fail) console.log("\n--- stderr ---\n" + stderr.slice(0, 500));
  console.log(fail ? "\n❌ env-precedence FAIL" : "\n✅ env-precedence PASS");
  process.exit(fail);
});
