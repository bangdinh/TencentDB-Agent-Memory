#!/usr/bin/env node
/**
 * Cấp phát trọn gói một project: team trong MemoryCore → wiki trong Knowledge
 * → bootstrap wiki sang trạng thái ready → sinh cấu hình MCP vào thư mục project.
 *
 *   node custom/provision-project.mjs <project-id> [thư-mục-project] [tuỳ chọn]
 *
 * Tuỳ chọn:
 *   --team-name <tên>   Tên team hiển thị trong Panel (mặc định = project-id)
 *   --reuse-team <id>   Dùng team đã có thay vì tạo mới (để nhiều project chung team)
 *   --no-config         Chỉ cấp team/wiki, không ghi file cấu hình
 *
 * Chạy lại an toàn: team trùng tên thì dùng lại, wiki trùng tên thì dùng lại,
 * wiki đã ready thì bỏ qua bootstrap, file cấu hình đã có thì KHÔNG ghi đè.
 *
 * Vì sao cần script này: wiki mới tạo nằm ở status='draft', mà pageLs chặn cứng
 * mọi thứ chưa 'ready' → wiki_write báo thành công nhưng wiki_list/wiki_search
 * trả rỗng, không một lời báo lỗi. Xem custom/docs/USER_GUIDE.md mục 10.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CUSTOM_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(CUSTOM_DIR, "..");
const DEPLOY_DIR = join(REPO_ROOT, "deploy", "global-images");

const die = (m) => { console.error(`\n❌ ${m}\n`); process.exit(1); };
const ok = (m) => console.log(`  ✅ ${m}`);
const info = (m) => console.log(`  ·  ${m}`);

// ── tham số ────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
let projectId = "", targetDir = "", teamName = "", reuseTeam = "", writeConfig = true;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--team-name") teamName = argv[++i] ?? "";
  else if (a === "--reuse-team") reuseTeam = argv[++i] ?? "";
  else if (a === "--no-config") writeConfig = false;
  else if (a.startsWith("-")) die(`Tham số lạ: ${a}`);
  else if (!projectId) projectId = a;
  else if (!targetDir) targetDir = a;
  else die(`Thừa tham số: ${a}`);
}
if (!projectId) die("Dùng: node custom/provision-project.mjs <project-id> [thư-mục] [--team-name X]");

// Knowledge nối id thành đường dẫn file nên chỉ nhận [A-Za-z0-9_-], tối đa 200.
if (!/^[A-Za-z0-9_-]{1,200}$/.test(projectId))
  die(`project-id chỉ được gồm A-Z a-z 0-9 _ - (không dấu chấm), tối đa 200 ký tự.\n   Nhận được: '${projectId}'`);
teamName ||= projectId;

// ── đọc .env + .admin-key ──────────────────────────────────────────────
const envFile = join(DEPLOY_DIR, ".env");
if (!existsSync(envFile)) die(`Thiếu ${envFile} — stack chưa được cấu hình.`);
const env = Object.fromEntries(
  readFileSync(envFile, "utf8").split("\n")
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/\s+#.*$/, "").trim()]),
);
const CORE = `http://127.0.0.1:${env.MEMORY_CORE_PORT || 8420}`;
const KS = `http://127.0.0.1:${env.KNOWLEDGE_PORT || 8424}`;
const SERVICE_ID = "default";

const keyFile = join(DEPLOY_DIR, ".admin-key");
if (!existsSync(keyFile)) die(`Thiếu ${keyFile} — chạy deploy/global-images/start-memory-core.sh trước.`);
const ADMIN_KEY = readFileSync(keyFile, "utf8").trim();

// ── HTTP ───────────────────────────────────────────────────────────────
async function post(base, path, body, withUserKey = false) {
  const headers = { "Content-Type": "application/json", "x-tdai-service-id": SERVICE_ID };
  if (withUserKey) headers["x-tdai-user-key"] = ADMIN_KEY;
  let res;
  try {
    res = await fetch(base + path, { method: "POST", headers, body: JSON.stringify(body) });
  } catch (e) {
    die(`Không gọi được ${base}${path} — stack chưa chạy?\n   ${e.message}`);
  }
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json };
}
const dataOf = (r, what) => {
  if (r.json?.code && r.json.code !== 0) die(`${what} lỗi (HTTP ${r.status}): ${r.json.message}`);
  return r.json?.data ?? r.json;
};

// ── 1. xác thực admin ──────────────────────────────────────────────────
console.log(`\nCấp phát project "${projectId}"\n`);
const me = dataOf(await post(CORE, "/v3/meta/auth/verify", { user_key: ADMIN_KEY }), "auth/verify");
if (!me?.valid) die("admin key không hợp lệ — kiểm tra deploy/global-images/.admin-key");
const userId = me.user.user_id;
ok(`admin ${me.user.username} (${userId})`);

// ── 2. team: dùng lại hoặc tạo mới ─────────────────────────────────────
let teamId = reuseTeam;
if (teamId) {
  info(`dùng lại team có sẵn: ${teamId}`);
} else {
  const list = dataOf(await post(CORE, "/v3/meta/team/list", { user_id: userId }, true), "team/list");
  const items = Array.isArray(list) ? list : (list?.items ?? []);
  const found = items.find((t) => t.name === teamName);
  if (found) {
    teamId = found.team_id;
    info(`team "${teamName}" đã có → ${teamId}`);
  } else {
    const created = dataOf(
      await post(CORE, "/v3/meta/team/create", { name: teamName, owner_user_id: userId }, true),
      "team/create",
    );
    teamId = created.team_id ?? created.team?.team_id;
    if (!teamId) die(`team/create không trả team_id: ${JSON.stringify(created).slice(0, 200)}`);
    ok(`tạo team "${teamName}" → ${teamId}`);
  }
}

// ── 3. wiki ────────────────────────────────────────────────────────────
const wiki = dataOf(await post(KS, "/v3/wiki/create", { team_id: teamId, name: projectId, user_id: userId }), "wiki/create");
const wikiId = wiki.wiki_id;
ok(`wiki "${projectId}" → ${wikiId} (status=${wiki.status})`);

// ── 4. bootstrap draft → ready ─────────────────────────────────────────
if (wiki.status === "ready") {
  info("wiki đã ready, bỏ qua bootstrap");
} else {
  const raws = dataOf(await post(KS, "/v3/wiki/raw/ls", { team_id: teamId, wiki_id: wikiId }), "raw/ls");
  const hasSource = (Array.isArray(raws) ? raws : raws?.items ?? []).length > 0;
  if (!hasSource) {
    const seed = `# ${projectId}\n\nWiki bộ nhớ của project "${projectId}".\nTrang mầm để khởi tạo; nội dung thật sẽ được agent ghi bằng wiki_write.\n`;
    dataOf(await post(KS, "/v3/wiki/raw/write", {
      team_id: teamId, wiki_id: wikiId,
      files: [{ filename: "seed.md", content: seed }],   // trường là `filename`, KHÔNG phải `name`
    }), "raw/write");
    ok("nạp file mầm seed.md");
  }
  dataOf(await post(KS, "/v3/wiki/ingest", { team_id: teamId, wiki_id: wikiId }), "ingest");
  process.stdout.write("  ·  ingest (LLM đang chạy)");
  let final = null;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    process.stdout.write(".");
    const d = dataOf(await post(KS, "/v3/wiki/get", { team_id: teamId, wiki_id: wikiId }), "wiki/get");
    if (d.status === "ready" || d.status === "failed") { final = d; break; }
  }
  console.log();
  if (!final) die("ingest quá 3 phút chưa xong — xem: docker logs tdai-memory-hub");
  if (final.status === "failed") die(`ingest thất bại: ${final.sync_error ?? "không rõ"}`);
  ok(`wiki ready (${final.page_count} trang)`);
}

// ── 5. cấu hình MCP ────────────────────────────────────────────────────
const serverName = `memory-${projectId}`;
const isWin = process.platform === "win32";
const body = isWin
  ? { command: "cmd.exe", args: ["/c", join(REPO_ROOT, "custom", "scripts", "start-mcp.bat")] }
  : { command: "bash", args: [join(REPO_ROOT, "custom", "scripts", "start-mcp.sh")] };
body.env = { KNOWLEDGE_PROJECT_ID: projectId, KNOWLEDGE_TEAM_ID: teamId };

const block = JSON.stringify({ mcpServers: { [serverName]: body } }, null, 2) + "\n";
const vscode = JSON.stringify({ servers: { [serverName]: { type: "stdio", ...body } } }, null, 2) + "\n";

if (!writeConfig || !targetDir) {
  console.log(`\n── Cấu hình MCP (chưa ghi file) ──\n`);
  console.log(block);
} else {
  const root = resolve(targetDir);
  if (!existsSync(root)) die(`Không thấy thư mục: ${root}`);
  console.log(`\n  Ghi cấu hình vào ${root}`);
  for (const [rel, content] of [
    [".mcp.json", block], [".cursor/mcp.json", block],
    [".agents/mcp_config.json", block], [".vscode/mcp.json", vscode],
  ]) {
    const p = join(root, rel);
    if (existsSync(p)) { info(`⏭  ${rel} đã có — không ghi đè`); continue; }
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
    ok(rel);
  }
  const claudeMd = join(root, "CLAUDE.md");
  if (!existsSync(claudeMd)) {
    writeFileSync(claudeMd, `# Bộ nhớ — luật chọn server

Project này có MCP server riêng: **\`${serverName}\`** (wiki \`${projectId}\`, team \`${teamId}\`).

Ghi và tra bộ nhớ đều dùng \`${serverName}\`: \`wiki_write\` để ghi, \`wiki_search\`
để tra trước khi trả lời câu hỏi gợi nhớ.

**KHÔNG dùng \`memory-agents\`** trong project này — đó là bộ nhớ cá nhân dùng
chung cho mọi nơi, ghi nội dung project vào đó là lẫn ngữ cảnh và không gỡ ra được.

Các server có tool trùng tên (\`wiki_write\`, \`wiki_search\`, …) nên phải nhìn
tiền tố server để chọn đúng.
`);
    ok("CLAUDE.md");
  } else info("⏭  CLAUDE.md đã có — không ghi đè");
}

console.log(`
──────────────────────────────────────────────
  project   ${projectId}
  team      ${teamId}   (Panel hiển thị "${teamName}")
  wiki      ${wikiId}
  server    ${serverName}
──────────────────────────────────────────────
  Restart agent để nạp cấu hình mới.
`);
