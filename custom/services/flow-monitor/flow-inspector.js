/**
 * Flow Inspector Widget — Tích hợp trực tiếp vào Memory Hub (:8125)
 * Hiển thị luồng hoạt động: Agent -> MCP Tool -> Target Wiki -> Page Overview
 */
(function () {
  if (window.__FLOW_INSPECTOR_INITIALIZED__) return;
  window.__FLOW_INSPECTOR_INITIALIZED__ = true;

  const HOST = window.location.hostname || '127.0.0.1';
  const API_PORT = 8126;
  const STREAM_URL = `http://${HOST}:${API_PORT}/api/stream`;
  const EVENTS_URL = `http://${HOST}:${API_PORT}/api/events`;
  const TEST_URL = `http://${HOST}:${API_PORT}/api/test`;

  let events = [];
  let isOpen = false;
  let eventSource = null;
  let activeFilter = 'all';

  // Inject Styles
  const style = document.createElement('style');
  style.id = 'flow-inspector-styles';
  style.textContent = `
    #flow-inspector-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      background: linear-gradient(135deg, #0052d9 0%, #1e3a8a 100%);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 9999px;
      box-shadow: 0 8px 24px rgba(0, 82, 217, 0.35);
      cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      font-weight: 600;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      user-select: none;
    }
    #flow-inspector-fab:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 28px rgba(0, 82, 217, 0.5);
      background: linear-gradient(135deg, #0064fa 0%, #2563eb 100%);
    }
    .flow-pulse-dot {
      width: 8px;
      height: 8px;
      background-color: #22c55e;
      border-radius: 50%;
      box-shadow: 0 0 8px #22c55e;
      animation: flow-pulse 2s infinite;
    }
    @keyframes flow-pulse {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
      70% { transform: scale(1.1); box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
    }
    #flow-badge-count {
      background: rgba(255, 255, 255, 0.25);
      padding: 2px 7px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
    }
    #flow-inspector-drawer {
      position: fixed;
      top: 0;
      right: 0;
      width: 540px;
      max-width: 90vw;
      height: 100vh;
      background: #0f172a;
      color: #f8fafc;
      z-index: 1000000;
      box-shadow: -10px 0 40px rgba(0, 0, 0, 0.6);
      transform: translateX(100%);
      transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      border-left: 1px solid rgba(255, 255, 255, 0.1);
    }
    #flow-inspector-drawer.open {
      transform: translateX(0);
    }
    .flow-header {
      padding: 16px 20px;
      background: #1e293b;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .flow-title-group h3 {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .flow-title-group p {
      margin: 3px 0 0 0;
      font-size: 11px;
      color: #94a3b8;
    }
    .flow-header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .flow-btn {
      padding: 6px 11px;
      font-size: 11px;
      font-weight: 600;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      cursor: pointer;
      background: #334155;
      color: #f8fafc;
      transition: all 0.2s ease;
    }
    .flow-btn:hover {
      background: #475569;
    }
    .flow-btn-primary {
      background: #0052d9;
      border-color: #0052d9;
    }
    .flow-btn-primary:hover {
      background: #0064fa;
    }
    .flow-btn-close {
      background: transparent;
      border: none;
      font-size: 16px;
      color: #94a3b8;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
    }
    .flow-btn-close:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.1);
    }
    .flow-filter-bar {
      padding: 10px 20px;
      background: #131d31;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      display: flex;
      gap: 6px;
      overflow-x: auto;
    }
    .flow-filter-pill {
      padding: 4px 10px;
      font-size: 11px;
      border-radius: 999px;
      background: #1e293b;
      color: #94a3b8;
      border: 1px solid rgba(255, 255, 255, 0.08);
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s;
    }
    .flow-filter-pill.active {
      background: #0052d9;
      color: #ffffff;
      border-color: #0052d9;
      font-weight: 600;
    }
    .flow-content {
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .flow-empty {
      text-align: center;
      padding: 60px 20px;
      color: #64748b;
    }
    .flow-empty-icon {
      font-size: 36px;
      margin-bottom: 12px;
    }
    .flow-card {
      background: #1e293b;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 14px 16px;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
      transition: border-color 0.2s;
    }
    .flow-card:hover {
      border-color: rgba(0, 82, 217, 0.5);
    }
    .flow-card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    .flow-time {
      font-size: 11px;
      color: #64748b;
      font-family: monospace;
    }
    .flow-latency {
      font-size: 11px;
      background: rgba(34, 197, 94, 0.15);
      color: #4ade80;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 600;
      font-family: monospace;
    }
    .flow-pipeline {
      display: flex;
      flex-direction: column;
      gap: 10px;
      position: relative;
    }
    .flow-step {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      position: relative;
    }
    .flow-step:not(:last-child)::after {
      content: '';
      position: absolute;
      left: 14px;
      top: 26px;
      width: 2px;
      height: calc(100% - 10px);
      background: linear-gradient(to bottom, #0052d9, rgba(255,255,255,0.1));
    }
    .flow-step-icon {
      width: 30px;
      height: 30px;
      border-radius: 8px;
      background: #0f172a;
      border: 1px solid rgba(255, 255, 255, 0.12);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      flex-shrink: 0;
      z-index: 1;
    }
    .flow-step-body {
      flex: 1;
      padding-top: 3px;
    }
    .flow-step-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #94a3b8;
      margin-bottom: 2px;
    }
    .flow-step-value {
      font-size: 13px;
      font-weight: 600;
      color: #f8fafc;
    }
    .flow-step-sub {
      font-size: 11px;
      color: #cbd5e1;
      margin-top: 4px;
      background: #0f172a;
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.05);
      font-family: monospace;
      word-break: break-all;
    }
    .flow-page-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #0284c7;
      color: #ffffff;
      padding: 3px 8px;
      border-radius: 5px;
      font-size: 11px;
      font-weight: 600;
      margin-top: 4px;
      margin-right: 6px;
    }
    .flow-score-badge {
      background: rgba(255, 255, 255, 0.25);
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 10px;
    }
    .flow-overview-box {
      margin-top: 8px;
      padding: 8px 10px;
      background: #090e17;
      border-left: 3px solid #0052d9;
      border-radius: 4px;
      font-size: 11px;
      color: #94a3b8;
      line-height: 1.5;
      max-height: 120px;
      overflow-y: auto;
    }
  `;
  document.head.appendChild(style);

  // Inject DOM
  const fab = document.createElement('div');
  fab.id = 'flow-inspector-fab';
  fab.innerHTML = `
    <div class="flow-pulse-dot"></div>
    <span>⚡ Flow Inspector</span>
    <span id="flow-badge-count">0</span>
  `;
  document.body.appendChild(fab);

  const drawer = document.createElement('div');
  drawer.id = 'flow-inspector-drawer';
  drawer.innerHTML = `
    <div class="flow-header">
      <div class="flow-title-group">
        <h3>⚡ Live Agent Flow Inspector</h3>
        <p>Sơ đồ luồng: Agent ➔ MCP ➔ Wiki ➔ Page Overview</p>
      </div>
      <div class="flow-header-actions">
        <button id="flow-btn-test" class="flow-btn flow-btn-primary" title="Tạo thử một sự kiện để kiểm tra luồng">🧪 Test Event</button>
        <button id="flow-btn-clear" class="flow-btn" title="Xoá lịch sử">🗑️ Xoá</button>
        <button id="flow-btn-close" class="flow-btn-close">✕</button>
      </div>
    </div>
    <div class="flow-filter-bar">
      <div class="flow-filter-pill active" data-filter="all">Tất cả</div>
      <div class="flow-filter-pill" data-filter="claude">Claude Desktop</div>
      <div class="flow-filter-pill" data-filter="antigravity">Antigravity</div>
      <div class="flow-filter-pill" data-filter="agent-memory">Agent Memory</div>
      <div class="flow-filter-pill" data-filter="cueos">Project Cueos</div>
    </div>
    <div class="flow-content" id="flow-content-list">
      <div class="flow-empty">
        <div class="flow-empty-icon">🛰️</div>
        <div>Đang lắng nghe luồng hoạt động từ MCP...</div>
        <div style="font-size: 11px; margin-top: 8px; color: #475569;">
          Hãy trò chuyện với Claude Desktop hoặc Antigravity, hoặc bấm nút <b>"Test Event"</b> để thử nghiệm ngay!
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(drawer);

  // Events & Interactions
  fab.addEventListener('click', () => toggleDrawer(true));
  drawer.querySelector('#flow-btn-close').addEventListener('click', () => toggleDrawer(false));

  function toggleDrawer(open) {
    isOpen = open;
    if (isOpen) {
      drawer.classList.add('open');
      renderEvents();
    } else {
      drawer.classList.remove('open');
    }
  }

  // Filter Buttons
  drawer.querySelectorAll('.flow-filter-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      drawer.querySelectorAll('.flow-filter-pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      activeFilter = pill.getAttribute('data-filter');
      renderEvents();
    });
  });

  // Clear Button
  drawer.querySelector('#flow-btn-clear').addEventListener('click', async () => {
    events = [];
    updateBadge();
    renderEvents();
    try {
      await fetch(EVENTS_URL, { method: 'DELETE' });
    } catch (_) {}
  });

  // Test Event Button
  drawer.querySelector('#flow-btn-test').addEventListener('click', async () => {
    try {
      const res = await fetch(TEST_URL, { method: 'POST' });
      const newEvt = await res.json();
      addEvent(newEvt);
    } catch (e) {
      // Local fallback test event
      addEvent({
        id: 'test-' + Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        agent: 'Claude Desktop',
        mcp_server: 'tencent-memory-agent',
        tool: 'wiki_search',
        wiki_id: 'wiki-jeq1u9eq',
        wiki_name: 'Agent Memory',
        query: 'Thông tin hồ sơ của người dùng',
        duration_ms: 45,
        status: 'SUCCESS',
        page_overview: [
          {
            title: 'user_profile',
            score: 0.96,
            overview: 'Hồ sơ: Lê Huỳnh Thuận. Tech stack: Vue, React, Node.js, Python.',
          },
          {
            title: 'project_preferences',
            score: 0.88,
            overview: 'Quy chuẩn: Thích giao diện hiện đại, tối giản, hiển thị luồng trực quan.',
          },
        ],
      });
    }
  });

  function updateBadge() {
    const badge = document.getElementById('flow-badge-count');
    if (badge) badge.textContent = events.length;
  }

  function addEvent(evt) {
    events.unshift(evt);
    if (events.length > 50) events.pop();
    updateBadge();
    if (isOpen) renderEvents();
  }

  function renderEvents() {
    const container = document.getElementById('flow-content-list');
    if (!container) return;

    let filtered = events;
    if (activeFilter === 'claude') {
      filtered = events.filter((e) => (e.agent || '').toLowerCase().includes('claude'));
    } else if (activeFilter === 'antigravity') {
      filtered = events.filter((e) => (e.agent || '').toLowerCase().includes('antigravity'));
    } else if (activeFilter === 'agent-memory') {
      filtered = events.filter((e) => (e.wiki_name || '').includes('Agent Memory') || e.wiki_id === 'wiki-jeq1u9eq');
    } else if (activeFilter === 'cueos') {
      filtered = events.filter((e) => (e.wiki_name || '').includes('Cueos') || e.wiki_id === 'wiki-9sr5qg3i');
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="flow-empty">
          <div class="flow-empty-icon">🛰️</div>
          <div>Chưa có dữ liệu luồng phù hợp.</div>
          <div style="font-size: 11px; margin-top: 8px; color: #475569;">
            Hãy bấm <b>"Test Event"</b> để tạo thử nghiệm một luồng gọi mẫu!
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered
      .map((e) => {
        const pages = Array.isArray(e.page_overview) ? e.page_overview : (e.page_overview ? [e.page_overview] : []);
        const pagesHtml = pages.length > 0
          ? pages.map(p => `
              <div style="margin-top: 6px;">
                <span class="flow-page-badge">
                  📄 ${escapeHtml(p.title || p.ref || 'Trang')}
                  ${p.score ? `<span class="flow-score-badge">Độ khớp: ${(p.score * 100).toFixed(0)}%</span>` : ''}
                </span>
                ${p.overview ? `<div class="flow-overview-box">${escapeHtml(p.overview)}</div>` : ''}
              </div>
            `).join('')
          : `<div class="flow-overview-box" style="font-style: italic;">Không có trang nào được trích xuất</div>`;

        return `
          <div class="flow-card">
            <div class="flow-card-top">
              <span class="flow-time">🕒 ${escapeHtml(e.timestamp || '')}</span>
              <span class="flow-latency">⚡ ${e.duration_ms || 0}ms</span>
            </div>
            <div class="flow-pipeline">
              <!-- Chặng 1: Agent -->
              <div class="flow-step">
                <div class="flow-step-icon">🤖</div>
                <div class="flow-step-body">
                  <div class="flow-step-label">1. Khởi xướng Agent</div>
                  <div class="flow-step-value" style="color: #60a5fa;">${escapeHtml(e.agent || 'AI Agent')}</div>
                </div>
              </div>

              <!-- Chặng 2: MCP Tool -->
              <div class="flow-step">
                <div class="flow-step-icon">⚡</div>
                <div class="flow-step-body">
                  <div class="flow-step-label">2. MCP Server & Tool</div>
                  <div class="flow-step-value" style="color: #fbbf24;">
                    ${escapeHtml(e.mcp_server || 'tencent-memory')} ➔ <code>${escapeHtml(e.tool || 'tool')}</code>
                  </div>
                  ${e.query ? `<div class="flow-step-sub"><b>Truy vấn:</b> "${escapeHtml(e.query)}"</div>` : ''}
                </div>
              </div>

              <!-- Chặng 3: Target Wiki -->
              <div class="flow-step">
                <div class="flow-step-icon">📚</div>
                <div class="flow-step-body">
                  <div class="flow-step-label">3. Target Wiki Knowledge</div>
                  <div class="flow-step-value" style="color: #34d399;">
                    ${escapeHtml(e.wiki_name || 'Wiki')}
                    <span style="font-size: 11px; color: #64748b; font-weight: normal;">(${escapeHtml(e.wiki_id || '')})</span>
                  </div>
                </div>
              </div>

              <!-- Chặng 4: Page Overview -->
              <div class="flow-step">
                <div class="flow-step-icon">📄</div>
                <div class="flow-step-body">
                  <div class="flow-step-label">4. Page Overview Trích Xuất</div>
                  ${pagesHtml}
                </div>
              </div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Connect SSE Stream
  function connectStream() {
    try {
      eventSource = new EventSource(STREAM_URL);
      eventSource.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          addEvent(data);
        } catch (_) {}
      };
      eventSource.onerror = () => {
        eventSource.close();
        // Retry polling fallback
        setTimeout(pollEvents, 3000);
      };
    } catch (_) {
      pollEvents();
    }
  }

  async function pollEvents() {
    try {
      const res = await fetch(EVENTS_URL + '?t=' + Date.now());
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          events = data;
          updateBadge();
          if (isOpen) renderEvents();
        }
      }
    } catch (_) {}
    setTimeout(pollEvents, 3000);
  }

  // Init
  pollEvents();
  connectStream();
})();
