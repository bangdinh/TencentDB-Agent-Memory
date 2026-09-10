/**
 * Smoke test không cần MemoryCore chạy: bắt tay MCP qua stdio và kiểm tra
 * danh sách tool. Đồng thời khẳng định stdout chỉ chứa JSON-RPC.
 *
 *   node test/smoke.mjs
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, "..");

const child = spawn(
  process.execPath,
  [path.join(pkgRoot, "node_modules/tsx/dist/cli.mjs"), path.join(pkgRoot, "src/server.ts")],
  {
    cwd: pkgRoot,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, KNOWLEDGE_WIKI_ID: "wiki-smoketest", KNOWLEDGE_TEAM_ID: "team-smoketest" },
  },
);

let stdout = "";
let stderr = "";
child.stdout.on("data", (d) => (stdout += d));
child.stderr.on("data", (d) => (stderr += d));

const send = (o) => child.stdin.write(JSON.stringify(o) + "\n");

send({ jsonrpc: "2.0", id: 1, method: "initialize", params: {
  protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "smoke", version: "1" } } });
send({ jsonrpc: "2.0", method: "notifications/initialized" });
setTimeout(() => send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }), 400);
setTimeout(() => child.kill(), 2500);

child.on("exit", () => {
  let fail = 0;
  const ok = (c, m) => { console.log(`  ${c ? "✅" : "❌"} ${m}`); if (!c) fail = 1; };

  const lines = stdout.split("\n").filter((l) => l.trim());
  let msgs;
  try {
    msgs = lines.map((l) => JSON.parse(l));
    ok(true, `stdout chỉ chứa JSON-RPC (${lines.length} message)`);
  } catch (e) {
    ok(false, `stdout có rác không phải JSON: ${e.message}`);
    console.log("     ---\n" + stdout.slice(0, 400) + "\n     ---");
    process.exit(1);
  }

  const init = msgs.find((m) => m.id === 1);
  ok(!!init?.result, "initialize trả về result");
  ok(init?.result?.serverInfo?.name === "shared-memory-mcp", `serverInfo.name = ${init?.result?.serverInfo?.name}`);

  const list = msgs.find((m) => m.id === 2);
  const tools = list?.result?.tools ?? [];
  ok(tools.length > 0, `tools/list trả về ${tools.length} tool`);

  const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
  ok(!!byName.wiki_write, "có tool wiki_write (tool custom)");
  ok(!!byName.code_search, "có tool code_search (kế thừa từ upstream)");
  for (const n of ["wiki_search", "wiki_read", "wiki_list", "wiki_graph"]) {
    ok(byName[n] && !byName[n].inputSchema.required.includes("wiki_id"), `${n}: wiki_id không bắt buộc`);
  }
  ok(byName.wiki_search?.description?.includes("shared memory"), "wiki_search dùng description custom");
  ok(byName.code_search?.inputSchema?.required?.includes("code_graph_id"),
     "code_search giữ nguyên schema upstream");

  ok(stderr.includes("đã kết nối qua stdio"), "log khởi động ghi ra stderr");

  console.log(fail ? "\n❌ smoke test FAIL" : "\n✅ smoke test PASS");
  process.exit(fail);
});
