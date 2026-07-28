"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

const MAX_FILES = 5;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
const MAX_TEXT_PER_FILE = 40000;
const MAX_TEXT_TOTAL = 80000;
const TYPES = {
  ".pdf": ["application/pdf", "document"], ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "document"],
  ".txt": ["text/plain", "document"], ".md": ["text/markdown", "document"], ".csv": ["text/csv", "document"],
  ".png": ["image/png", "image"], ".jpg": ["image/jpeg", "image"], ".jpeg": ["image/jpeg", "image"], ".webp": ["image/webp", "image"],
};
const CLIPBOARD_IMAGE_TYPES = new Map([
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/webp", ".webp"],
]);

function safeName(value) {
  const base = path.basename(String(value || "attachment")).replace(/[\u0000-\u001f<>:"/\\|?*]/g, "_").trim();
  return (base || "attachment").slice(0, 180);
}

function publicAttachment(meta) {
  return { id: meta.id, name: meta.name, mimeType: meta.mimeType, size: meta.size, kind: meta.kind };
}

function createStudyAttachmentService({ dialog, shell, nativeImage, store, getWindow }) {
  const pending = new Map();

  function paths(conversationId, attachmentId) {
    const dir = store.attachmentDir(conversationId);
    return { dir, meta: path.join(dir, `${attachmentId}.json`), text: path.join(dir, `${attachmentId}.txt`) };
  }
  function readMeta(conversationId, attachmentId) {
    if (!/^[a-f0-9]{20}$/.test(String(attachmentId || ""))) return null;
    try { return JSON.parse(fs.readFileSync(paths(conversationId, attachmentId).meta, "utf8")); } catch { return null; }
  }
  async function extractText(filePath, extension) {
    if (extension === ".pdf") return String((await pdfParse(fs.readFileSync(filePath))).text || "").slice(0, MAX_TEXT_PER_FILE);
    if (extension === ".docx") return String((await mammoth.extractRawText({ path: filePath })).value || "").slice(0, MAX_TEXT_PER_FILE);
    return fs.readFileSync(filePath, "utf8").slice(0, MAX_TEXT_PER_FILE);
  }
  async function select(conversationId, senderId) {
    if (!store.readMeta(conversationId)) return { ok: false, error: "请先创建新对话" };
    const result = await dialog.showOpenDialog(getWindow(), {
      title: "选择学习附件", properties: ["openFile", "multiSelections"],
      filters: [
        { name: "学习文件", extensions: ["pdf", "docx", "txt", "md", "csv", "png", "jpg", "jpeg", "webp"] },
        { name: "全部文件", extensions: ["*"] },
      ],
    });
    if (result.canceled) return { ok: true, attachments: [] };
    const existing = [...pending.values()].filter((item) => item.conversationId === conversationId && item.senderId === senderId);
    const selected = result.filePaths.slice(0, Math.max(0, MAX_FILES - existing.length));
    if (!selected.length && result.filePaths.length) return { ok: false, error: "每条消息最多上传 5 个附件" };
    let total = existing.reduce((sum, item) => sum + (Number(item.size) || 0), 0);
    const specs = [];
    for (const source of selected) {
      const extension = path.extname(source).toLowerCase();
      const type = TYPES[extension];
      if (!type) return { ok: false, error: `不支持的附件格式：${path.basename(source)}` };
      const size = fs.statSync(source).size;
      if (size > MAX_FILE_BYTES) return { ok: false, error: `附件超过 20 MB：${path.basename(source)}` };
      total += size;
      if (total > MAX_TOTAL_BYTES) return { ok: false, error: "附件总大小不能超过 50 MB" };
      specs.push({ source, extension, size, mimeType: type[0], kind: type[1] });
    }
    const created = [];
    try {
      for (const spec of specs) {
        const id = crypto.randomBytes(10).toString("hex");
        const name = safeName(spec.source);
        const target = path.join(store.attachmentDir(conversationId), `${id}-${name}`);
        fs.copyFileSync(spec.source, target);
        const meta = { id, conversationId, name, mimeType: spec.mimeType, kind: spec.kind, size: spec.size, storedName: path.basename(target), committed: false };
        if (spec.kind === "document") {
          const text = await extractText(target, spec.extension);
          fs.writeFileSync(paths(conversationId, id).text, text, "utf8");
          meta.truncated = text.length >= MAX_TEXT_PER_FILE;
        }
        fs.writeFileSync(paths(conversationId, id).meta, JSON.stringify(meta, null, 2), "utf8");
        pending.set(id, { conversationId, senderId, size: meta.size });
        created.push(publicAttachment(meta));
      }
      return { ok: true, attachments: created };
    } catch (error) {
      for (const item of created) discard(conversationId, item.id, senderId);
      return { ok: false, error: String(error && error.message || error) };
    }
  }
  function addClipboardImage(conversationId, senderId, payload = {}) {
    if (!store.readMeta(conversationId)) return { ok: false, error: "请先创建新对话" };
    const mimeType = String(payload.mimeType || "").toLowerCase();
    const extension = CLIPBOARD_IMAGE_TYPES.get(mimeType);
    const dataUrl = String(payload.dataUrl || "");
    if (!extension || !dataUrl.startsWith(`data:${mimeType};base64,`)) return { ok: false, error: "仅支持粘贴 PNG、JPEG 或 WebP 图片" };
    const encoded = dataUrl.slice(`data:${mimeType};base64,`.length);
    // Reject malformed data before decoding. This is a renderer boundary, not
    // a general-purpose file upload API, so no paths or filenames are accepted.
    if (!encoded || encoded.length > Math.ceil(MAX_FILE_BYTES * 4 / 3) + 8 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 !== 0) return { ok: false, error: "剪贴板图片数据无效或超过 20 MB" };
    let bytes;
    try { bytes = Buffer.from(encoded, "base64"); } catch { return { ok: false, error: "剪贴板图片数据无效" }; }
    if (!bytes.length || bytes.length > MAX_FILE_BYTES) return { ok: false, error: "单张图片不能超过 20 MB" };
    const existing = [...pending.values()].filter((item) => item.conversationId === conversationId && item.senderId === senderId);
    if (existing.length >= MAX_FILES) return { ok: false, error: "每条消息最多上传 5 个附件" };
    if (existing.reduce((sum, item) => sum + (Number(item.size) || 0), 0) + bytes.length > MAX_TOTAL_BYTES) return { ok: false, error: "附件总大小不能超过 50 MB" };
    const id = crypto.randomBytes(10).toString("hex");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const name = `clipboard-${stamp}${extension}`;
    const target = path.join(store.attachmentDir(conversationId), `${id}-${name}`);
    const meta = { id, conversationId, name, mimeType, kind: "image", size: bytes.length, storedName: path.basename(target), committed: false };
    try {
      fs.writeFileSync(target, bytes, { flag: "wx" });
      fs.writeFileSync(paths(conversationId, id).meta, JSON.stringify(meta, null, 2), "utf8");
      pending.set(id, { conversationId, senderId, size: meta.size });
      return { ok: true, attachment: publicAttachment(meta) };
    } catch (error) {
      try { fs.unlinkSync(target); } catch {}
      try { fs.unlinkSync(paths(conversationId, id).meta); } catch {}
      return { ok: false, error: String(error && error.message || error) };
    }
  }
  function discard(conversationId, attachmentId, senderId) {
    const owner = pending.get(String(attachmentId));
    if (!owner || owner.conversationId !== conversationId || owner.senderId !== senderId) return false;
    const meta = readMeta(conversationId, attachmentId);
    const p = paths(conversationId, attachmentId);
    try { if (meta) fs.unlinkSync(path.join(p.dir, meta.storedName)); } catch {}
    try { fs.unlinkSync(p.text); } catch {}
    try { fs.unlinkSync(p.meta); } catch {}
    pending.delete(String(attachmentId));
    return true;
  }
  function commit(conversationId, ids, senderId) {
    const result = [];
    for (const id of Array.isArray(ids) ? ids.slice(0, MAX_FILES) : []) {
      const owner = pending.get(String(id));
      const meta = readMeta(conversationId, id);
      if (!owner || owner.conversationId !== conversationId || owner.senderId !== senderId || !meta) throw new Error("附件已失效，请重新选择");
      meta.committed = true;
      fs.writeFileSync(paths(conversationId, id).meta, JSON.stringify(meta, null, 2), "utf8");
      pending.delete(String(id)); result.push(publicAttachment(meta));
    }
    return result;
  }
  function discardForSender(senderId) {
    for (const [id, owner] of [...pending]) if (owner.senderId === senderId) discard(owner.conversationId, id, senderId);
  }
  function buildModelContent(conversationId, messages) {
    const normalized = [];
    let textBudget = MAX_TEXT_TOTAL;
    for (const message of Array.isArray(messages) ? messages : []) {
      if (!message || !["user", "assistant"].includes(message.role)) continue;
      if (message.role !== "user" || !Array.isArray(message.attachments) || !message.attachments.length) {
        normalized.push({ role: message.role, content: String(message.content || "") }); continue;
      }
      const content = [{ type: "text", text: String(message.content || "") }];
      for (const attachment of message.attachments) {
        const meta = readMeta(conversationId, attachment.id);
        if (!meta || !meta.committed) continue;
        const p = paths(conversationId, meta.id);
        if (meta.kind === "document" && textBudget > 0) {
          let value = ""; try { value = fs.readFileSync(p.text, "utf8").slice(0, textBudget); } catch {}
          textBudget -= value.length;
          content.push({ type: "text", text: `\n[附件：${meta.name}]\n${value}${meta.truncated ? "\n[内容已截断]" : ""}` });
        } else if (meta.kind === "image") {
          try {
            let image = nativeImage.createFromPath(path.join(p.dir, meta.storedName));
            const size = image.getSize(); const longest = Math.max(size.width, size.height);
            if (longest > 2048) image = image.resize({ width: Math.max(1, Math.round(size.width * 2048 / longest)), height: Math.max(1, Math.round(size.height * 2048 / longest)), quality: "good" });
            content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${image.toJPEG(85).toString("base64")}` } });
          } catch {}
        }
      }
      normalized.push({ role: "user", content });
    }
    return normalized;
  }
  async function open(conversationId, attachmentId) {
    const meta = readMeta(conversationId, attachmentId);
    if (!meta || !meta.committed) return { ok: false, error: "附件不存在" };
    const error = await shell.openPath(path.join(paths(conversationId, attachmentId).dir, meta.storedName));
    return error ? { ok: false, error } : { ok: true };
  }
  return { select, addClipboardImage, discard, commit, discardForSender, buildModelContent, open, readMeta };
}

module.exports = { createStudyAttachmentService, safeName, MAX_FILES, MAX_FILE_BYTES, MAX_TOTAL_BYTES, MAX_TEXT_PER_FILE, MAX_TEXT_TOTAL };
