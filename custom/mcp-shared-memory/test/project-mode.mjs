/**
 * Test chế độ multi-tenant theo project, không cần stack Docker.
 *
 * Dựng một HTTP server giả đóng vai Knowledge API, chạy MCP server thật trỏ vào
 * đó, rồi kiểm tra: project id được đổi thành wiki_id qua /wiki/create, wiki_id
 * đó được dùng cho các lần gọi sau, và create chỉ xảy ra đúng một lần.
 *
 *   node test/project-mode.mjs
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_ID = "cueos";
const WIKI_ID = "wiki-fromcreate";

const calls = [];
const api = createServer((req, res) => {
  let raw = "";
  req.on("data", (d) => (raw += d));
  req.on("end", () => {
    const body = raw ? JSON.parse(raw) : {};
    calls.push({ url: req.url, body, serviceId: req.headers["x-tdai-service-id"] });
    const reply = (data) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ code: 0, message: "ok", data }));
    };
    if (req.url === "/v3/wiki/create") return reply({ wiki_id: WIKI_ID, name: body.name });
    if (req.url === "/v3/wiki/search") return reply({ hits: [] });
    if (req.url === "/v3/wiki/page/write") return reply({ written: 1 });
    res.writeHead(404); res.end("{}");
  });
});

await new Promise((r) => api.listen(0, "127.0.0.1", r));
const port = api.address().port;

const child = spawn(
  process.execPath,
  [path.join(pkgRoot, "node_modules/tsx/dist/cli.mjs"), path.join(pkgRoot, "src/server.ts")],
  {
    cwd: pkgRoot,
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      KNOWLEDGE_API_URL: `http://127.0.0.1:${port}`,
      KNOWLEDGE_API_TOKEN: "test-token",
      KNOWLEDGE_SERVICE_ID: "svc-test",
      KNOWLEDGE_TEAM_ID: "team-test",
      KNOWLEDGE_PROJECT_ID: PROJECT_ID,
      KNOWLEDGE_WIKI_ID: "wiki-KHONG-DUOC-DUNG",
    },
  },
);

let stdout = "";
let stderr = "";
child.stdout.on("data", (d) => (stdout += d));
child.stderr.on("data", (d) => (stderr += d));
const send = (o) => child.stdin.write(JSON.stringify(o) + "\n");

send({ jsonrpc: "2.0", id: 1, method: "initialize", params: {
  protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "t", version: "1" } } });
send({ jsonrpc: "2.0", method: "notifications/initialized" });
setTimeout(() => send({ jsonrpc: "2.0", id: 2, method: "tools/call",
  params: { name: "wiki_search", arguments: { query: "abc" } } }), 400);
setTimeout(() => send({ jsonrpc: "2.0", id: 3, method: "tools/call",
  params: { name: "wiki_write", arguments: { title: "t", content: "c" } } }), 1000);
setTimeout(() => send({ jsonrpc: "2.0", id: 4, method: "tools/call",
  params: { name: "wiki_search", arguments: { query: "def", wiki_id: "wiki-tudien" } } }), 1600);
setTimeout(() => child.kill(), 2400);

child.on("exit", () => {
  api.close();
  let fail = 0;
  const ok = (c, m) => { console.log(`  ${c ? "✅" : "❌"} ${m}`); if (!c) fail = 1; };

  const creates = calls.filter((c) => c.url === "/v3/wiki/create");
  const searches = calls.filter((c) => c.url === "/v3/wiki/search");
  const writes = calls.filter((c) => c.url === "/v3/wiki/page/write");

  ok(creates.length === 1, `/wiki/create gọi đúng 1 lần (cache hoạt động) — thực tế ${creates.length}`);
  ok(creates[0]?.body?.name === PROJECT_ID, `create dùng name = project id "${PROJECT_ID}"`);
  ok(creates[0]?.body?.team_id === "team-test", "create gửi team_id");
  ok(creates[0]?.serviceId === "svc-test", "gửi header x-tdai-service-id");

  ok(searches[0]?.body?.wiki_id === WIKI_ID, `wiki_search dùng wiki từ create (${WIKI_ID})`);
  ok(writes[0]?.body?.wiki_id === WIKI_ID, "wiki_write dùng wiki từ create");
  ok(writes[0]?.body?.team_id === "team-test", "wiki_write gửi team_id");
  ok(!JSON.stringify(calls).includes("wiki-KHONG-DUOC-DUNG"),
     "KNOWLEDGE_WIKI_ID bị bỏ qua khi có PROJECT_ID");
  ok(searches[1]?.body?.wiki_id === "wiki-tudien",
     "agent truyền wiki_id tường minh thì vẫn được ưu tiên");

  ok(stderr.includes(`project "${PROJECT_ID}" → wiki ${WIKI_ID}`), "log phân giải ra stderr");
  try { stdout.split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
    ok(true, "stdout chỉ chứa JSON-RPC");
  } catch { ok(false, "stdout có rác"); }

  console.log(fail ? "\n❌ project-mode FAIL" : "\n✅ project-mode PASS");
  process.exit(fail);
});
