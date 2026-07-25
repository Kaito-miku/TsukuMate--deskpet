"use strict";

function parseHistoryLines(day, lines, startIndex = 0) {
  return lines.flatMap((line, offset) => {
    try {
      const item = JSON.parse(line);
      if (!item || !["user", "assistant"].includes(item.role) || typeof item.content !== "string") return [];
      return [{ id: `${day}-${startIndex + offset}`, role: item.role, content: item.content, timestamp: item.timestamp || null }];
    } catch { return []; }
  });
}

function paginateHistoryLines(day, lines, before, requestedLimit = 100) {
  const limit = Math.max(20, Math.min(200, Number(requestedLimit) || 100));
  const parsedBefore = before == null || before === "" ? lines.length : Number(before);
  const end = Number.isInteger(parsedBefore) ? Math.max(0, Math.min(lines.length, parsedBefore)) : lines.length;
  const start = Math.max(0, end - limit);
  return {
    messages: parseHistoryLines(day, lines.slice(start, end), start),
    nextCursor: start > 0 ? String(start) : null,
    hasMore: start > 0,
    total: lines.length,
  };
}

module.exports = { parseHistoryLines, paginateHistoryLines };
