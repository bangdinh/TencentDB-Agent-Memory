/**
 * Kiểm chứng đường lỗi của chế độ project:
 *   1. Knowledge API chết  → MCP server VẪN lên (agent không báo "server failed")
 *   2. tool trả lỗi rõ ràng thay vì treo
 *   3. API sống lại → lần gọi sau tự phân giải được, tức thất bại không bị cache
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WIKI_ID = "wiki-late";
let apiAlive = false;

const api = createServer((req, res) => {
  let raw = ""; req.on("data", (d) => (raw += d));
  req.on("end", () => {
    if (!apiAlive) { res.writeHead(503); res.end(JSON.stringify({ code: 503, message: "core chưa sẵn sàng" })); return; }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ code: 0, message: "ok", data: req.url === "/v3/wiki/create" ? { wiki_id: WIKI_ID } : { hits: [] } }));
  });
});
await new Promise((r) => api.listen(0, "127.0.0.1", r));
const port = api.address().port;

const child = spawn(process.execPath,
  [path.join(pkgRoot, "node_modules/tsx/dist/cli.mjs"), path.join(pkgRoot, "src/server.ts")],
  { cwd: pkgRoot, stdio: ["pipe", "pipe", "pipe"], env: {
      ...process.env,
      KNOWLEDGE_API_URL: `http://127.0.0.1:${port}`,
      KNOWLEDGE_SERVICE_ID: "svc", KNOWLEDGE_TEAM_ID: "team-test",
      KNOWLEDGE_PROJECT_ID: "proj", KNOWLEDGE_WIKI_ID: "" } });

let stdout = "", stderr = "";
child.stdout.on("data", (d) => (stdout += d));
child.stderr.on("data", (d) => (stderr += d));
const send = (o) => child.stdin.write(JSON.stringify(o) + "\n");

send({ jsonrpc: "2.0", id: 1, method: "initialize", params: {
  protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "t", version: "1" } } });
send({ jsonrpc: "2.0", method: "notifications/initialized" });
// Lượt 1: API đang chết
setTimeout(() => send({ jsonrpc: "2.0", id: 2, method: "tools/call",
  params: { name: "wiki_search", arguments: { query: "x" } } }), 400);
// Bật API lên rồi gọi lại
setTimeout(() => { apiAlive = true; }, 1000);
setTimeout(() => send({ jsonrpc: "2.0", id: 3, method: "tools/call",
  params: { name: "wiki_search", arguments: { query: "y" } } }), 1400);
setTimeout(() => child.kill(), 2200);

child.on("exit", () => {
  api.close();
  let fail = 0;
  const ok = (c, m) => { console.log(`  ${c ? "✅" : "❌"} ${m}`); if (!c) fail = 1; };
  const msgs = stdout.split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));

  ok(!!msgs.find((m) => m.id === 1)?.result, "server vẫn khởi động được khi API chết");

  const r2 = msgs.find((m) => m.id === 2);
  ok(r2?.result?.isError === true, "API chết → tool trả isError, không treo");
  const text2 = r2?.result?.content?.[0]?.text ?? "";
  ok(/core chưa sẵn sàng|503/.test(text2), `thông điệp lỗi nói rõ nguyên nhân: ${JSON.stringify(text2.slice(0, 60))}`);

  const r3 = msgs.find((m) => m.id === 3);
  ok(r3?.result?.isError === false, "API sống lại → lần gọi sau thành công (thất bại không bị cache)");
  ok(stderr.includes(`→ wiki ${WIKI_ID}`), "phân giải thành công sau khi retry");

  console.log(fail ? "\n❌ project-retry FAIL" : "\n✅ project-retry PASS");
  process.exit(fail);
});
