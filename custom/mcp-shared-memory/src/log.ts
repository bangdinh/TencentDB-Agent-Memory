/**
 * Log ra stderr, luôn luôn.
 *
 * MCP stdio transport dùng stdout cho JSON-RPC — bất kỳ thứ gì khác ghi vào
 * stdout đều làm hỏng protocol. Đây chính là lý do trước kia phải patch
 * MemoryKnowledge/src/logger.ts; giờ vấn đề nằm gọn trong code của mình.
 */

const LEVELS = ["debug", "info", "warn", "error"] as const;
type Level = (typeof LEVELS)[number];

const threshold = ((): number => {
  const want = (process.env.MCP_LOG_LEVEL || "info").toLowerCase();
  const i = LEVELS.indexOf(want as Level);
  return i === -1 ? LEVELS.indexOf("info") : i;
})();

function emit(level: Level, msg: string, data?: unknown) {
  if (LEVELS.indexOf(level) < threshold) return;
  const suffix = data === undefined ? "" : ` ${JSON.stringify(data)}`;
  process.stderr.write(`[${new Date().toISOString()}] ${level.toUpperCase()} shared-memory ${msg}${suffix}\n`);
}

export const log = {
  debug: (m: string, d?: unknown) => emit("debug", m, d),
  info: (m: string, d?: unknown) => emit("info", m, d),
  warn: (m: string, d?: unknown) => emit("warn", m, d),
  error: (m: string, d?: unknown) => emit("error", m, d),
};
