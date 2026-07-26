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
    const safe = {
      id: meta.id, title: cleanTitle(meta.title) || defaultTitle(),
      titleSource: ["placeholder", "ai", "user"].includes(meta.titleSource) ? meta.titleSource : "placeholder",
      titleGenerationAttempts: Math.max(0, Math.min(2, Number(meta.titleGenerationAttempts) || 0)),
      createdAt: meta.createdAt || now(), updatedAt: meta.updatedAt || now(),
      contextBoundaryId: meta.contextBoundaryId || null,
    };
    atomicJson(metaPath(meta.id), safe);
    return safe;
  }
  function create() {
    const id = `chat-${Date.now().toString(36)}-${crypto.randomBytes(5).toString("hex")}`;
    fs.mkdirSync(path.join(sessionDir(id), "attachments"), { recursive: true });
    return writeMeta({ id, title: defaultTitle(), titleSource: "placeholder", titleGenerationAttempts: 0, createdAt: now(), updatedAt: now() });
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
      if (meta) writeMeta({ ...meta, updatedAt: now(), contextBoundaryId: message.role === "context-boundary" ? message.id : meta.contextBoundaryId });
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
  function attachmentDir(id) {
    if (!ID_RE.test(String(id || ""))) throw new Error("Attachments require a current conversation");
    const dir = path.join(sessionDir(id), "attachments"); fs.mkdirSync(dir, { recursive: true }); return dir;
  }
  return { validId, create, list, readMeta, readMessages, append, updateTitle, incrementTitleAttempt, attachmentDir, cleanTitle };
}

module.exports = { createConversationStore, cleanTitle, ID_RE, LEGACY_RE };
