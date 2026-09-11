const fs = require('fs');
const path = require('path');

const localAppData = process.env.LOCALAPPDATA;
const appData = process.env.APPDATA;

const targets = [
  path.join(localAppData, 'Packages', 'Claude_pzs8sxrjxfjjc', 'LocalCache', 'Roaming', 'Claude', 'claude_desktop_config.json'),
  path.join(appData, 'Claude', 'claude_desktop_config.json')
];

const repoRoot = path.resolve(__dirname, '../../');
const tsxPath = path.join(repoRoot, 'MemoryKnowledge', 'node_modules', 'tsx', 'dist', 'cli.mjs');
const serverPath = path.join(repoRoot, 'MemoryKnowledge', 'src', 'mcp', 'server.ts');
const apiUrl = process.env.KNOWLEDGE_API_URL || 'http://127.0.0.1:8424';
const apiToken = process.env.KNOWLEDGE_API_TOKEN || 'sk-mem-token-placeholder';
const teamId = process.env.KNOWLEDGE_TEAM_ID || 'team-default';

const servers = {
  "1Agent": {
    command: process.execPath || "node",
    args: [
      "--no-warnings",
      tsxPath,
      serverPath
    ],
    env: {
      AGENT_NAME: "Claude Desktop",
      MCP_SERVER_NAME: "1Agent",
      KNOWLEDGE_API_URL: apiUrl,
      KNOWLEDGE_API_TOKEN: apiToken,
      KNOWLEDGE_TEAM_ID: teamId,
      KNOWLEDGE_WIKI_ID: process.env.AGENT_WIKI_ID || "wiki-jeq1u9eq"
    }
  },
  "2Cueos": {
    command: process.execPath || "node",
    args: [
      "--no-warnings",
      tsxPath,
      serverPath
    ],
    env: {
      AGENT_NAME: "Claude Desktop",
      MCP_SERVER_NAME: "2Cueos",
      KNOWLEDGE_API_URL: apiUrl,
      KNOWLEDGE_API_TOKEN: apiToken,
      KNOWLEDGE_TEAM_ID: teamId,
      KNOWLEDGE_WIKI_ID: process.env.PROJECT_WIKI_ID || "wiki-9sr5qg3i"
    }
  }
};

for (const p of targets) {
  if (fs.existsSync(p)) {
    let raw = fs.readFileSync(p, 'utf8');
    if (raw.charCodeAt(0) === 0xFEFF) {
      raw = raw.slice(1);
    }
    try {
      const data = JSON.parse(raw);
      data.mcpServers = servers;
      const cleanJson = JSON.stringify(data, null, 2);
      fs.writeFileSync(p, cleanJson, { encoding: 'utf8' });
      console.log('Successfully updated Claude config with new MCP names:', p);
    } catch (err) {
      console.error('Error updating Claude config:', p, err.message);
    }
  } else {
    console.log('Target path not found:', p);
  }
}
