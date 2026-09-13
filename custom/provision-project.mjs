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

// ── 4. đăng ký asset trong Core ────────────────────────────────────────
// Wiki sống ở HAI nơi: file thật do Knowledge giữ, và một bản ghi "asset" trong
// Core dùng để kiểm quyền. /v3/wiki/create chỉ tạo cái đầu — thiếu cái sau thì
// danh sách wiki trong Panel vẫn hiện (lấy từ Knowledge) nhưng bấm vào xem chi
// tiết là 404 "asset_not_found", kèm toast "Failed to load Wiki details".
const assetGet = await post(CORE, "/v3/meta/asset/get", { asset_id: wikiId }, true);
if (!assetGet.json?.code) {
  info("asset đã đăng ký trong Core");
} else {
  dataOf(await post(CORE, "/v3/meta/asset/create", {
    asset_id: wikiId,               // dùng lại wiki_id làm asset_id để hai bên khớp
    team_id: teamId,
    asset_type: "llm_wiki",
    name: projectId,
    owner_user_id: userId,
    source_type: "knowledge",
    visibility: "team",
    status: "approved",
    description: `Wiki bo nho cua project ${projectId}`,
  }, true), "asset/create");
  ok("đăng ký asset trong Core (Panel xem được chi tiết wiki)");
}

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
    writeFileSync(claudeMd, `# Bộ nhớ chung — bắt buộc dùng chủ động

Project này có MCP server bộ nhớ riêng: **\`${serverName}\`**
(wiki \`${projectId}\`, team \`${teamId}\`).

## QUAN TRỌNG: ghi nhớ chủ động, không đợi được nhắc

Người dùng sẽ **KHÔNG** nhắc bạn dùng bộ nhớ. Bạn phải tự quản lý nó — chủ
động, tự động, và im lặng (không báo cáo mỗi lần ghi).

### 1. Tự động GHI (\`${serverName}\` → \`wiki_write\`)

Ngay khi người dùng để lộ bất kỳ thông tin có giá trị lâu dài nào, gọi
\`wiki_write\` luôn, không hỏi xin phép:

- **Kỹ thuật & cấu hình**: endpoint, port, domain, tên service, biến môi
  trường, schema DB, hạ tầng, phiên bản công cụ
- **Quyết định & lý do**: chọn thư viện/kiến trúc nào và **vì sao**, phương án
  đã cân nhắc rồi loại bỏ, đánh đổi đã chấp nhận
- **Quy ước dự án**: coding convention, quy tắc đặt tên, quy trình review,
  cách đặt commit message
- **Dặn dò & mốc thời gian**: deadline, việc còn treo, điều cần tránh

### Ngôn ngữ và cách đặt tên

**\`title\` phải là TIẾNG ANH, snake_case** — \`decision_auth_flow\`,
\`naming_convention\`, \`staging_infra\`, \`vm_system_architecture\`.

Hai lý do. Thứ nhất, hệ thống sinh page id bằng cách bỏ dấu khỏi title, nên
tiếng Việt có dấu bị băm nát: "Bộ nhớ chung của Bằng" thành
\`concepts/b-nh-chung-c-a-b-ng\` — không đọc được, không tra theo id được nữa.
Thứ hai, tiếng Việt không dấu cũng khó đọc và khó đoán khi liệt kê
(\`quy_tac_cau_hinh_memory_theo_du_an\`), trong khi tiếng Anh vừa ngắn vừa rõ.

**\`content\` viết tiếng Việt có dấu**, giữ nguyên thuật ngữ tiếng Anh (MQTT,
Compose, RPC, gRPC…). Đừng dịch nội dung sang tiếng Anh: người dùng tra bằng
tiếng Việt, mà BM25 không dịch — tra tiếng Việt vào kho tiếng Anh là trượt.
Thuật ngữ tiếng Anh mới là từ khoá mang trọng số cao nhất, nên giữ nguyên.

Nêu cả **lý do** chứ không chỉ kết luận.

Bỏ qua: chào hỏi, cảm ơn, tán gẫu, và những gì đọc thẳng từ code ra được.

### 2. Tự động TRA (\`${serverName}\` → \`wiki_search\`)

Gọi \`wiki_search\` **trước khi trả lời** mọi câu hỏi có thể đã bàn trước đó:
quyết định cũ, quy ước, cấu hình, "hôm trước mình chốt gì". Đừng vội kết luận
là không biết khi chưa tra.

## Chỉ ghi MỘT chỗ — đừng nhân đôi

Mọi thứ thuộc project này ghi vào \`${serverName}\`, và **chỉ vào đó**.

**KHÔNG ghi thêm một bản sang \`memory-general\`.** Ghi cả hai chỗ là nhân
đôi dữ liệu: lần sau tra ra hai bản, sửa một bản thì bản kia lặng lẽ thành sai,
và không có cách nào biết bản nào mới hơn.

\`memory-general\` chỉ dành cho thứ **không thuộc project nào** — sở thích
cá nhân, cách làm việc chung, ghi chú vụn. Khi đang làm trong thư mục project
thì gần như không bao giờ cần tới nó.

Các server có tool trùng tên (\`wiki_write\`, \`wiki_search\`, …) nên phải
nhìn tiền tố server để chọn cho đúng.
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
