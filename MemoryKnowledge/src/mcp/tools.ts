/**
 * MCP tool definitions — 12 query-class tools for LLM agents.
 *
 * Tools map to knowledge API query endpoints. Management operations
 * (create/delete/sync) are NOT exposed as MCP tools — those are control-plane
 * operations handled by the management UI.
 *
 * Code-Graph (8): code_search, code_explore, code_callers, code_callees,
 *                  code_impact, code_node, code_status, code_files
 * Wiki (4):        wiki_search, wiki_read, wiki_list, wiki_graph
 */

export interface McpToolDef {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
  /** HTTP endpoint to forward to (without /v3 prefix). */
  endpoint: string;
}

export const MCP_TOOLS: McpToolDef[] = [
  // ── Code-Graph (8) ──

  {
    name: "code_search",
    description: "Quick symbol search by name in a code graph. Returns locations only (no code); use code_explore to get source.",
    inputSchema: {
      type: "object",
      properties: {
        code_graph_id: { type: "string", description: "The code graph ID (cg-...)" },
        query: { type: "string", description: "Symbol name or partial name (e.g. \"auth\", \"signIn\", \"UserService\")" },
        kind: {
          type: "string",
          enum: ["function", "method", "class", "interface", "type", "variable", "route", "component"],
          description: "Optional node-kind filter. Omit to search all kinds (do NOT pass \"any\"/\"symbol\"/\"file\" — not valid, yields zero results).",
        },
        limit: { type: "integer", minimum: 1, maximum: 100, description: "Max results (default: 10)" },
      },
      required: ["code_graph_id", "query"],
    },
    endpoint: "/code-graph/search",
  },
  {
    name: "code_explore",
    description: "Explore files in a code graph matching a query.",
    inputSchema: {
      type: "object",
      properties: {
        code_graph_id: { type: "string", description: "The code graph ID (cg-...)" },
        query: { type: "string", description: "Search query" },
        maxFiles: { type: "integer", minimum: 1, maximum: 200, description: "Max files to return (default: 12)" },
      },
      required: ["code_graph_id", "query"],
    },
    endpoint: "/code-graph/explore",
  },
  {
    name: "code_callers",
    description: "Find all callers of a symbol in a code graph.",
    inputSchema: {
      type: "object",
      properties: {
        code_graph_id: { type: "string", description: "The code graph ID (cg-...)" },
        symbol: { type: "string", description: "Symbol name to find callers for" },
        limit: { type: "integer", minimum: 1, maximum: 200, description: "Max results (default: 20)" },
      },
      required: ["code_graph_id", "symbol"],
    },
    endpoint: "/code-graph/callers",
  },
  {
    name: "code_callees",
    description: "Find all callees (functions called by) a symbol in a code graph.",
    inputSchema: {
      type: "object",
      properties: {
        code_graph_id: { type: "string", description: "The code graph ID (cg-...)" },
        symbol: { type: "string", description: "Symbol name to find callees for" },
        limit: { type: "integer", minimum: 1, maximum: 200, description: "Max results (default: 20)" },
      },
      required: ["code_graph_id", "symbol"],
    },
    endpoint: "/code-graph/callees",
  },
  {
    name: "code_impact",
    description: "Analyze the impact of changing a symbol (dependency chain).",
    inputSchema: {
      type: "object",
      properties: {
        code_graph_id: { type: "string", description: "The code graph ID (cg-...)" },
        symbol: { type: "string", description: "Symbol name to analyze impact for" },
        depth: { type: "integer", minimum: 1, maximum: 10, description: "Analysis depth (default: 2)" },
      },
      required: ["code_graph_id", "symbol"],
    },
    endpoint: "/code-graph/impact",
  },
  {
    name: "code_node",
    description: "Get detailed information about a specific symbol node in a code graph.",
    inputSchema: {
      type: "object",
      properties: {
        code_graph_id: { type: "string", description: "The code graph ID (cg-...)" },
        symbol: { type: "string", description: "Symbol name" },
        includeCode: { type: "boolean", description: "Include source code (default: false)" },
        file: { type: "string", description: "File path to disambiguate" },
        line: { type: "integer", minimum: 1, description: "Line number to disambiguate" },
      },
      required: ["code_graph_id", "symbol"],
    },
    endpoint: "/code-graph/node",
  },
  {
    name: "code_status",
    description: "Get the indexing status of a code graph.",
    inputSchema: {
      type: "object",
      properties: {
        code_graph_id: { type: "string", description: "The code graph ID (cg-...)" },
      },
      required: ["code_graph_id"],
    },
    endpoint: "/code-graph/status",
  },
  {
    name: "code_files",
    description: "List files in a code graph, optionally filtered by path or pattern.",
    inputSchema: {
      type: "object",
      properties: {
        code_graph_id: { type: "string", description: "The code graph ID (cg-...)" },
        path: { type: "string", description: "Path prefix filter" },
        pattern: { type: "string", description: "Glob pattern filter" },
        format: { type: "string", enum: ["tree", "flat"], description: "Output format (default: tree)" },
        includeMetadata: { type: "boolean", description: "Include file metadata (default: true)" },
        maxDepth: { type: "integer", minimum: 1, description: "Max tree depth" },
      },
      required: ["code_graph_id"],
    },
    endpoint: "/code-graph/files",
  },

  // ── Wiki (4) ──

  {
    name: "wiki_search",
    description: "Search shared memory and wiki pages by keyword across all AI agents. ALWAYS call this tool automatically when the user asks a question about past facts, preferences, dates, passwords, or context.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        wiki_id: { type: "string", description: "The wiki ID (optional, defaults to shared wiki)" },
        limit: { type: "integer", description: "Max results (default: 20)" },
        hop: {
          type: "integer",
          minimum: 0,
          maximum: 5,
          description: "Graph expansion depth. 0 = pure BM25 (default), >0 = walk wikilink edges from seeds.",
        },
        decay: {
          type: "number",
          minimum: 0,
          maximum: 1,
          description: "Per-hop score decay factor when hop>0 (default 0.5).",
        },
        minScore: {
          type: "number",
          minimum: 0,
          description: "Minimum score threshold; nodes below this are dropped (default 0.1).",
        },
      },
      required: ["query"],
    },
    endpoint: "/wiki/search",
  },
  {
    name: "wiki_read",
    description: "Read wiki page content by reference (page id or path).",
    inputSchema: {
      type: "object",
      properties: {
        refs: {
          type: "array",
          items: { type: "string" },
          description: "Page references (ids or relative paths, without .md)",
        },
        wiki_id: { type: "string", description: "The wiki ID (optional, defaults to shared wiki)" },
      },
      required: ["refs"],
    },
    endpoint: "/wiki/page/read",
  },
  {
    name: "wiki_list",
    description: "List all wiki pages with metadata (title, type, path) in shared memory.",
    inputSchema: {
      type: "object",
      properties: {
        wiki_id: { type: "string", description: "The wiki ID (optional, defaults to shared wiki)" },
      },
      required: [],
    },
    endpoint: "/wiki/page/ls",
  },
  {
    name: "wiki_graph",
    description: "Get the wiki knowledge graph (nodes, edges, communities).",
    inputSchema: {
      type: "object",
      properties: {
        wiki_id: { type: "string", description: "The wiki ID (optional, defaults to shared wiki)" },
      },
      required: [],
    },
    endpoint: "/wiki/graph",
  },
  {
    name: "wiki_write",
    description: "Save facts, user preferences, events, dates, passwords, notes, or project information to shared persistent memory. ALWAYS call this tool automatically when the user mentions new information (e.g. 'hôm nay là...', 'nhớ là...', 'tôi tên...'). Do NOT just reply with text — call this tool immediately.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Page title or key (e.g. su_kien_hom_nay, pass_today, note_dev)" },
        content: { type: "string", description: "The text content or markdown note to store in memory" },
        wiki_id: { type: "string", description: "The wiki ID (optional, defaults to shared wiki)" },
      },
      required: ["title", "content"],
    },
    endpoint: "/wiki/page/write",
  },
];
