"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ID_RE = /^problem-[a-z0-9-]{8,80}$/;
const IMAGE_TYPES = new Map([
  [".png", "image/png"], [".jpg", "image/jpeg"], [".jpeg", "image/jpeg"], [".webp", "image/webp"],
]);
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

function now() { return new Date().toISOString(); }
function cleanText(value, max = 100) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
function deriveTitle(markdown) {
  const heading = String(markdown || "").match(/^\s*#\s+(.+)$/m);
  const line = String(markdown || "").split(/\r?\n/).map((item) => item.replace(/^\s*#+\s*/, "").trim()).find(Boolean);
  return cleanText(heading ? heading[1] : line, 60) || "未命名编程题";
}
// Vision models often return otherwise-correct problem statements with
// LaTeX delimiters.  The workbench deliberately renders safe Markdown rather
// than a full TeX engine, so normalize the small mathematical subset normally
// used by programming problems before the user sees or edits it.
function normalizeOcrMarkdown(value) {
  const inlineMath = (source) => String(source || "")
    .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, "$1/$2")
    .replace(/\\(?:leq?|le)/g, "≤").replace(/\\(?:geq?|ge)/g, "≥")
    .replace(/\\neq/g, "≠").replace(/\\in/g, "∈").replace(/\\times/g, "×")
    .replace(/\\cdot/g, "·").replace(/\\dots|\\ldots|\\cdots/g, "…")
    .replace(/\\(?:left|right|mathrm|text|operatorname)\s*/g, "")
    .replace(/\\[ ,;!]/g, " ").replace(/[{}]/g, "").replace(/\\/g, "").trim();
  return String(value || "").replace(/\r\n?/g, "\n")
    .replace(/\\\(([^\n]*?)\\\)/g, (_whole, math) => inlineMath(math))
    .replace(/\$([^$\n]+)\$/g, (_whole, math) => inlineMath(math));
}
function atomicJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(temporary, file);
}

function createCodingQaService({ root, dialog, getWindow, ocr }) {
  const problemsRoot = path.join(root, "problems");
  const dir = (id) => path.join(problemsRoot, id);
  const metaPath = (id) => path.join(dir(id), "meta.json");
  const markdownPath = (id) => path.join(dir(id), "problem.md");
  const messagesPath = (id) => path.join(dir(id), "messages.jsonl");
  const runnerPath = (id) => path.join(dir(id), "runner.json");
  const attachmentsDir = (id) => path.join(dir(id), "attachments");
  const validId = (id) => ID_RE.test(String(id || ""));

  function readMeta(id) {
    if (!validId(id)) return null;
    try { return JSON.parse(fs.readFileSync(metaPath(id), "utf8")); } catch { return null; }
  }
  function writeMeta(meta) {
    const safe = {
      id: meta.id,
      title: cleanText(meta.title, 60) || "未命名编程题",
      createdAt: meta.createdAt || now(),
      updatedAt: meta.updatedAt || now(),
      image: meta.image && typeof meta.image === "object" ? {
        id: String(meta.image.id || ""), name: cleanText(meta.image.name, 180), mimeType: String(meta.image.mimeType || ""), size: Number(meta.image.size) || 0, storedName: String(meta.image.storedName || ""),
      } : null,
      source: meta.source && typeof meta.source === "object" ? { provider: cleanText(meta.source.provider, 32), url: String(meta.source.url || "").slice(0, 2048), importedAt: String(meta.source.importedAt || "") } : null,
    };
    atomicJson(metaPath(safe.id), safe);
    return safe;
  }
  function summary(meta) { return { id: meta.id, title: meta.title, createdAt: meta.createdAt, updatedAt: meta.updatedAt, hasImage: !!meta.image }; }
  function get(id) {
    const meta = readMeta(id); if (!meta) return null;
    let markdown = ""; try { markdown = normalizeOcrMarkdown(fs.readFileSync(markdownPath(id), "utf8")); } catch {}
    return { ...summary(meta), markdown, image: meta.image ? { id: meta.image.id, name: meta.image.name, mimeType: meta.image.mimeType, size: meta.image.size } : null, source: meta.source || null, runner: readRunner(id), messages: readMessages(id) };
  }
  function list() {
    let entries = [];
    try { entries = fs.readdirSync(problemsRoot).map(readMeta).filter(Boolean); } catch {}
    return entries.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).map(summary);
  }
  function create() {
    const id = `problem-${Date.now().toString(36)}-${crypto.randomBytes(5).toString("hex")}`;
    fs.mkdirSync(attachmentsDir(id), { recursive: true });
    fs.writeFileSync(markdownPath(id), "", "utf8");
    return get(writeMeta({ id, title: "未命名编程题", createdAt: now(), updatedAt: now() }).id);
  }
  function save(id, input = {}) {
    const meta = readMeta(id); if (!meta) throw new Error("题目不存在");
    const markdown = typeof input.markdown === "string" ? input.markdown.slice(0, 200000) : (() => { try { return fs.readFileSync(markdownPath(id), "utf8"); } catch { return ""; } })();
    fs.writeFileSync(markdownPath(id), markdown, "utf8");
    const title = input.title === undefined ? (meta.title === "未命名编程题" ? deriveTitle(markdown) : meta.title) : cleanText(input.title, 60);
    writeMeta({ ...meta, title: title || deriveTitle(markdown), updatedAt: now() });
    return get(id);
  }
  function readRunner(id) {
    if (!validId(id)) return { language: "cpp", code: { cpp: "", python: "" }, tests: [], lastRun: null };
    try {
      const raw = JSON.parse(fs.readFileSync(runnerPath(id), "utf8"));
      const tests = Array.isArray(raw.tests) ? raw.tests.slice(0, 60).flatMap((item, index) => item && typeof item === "object" ? [{ id: /^[a-z0-9-]{1,80}$/i.test(String(item.id || "")) ? String(item.id) : `test-${index + 1}`, input: String(item.input || "").slice(0, 65536), output: String(item.output || "").slice(0, 65536), source: item.source === "sample" ? "sample" : "custom" }] : []) : [];
      return { language: raw.language === "python" ? "python" : "cpp", code: { cpp: String(raw.code?.cpp || "").slice(0, 200000), python: String(raw.code?.python || "").slice(0, 200000) }, tests, lastRun: raw.lastRun && typeof raw.lastRun === "object" ? raw.lastRun : null };
    } catch { return { language: "cpp", code: { cpp: "", python: "" }, tests: [], lastRun: null }; }
  }
  function saveRunner(id, patch = {}) {
    const meta = readMeta(id); if (!meta) throw new Error("题目不存在"); const previous = readRunner(id);
    const language = patch.language === "python" ? "python" : patch.language === "cpp" ? "cpp" : previous.language;
    const code = { cpp: typeof patch.code?.cpp === "string" ? patch.code.cpp.slice(0, 200000) : previous.code.cpp, python: typeof patch.code?.python === "string" ? patch.code.python.slice(0, 200000) : previous.code.python };
    const tests = Array.isArray(patch.tests) ? patch.tests.slice(0, 60).map((item, index) => ({ id: /^[a-z0-9-]{1,80}$/i.test(String(item?.id || "")) ? String(item.id) : `test-${Date.now().toString(36)}-${index}`, input: String(item?.input || "").slice(0, 65536), output: String(item?.output || "").slice(0, 65536), source: item?.source === "sample" ? "sample" : "custom" })) : previous.tests;
    const result = { language, code, tests, lastRun: patch.lastRun === undefined ? previous.lastRun : patch.lastRun };
    atomicJson(runnerPath(id), result); writeMeta({ ...meta, updatedAt: now() }); return get(id);
  }
  function importProblem(input = {}) {
    const problem = create();
    const meta = readMeta(problem.id); const markdown = String(input.markdown || "").slice(0, 200000); const title = cleanText(input.title, 60) || deriveTitle(markdown);
    writeMeta({ ...meta, title, source: { provider: cleanText(input.source?.provider, 32), url: String(input.source?.url || "").slice(0, 2048), importedAt: now() }, updatedAt: now() });
    fs.writeFileSync(markdownPath(problem.id), markdown, "utf8"); saveRunner(problem.id, { tests: Array.isArray(input.tests) ? input.tests : [] }); return get(problem.id);
  }
  function rename(id, title) { return save(id, { title }); }
  function remove(id) {
    if (!validId(id) || !fs.existsSync(dir(id))) return false;
    fs.rmSync(dir(id), { recursive: true, force: true }); return true;
  }
  function readMessages(id) {
    if (!validId(id)) return [];
    let raw = ""; try { raw = fs.readFileSync(messagesPath(id), "utf8"); } catch { return []; }
    return raw.split(/\r?\n/).filter(Boolean).flatMap((line, index) => {
      try {
        const item = JSON.parse(line);
        if (!item || !["user", "assistant"].includes(item.role)) return [];
        return [{ id: item.id || `${id}-${index}`, role: item.role, content: String(item.content || ""), thinking: String(item.thinking || "").slice(0, 200000), thinkingState: ["thinking", "complete", "unavailable"].includes(item.thinkingState) ? item.thinkingState : undefined, error: item.error === true, timestamp: item.timestamp || now() }];
      } catch { return []; }
    });
  }
  function appendMessage(id, message) {
    if (!readMeta(id) || !message || !["user", "assistant"].includes(message.role)) throw new Error("题目或消息无效");
    fs.appendFileSync(messagesPath(id), `${JSON.stringify({ id: String(message.id || `${message.role}-${Date.now()}`), role: message.role, content: String(message.content || "").slice(0, 200000), thinking: message.role === "assistant" ? String(message.thinking || "").slice(0, 200000) : undefined, thinkingState: message.role === "assistant" && ["thinking", "complete", "unavailable"].includes(message.thinkingState) ? message.thinkingState : undefined, error: message.error === true || undefined, timestamp: message.timestamp || now() })}\n`, "utf8");
    const meta = readMeta(id); writeMeta({ ...meta, updatedAt: now() });
  }
  async function selectImage(id) {
    if (!readMeta(id)) return { ok: false, error: "题目不存在" };
    const result = await dialog.showOpenDialog(getWindow(), { title: "选择编程题图片", properties: ["openFile"], filters: [{ name: "图片", extensions: ["png", "jpg", "jpeg", "webp"] }] });
    if (result.canceled || !result.filePaths[0]) return { ok: true, canceled: true };
    const source = result.filePaths[0]; const extension = path.extname(source).toLowerCase(); const mimeType = IMAGE_TYPES.get(extension);
    if (!mimeType) return { ok: false, error: "仅支持 PNG、JPG/JPEG 或 WebP 图片" };
    const size = fs.statSync(source).size; if (!size || size > MAX_IMAGE_BYTES) return { ok: false, error: "题目图片不能超过 20 MB" };
    const meta = readMeta(id); if (meta.image?.storedName) { try { fs.unlinkSync(path.join(attachmentsDir(id), meta.image.storedName)); } catch {} }
    const imageId = crypto.randomBytes(10).toString("hex"); const name = path.basename(source).replace(/[\u0000-\u001f<>:"/\\|?*]/g, "_").slice(0, 180) || `problem${extension}`;
    const storedName = `${imageId}-${name}`; fs.mkdirSync(attachmentsDir(id), { recursive: true }); fs.copyFileSync(source, path.join(attachmentsDir(id), storedName));
    writeMeta({ ...meta, image: { id: imageId, name, mimeType, size, storedName }, updatedAt: now() });
    return { ok: true, problem: get(id) };
  }
  function readImage(id) {
    const meta = readMeta(id); if (!meta?.image?.storedName) return { ok: false, error: "题目图片不存在" };
    try { const bytes = fs.readFileSync(path.join(attachmentsDir(id), meta.image.storedName)); return { ok: true, image: { id: meta.image.id, name: meta.image.name, mimeType: meta.image.mimeType, dataUrl: `data:${meta.image.mimeType};base64,${bytes.toString("base64")}` } }; } catch { return { ok: false, error: "无法读取题目图片" }; }
  }
  async function recognize(id) {
    const image = readImage(id); if (!image.ok) return image;
    if (typeof ocr !== "function") return { ok: false, error: "当前未配置视觉识别服务" };
    const markdown = normalizeOcrMarkdown(await ocr(image.image.dataUrl));
    if (!String(markdown || "").trim()) return { ok: false, error: "未识别到题目文字" };
    return { ok: true, problem: save(id, { markdown }) };
  }
  return { validId, list, create, get, save, rename, remove, readMessages, appendMessage, selectImage, readImage, recognize, readRunner, saveRunner, importProblem };
}

module.exports = { createCodingQaService, deriveTitle, normalizeOcrMarkdown, IMAGE_TYPES, MAX_IMAGE_BYTES };
