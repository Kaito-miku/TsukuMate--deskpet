"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ID_RE = /^[a-zA-Z0-9_-]{8,80}$/;
const LEGACY_RE = /^legacy-(\d{4}-\d{2}-\d{2})$/;

function atomicJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(temp, file);
}

function cleanTitle(value, max = 60) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function createConversationStore(root, options = {}) {
  const sessionsRoot = path.join(root, "sessions");
  const now = () => new Date().toISOString();
  const defaultTitle = () => options.defaultTitle || "新对话";
  const sessionDir = (id) => path.join(sessionsRoot, id);
  const metaPath = (id) => path.join(sessionDir(id), "meta.json");
  const messagesPath = (id) => path.join(sessionDir(id), "messages.jsonl");

  function validId(id) { return ID_RE.test(String(id || "")) || LEGACY_RE.test(String(id || "")); }
  function readMeta(id) {
    if (!ID_RE.test(String(id || ""))) return null;
    try { return JSON.parse(fs.readFileSync(metaPath(id), "utf8")); } catch { return null; }
  }
  function writeMeta(meta) {
    const branchType = ["inherit", "related", "vocabulary"].includes(meta.branchType) ? meta.branchType : null;
    const safe = {
      id: meta.id, title: cleanTitle(meta.title) || defaultTitle(),
      titleSource: ["placeholder", "ai", "user"].includes(meta.titleSource) ? meta.titleSource : "placeholder",
      titleGenerationAttempts: Math.max(0, Math.min(2, Number(meta.titleGenerationAttempts) || 0)),
      createdAt: meta.createdAt || now(), updatedAt: meta.updatedAt || now(),
      contextBoundaryId: meta.contextBoundaryId || null,
      parentConversationId: ID_RE.test(String(meta.parentConversationId || "")) ? meta.parentConversationId : null,
      branchPointMessageId: String(meta.branchPointMessageId || "").slice(0, 120) || null,
      branchType,
      parentSnapshot: branchType ? {
        title: cleanTitle(meta.parentSnapshot?.title, 100), summary: String(meta.parentSnapshot?.summary || "").slice(0, 2400),
        sentence: String(meta.parentSnapshot?.sentence || "").slice(0, 1400), term: String(meta.parentSnapshot?.term || "").slice(0, 160), definition: String(meta.parentSnapshot?.definition || "").slice(0, 800),
      } : null,
      topicSummary: String(meta.topicSummary || "").slice(0, 2400),
      summaryUpdatedAt: meta.summaryUpdatedAt || null,
      summaryVersion: Math.max(0, Math.min(1e6, Number(meta.summaryVersion) || 0)),
      contentVersion: Math.max(0, Math.min(1e6, Number(meta.contentVersion) || 0)),
    };
    atomicJson(metaPath(meta.id), safe);
    return safe;
  }
  function create(options = {}) {
    const id = `chat-${Date.now().toString(36)}-${crypto.randomBytes(5).toString("hex")}`;
    fs.mkdirSync(path.join(sessionDir(id), "attachments"), { recursive: true });
    return writeMeta({ id, title: cleanTitle(options.title) || defaultTitle(), titleSource: options.title ? "user" : "placeholder", titleGenerationAttempts: 0, createdAt: now(), updatedAt: now(), ...options });
  }
  function readMessages(id) {
    let file;
    const legacy = String(id || "").match(LEGACY_RE);
    if (legacy) file = path.join(root, `${legacy[1]}.jsonl`);
    else if (ID_RE.test(String(id || ""))) file = messagesPath(id);
    else return [];
    let raw = "";
    try { raw = fs.readFileSync(file, "utf8"); } catch { return []; }
    return raw.split(/\r?\n/).filter(Boolean).flatMap((line, index) => {
      try {
        const item = JSON.parse(line);
        if (!item || !["user", "assistant", "context-boundary"].includes(item.role)) return [];
        return [{ ...item, id: item.id || `${id}-${index}`, content: String(item.content || "") }];
      } catch { return []; }
    });
  }
  function append(id, message) {
    if (!validId(id)) throw new Error("Invalid conversation id");
    const legacy = String(id).match(LEGACY_RE);
    const file = legacy ? path.join(root, `${legacy[1]}.jsonl`) : messagesPath(id);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${JSON.stringify(message)}\n`, "utf8");
    if (!legacy) {
      const meta = readMeta(id);
      if (meta) writeMeta({ ...meta, updatedAt: now(), contextBoundaryId: message.role === "context-boundary" ? message.id : meta.contextBoundaryId, contentVersion: (meta.contentVersion || 0) + 1 });
    }
  }
  function list() {
    const result = [];
    try {
      for (const name of fs.readdirSync(sessionsRoot)) {
        const meta = readMeta(name);
        if (meta) result.push(meta);
      }
    } catch {}
    try {
      for (const name of fs.readdirSync(root)) {
        const match = name.match(/^(\d{4}-\d{2}-\d{2})\.jsonl$/);
        if (!match) continue;
        const stat = fs.statSync(path.join(root, name));
        result.push({ id: `legacy-${match[1]}`, title: match[1], titleSource: "placeholder", titleGenerationAttempts: 2, createdAt: match[1], updatedAt: stat.mtime.toISOString(), legacy: true });
      }
    } catch {}
    return result.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }
  function updateTitle(id, title, source = "user") {
    const meta = readMeta(id);
    if (!meta) throw new Error("Conversation not found");
    if (meta.titleSource === "user" && source === "ai") return meta;
    return writeMeta({ ...meta, title: cleanTitle(title) || meta.title, titleSource: source, updatedAt: now() });
  }
  function incrementTitleAttempt(id) {
    const meta = readMeta(id);
    if (!meta) return null;
    return writeMeta({ ...meta, titleGenerationAttempts: Math.min(2, (meta.titleGenerationAttempts || 0) + 1) });
  }
  function remove(id) {
    // Legacy date JSONL files are retained for backwards compatibility and
    // are intentionally not removable through the new conversation UI.
    if (!ID_RE.test(String(id || ""))) return false;
    const dir = sessionDir(id);
    if (!fs.existsSync(dir)) return false;
    fs.rmSync(dir, { recursive: true, force: false });
    return !fs.existsSync(dir);
  }
  function removeMessage(id, messageId) {
    // Keep legacy date-based archives read-only: only current, signed session
    // directories are eligible for a destructive single-message operation.
    if (!ID_RE.test(String(id || "")) || !String(messageId || "")) return false;
    const file = messagesPath(id);
    if (!fs.existsSync(file)) return false;
    const messages = readMessages(id);
    const next = messages.filter((message) => String(message.id) !== String(messageId));
    if (next.length === messages.length) return false;
    // messages.jsonl is deliberately JSON Lines, not a JSON array. Rewrite it
    // atomically so a restart can never observe a partially deleted history.
    const rewrite = `${file}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(rewrite, next.map((message) => JSON.stringify(message)).join("\n") + (next.length ? "\n" : ""), "utf8");
    fs.renameSync(rewrite, file);
    const meta = readMeta(id);
    if (meta) writeMeta({ ...meta, updatedAt: now(), contentVersion: (meta.contentVersion || 0) + 1 });
    return true;
  }
  function updateMessage(id, messageId, patch = {}) {
    if (!ID_RE.test(String(id || "")) || !String(messageId || "")) return null;
    const file = messagesPath(id);
    if (!fs.existsSync(file)) return null;
    const messages = readMessages(id);
    const index = messages.findIndex((message) => String(message.id) === String(messageId));
    if (index < 0) return null;
    const content = String(patch.content ?? "").slice(0, 16000);
    // A manually edited assistant response is plain user-owned content. Its
    // old derived cards/surfaces must not survive below the new text.
    const { richCards, a2uiSurfaces, ...plainMessage } = messages[index];
    messages[index] = { ...plainMessage, content, editedAt: now() };
    const rewrite = `${file}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(rewrite, messages.map((message) => JSON.stringify(message)).join("\n") + "\n", "utf8");
    fs.renameSync(rewrite, file);
    const meta = readMeta(id);
    if (meta) writeMeta({ ...meta, updatedAt: now(), contentVersion: (meta.contentVersion || 0) + 1 });
    return messages[index];
  }
  function updateDerivedMessage(id, messageId, patch = {}) {
    if (!ID_RE.test(String(id || "")) || !String(messageId || "")) return null;
    const file = messagesPath(id); if (!fs.existsSync(file)) return null;
    const messages = readMessages(id); const index = messages.findIndex((message) => String(message.id) === String(messageId));
    if (index < 0 || messages[index].role !== "assistant") return null;
    const annotations = Array.isArray(patch.learningAnnotations) ? patch.learningAnnotations.slice(0, 8).map((item, itemIndex) => ({ id: String(item?.id || `term-${itemIndex + 1}`).slice(0, 80), start: Math.max(0, Math.min(16000, Number(item?.start) || 0)), end: Math.max(0, Math.min(16000, Number(item?.end) || 0)), term: String(item?.term || "").slice(0, 160), definition: String(item?.definition || "").slice(0, 800) })).filter((item) => item.end > item.start && item.term && item.definition) : [];
    messages[index] = { ...messages[index], learningAnnotations: annotations };
    const rewrite = `${file}.tmp-${process.pid}-${Date.now()}`; fs.writeFileSync(rewrite, messages.map((message) => JSON.stringify(message)).join("\n") + "\n", "utf8"); fs.renameSync(rewrite, file);
    return messages[index];
  }
  function updateSummary(id, summary, version) { const meta = readMeta(id); if (!meta) return null; return writeMeta({ ...meta, topicSummary: String(summary || "").slice(0, 2400), summaryUpdatedAt: now(), summaryVersion: Math.max(0, Number(version) || meta.contentVersion || 0) }); }
  function removeTree(id) { if (!ID_RE.test(String(id || "")) || !readMeta(id)) return false; const ids = new Set([id]); let changed = true; while (changed) { changed = false; for (const meta of list()) if (meta.parentConversationId && ids.has(meta.parentConversationId) && !ids.has(meta.id)) { ids.add(meta.id); changed = true; } } for (const childId of ids) { const dir = sessionDir(childId); if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: false }); } return true; }
  function attachmentDir(id) {
    if (!ID_RE.test(String(id || ""))) throw new Error("Attachments require a current conversation");
    const dir = path.join(sessionDir(id), "attachments"); fs.mkdirSync(dir, { recursive: true }); return dir;
  }
  return { validId, create, list, readMeta, readMessages, append, updateTitle, incrementTitleAttempt, remove, removeTree, removeMessage, updateMessage, updateDerivedMessage, updateSummary, attachmentDir, cleanTitle };
}

module.exports = { createConversationStore, cleanTitle, ID_RE, LEGACY_RE };
