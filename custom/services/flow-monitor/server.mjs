import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');
const EVENTS_FILE = path.join(DATA_DIR, 'flow_events.json');
const JS_FILE = path.join(__dirname, 'flow-inspector.js');

const PORT = parseInt(process.env.FLOW_MONITOR_PORT || '8126', 10);
const HOST = '0.0.0.0';

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let events = [];
if (fs.existsSync(EVENTS_FILE)) {
  try {
    events = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
    if (!Array.isArray(events)) events = [];
  } catch (_) {
    events = [];
  }
}

const sseClients = new Set();

function saveEvents() {
  try {
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(events.slice(0, 100), null, 2), 'utf8');
  } catch (err) {
    console.error('[FlowMonitor] Error saving events:', err.message);
  }
}

function broadcastEvent(evt) {
  const payload = `data: ${JSON.stringify(evt)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch (_) {
      sseClients.delete(res);
    }
  }
}

// Inject into Docker container if container tdai-memory-hub exists
export function syncWithDockerContainer() {
  try {
    // 1. Copy flow-inspector.js to container web dist
    exec(`docker cp "${JS_FILE}" tdai-memory-hub:/app/panel/web/dist/flow-inspector.js`, (err) => {
      if (err) return;
      console.log('[FlowMonitor] Synced flow-inspector.js to tdai-memory-hub');
    });

    // 2. Ensure index.html in container has script tag
    const checkScriptCmd = `docker exec tdai-memory-hub cat /app/panel/web/dist/index.html`;
    exec(checkScriptCmd, (err, stdout) => {
      if (err || !stdout) return;
      if (!stdout.includes('flow-inspector.js')) {
        const injected = stdout.replace(
          '</body>',
          '  <script src="/flow-inspector.js"></script>\n  </body>'
        );
        // Write injected index.html to container
        const tmpFile = path.join(DATA_DIR, 'temp_index.html');
        fs.writeFileSync(tmpFile, injected, 'utf8');
        exec(`docker cp "${tmpFile}" tdai-memory-hub:/app/panel/web/dist/index.html`, () => {
          try { fs.unlinkSync(tmpFile); } catch (_) {}
          console.log('[FlowMonitor] Injected flow-inspector.js script tag into tdai-memory-hub index.html');
        });
      }
    });
  } catch (e) {
    // Docker sync is best-effort
  }
}

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // 1. SSE Stream
  if (url.pathname === '/api/stream' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write(': keepalive\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // 2. Get Events
  if (url.pathname === '/api/events' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(events));
    return;
  }

  // 3. Post Event
  if (url.pathname === '/api/events' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const evt = JSON.parse(body);
        if (!evt.id) evt.id = 'evt-' + Date.now();
        if (!evt.timestamp) evt.timestamp = new Date().toLocaleTimeString();
        events.unshift(evt);
        if (events.length > 100) events.pop();
        saveEvents();
        broadcastEvent(evt);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, id: evt.id }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 4. Test Event Generation
  if (url.pathname === '/api/test' && req.method === 'POST') {
    const testEvt = {
      id: 'test-' + Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      agent: 'Claude Desktop',
      mcp_server: 'tencent-memory-agent',
      tool: 'wiki_search',
      wiki_id: 'wiki-jeq1u9eq',
      wiki_name: 'Agent Memory',
      query: 'Tìm kiếm hồ sơ cá nhân và thói quen',
      duration_ms: 38,
      status: 'SUCCESS',
      page_overview: [
        {
          title: 'user_profile',
          score: 0.96,
          overview: 'Tên: Developer. Vai trò: Kỹ sư Phần mềm. Tech stack: Vue, React, Node.js, Tencent Cloud.',
        },
        {
          title: 'workflow_rules',
          score: 0.89,
          overview: 'Quy tắc: Tự động ghi nhớ các thiết lập quan trọng, kiểm soát luồng rõ ràng trên giao diện.',
        },
      ],
    };
    events.unshift(testEvt);
    if (events.length > 100) events.pop();
    saveEvents();
    broadcastEvent(testEvt);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(testEvt));
    return;
  }

  // 5. Delete Events
  if (url.pathname === '/api/events' && req.method === 'DELETE') {
    events = [];
    saveEvents();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // 6. Serve flow-inspector.js
  if (url.pathname === '/flow-inspector.js') {
    if (fs.existsSync(JS_FILE)) {
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
      fs.createReadStream(JS_FILE).pipe(res);
      return;
    }
  }

  // 7. Standalone Dashboard Page
  if (url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <title>TencentDB Agent Memory — Flow Inspector</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            margin: 0;
            padding: 40px 20px;
            background: #0b1120;
            color: #f8fafc;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .container {
            width: 100%;
            max-width: 900px;
          }
          .title-card {
            background: #1e293b;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 24px 30px;
            margin-bottom: 24px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.4);
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          h1 { margin: 0 0 6px 0; font-size: 22px; color: #38bdf8; display: flex; align-items: center; gap: 10px; }
          p { margin: 0; font-size: 13px; color: #94a3b8; }
          .btn-hub {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 10px 18px;
            background: #0052d9;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 13px;
            transition: background 0.2s;
          }
          .btn-hub:hover { background: #0064fa; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="title-card">
            <div>
              <h1>⚡ Live Agent Activity Flow Dashboard</h1>
              <p>Trực tiếp giám sát luồng: <b>Agent ➔ MCP ➔ Wiki ➔ Page Overview</b></p>
            </div>
            <a href="http://${req.headers.host.split(':')[0]}:8125/#/wiki" class="btn-hub" target="_blank">
              Trở lại Memory Hub ➔
            </a>
          </div>
          <div id="flow-content-list" style="display: flex; flex-direction: column; gap: 16px;"></div>
        </div>
        <script src="/flow-inspector.js"></script>
        <script>
          // Automatically open inspector in full page
          window.addEventListener('load', () => {
            const fab = document.getElementById('flow-inspector-fab');
            if (fab) fab.click();
          });
        </script>
      </body>
      </html>
    `);
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, HOST, () => {
  console.log(`[FlowMonitor] Server listening at http://${HOST}:${PORT}`);
  console.log(`[FlowMonitor] Dashboard: http://localhost:${PORT}`);
  // Sync to Docker tdai-memory-hub on boot
  syncWithDockerContainer();
  setInterval(syncWithDockerContainer, 15000); // re-sync every 15s to guarantee injection
});
