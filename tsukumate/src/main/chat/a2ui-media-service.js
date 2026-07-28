"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const SOURCE_ID = /^source-[a-f0-9]{20}$/;
const MODEL_ID = /^model-[a-f0-9]{20}$/;
const MAX_MODEL_BYTES = 30 * 1024 * 1024;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const modelId = () => `model-${crypto.randomBytes(10).toString("hex")}`;
const sourceId = () => `source-${crypto.randomBytes(10).toString("hex")}`;

function safeUrl(value) { try { const url = new URL(String(value || "")); const host = url.hostname.toLowerCase(); if (!/^https:$/.test(url.protocol) || host === "localhost" || host.endsWith(".local") || /^127\.|^10\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\.|^0\.|^\[?(::1|fc|fd|fe80)/i.test(host)) return null; return url; } catch { return null; } }
function clean(value, max = 240) { return String(value || "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max); }
function providerFor(url) {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "youtube.com" || host === "youtu.be" || host.endsWith("youtube-nocookie.com")) return "youtube";
  if (host === "bilibili.com" || host.endsWith("bilibili.com") || host === "b23.tv") return "bilibili";
  return "web";
}
function youtubeEmbed(url) {
  const id = url.hostname.includes("youtu.be") ? url.pathname.split("/").filter(Boolean)[0] : url.searchParams.get("v") || url.pathname.match(/\/embed\/([^/?]+)/)?.[1];
  return /^[\w-]{6,20}$/.test(id || "") ? `https://www.youtube-nocookie.com/embed/${id}` : "";
}
function bilibiliEmbed(url) {
  const bvid = url.searchParams.get("bvid") || url.pathname.match(/\/video\/(BV[\w]+)/i)?.[1];
  return /^BV[\w]+$/i.test(bvid || "") ? `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(bvid)}` : "";
}

function createA2uiMediaService({ root, dialog, shell }) {
  const sourceStore = new Map();
  const modelsDir = path.join(root, "learning", "a2ui-models");
  const modelMeta = (id) => path.join(modelsDir, `${id}.json`);
  const modelFile = (id, extension) => path.join(modelsDir, `${id}${extension}`);
  function registerSearchSources(items = []) {
    return items.slice(0, 8).flatMap((item) => {
      const url = safeUrl(item?.url); if (!url) return [];
      const id = sourceId(); const provider = providerFor(url); const record = { id, url: url.toString(), provider, title: clean(item.name || item.title || url.hostname), retrievedAt: new Date().toISOString(), expiresAt: Date.now() + 12 * 60 * 60 * 1000 };
      sourceStore.set(id, record); return [record];
    });
  }
  async function cacheImage(url) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 8000);
    try { const response = await fetch(url, { signal: controller.signal, redirect: "error", headers: { accept: "image/avif,image/webp,image/png,image/jpeg,image/gif" } }); const type = String(response.headers.get("content-type") || "").toLowerCase().split(";")[0]; const length = Number(response.headers.get("content-length") || 0); if (!response.ok || !/^image\/(png|jpeg|webp|gif|avif)$/.test(type) || length > MAX_IMAGE_BYTES) return ""; const bytes = Buffer.from(await response.arrayBuffer()); if (bytes.length > MAX_IMAGE_BYTES) return ""; return `data:${type};base64,${bytes.toString("base64")}`; } catch { return ""; } finally { clearTimeout(timer); }
  }
  async function resolveSource(id, kind = "web") {
    if (!SOURCE_ID.test(String(id || ""))) return { ok: false, error: "无效的媒体来源" };
    const value = sourceStore.get(id); if (!value || value.expiresAt < Date.now()) return { ok: false, error: "该网络来源已过期，请重新搜索" };
    const url = safeUrl(value.url); if (!url) return { ok: false, error: "该来源不可用" };
    const embedUrl = value.provider === "youtube" ? youtubeEmbed(url) : value.provider === "bilibili" ? bilibiliEmbed(url) : "";
    const imageUrl = kind === "image" && /\.(png|jpe?g|webp|gif|avif)(?:$|\?)/i.test(url.pathname) ? await cacheImage(url) : "";
    return { ok: true, id: value.id, provider: value.provider, title: value.title, sourceUrl: value.url, embedUrl, imageUrl, retrievedAt: value.retrievedAt };
  }
  async function openSource(id) {
    const result = await resolveSource(id); if (!result.ok) return result;
    const confirmation = await dialog.showMessageBox({ type: "question", buttons: ["取消", "打开来源"], defaultId: 1, cancelId: 0, message: "要在默认浏览器打开这个外部来源吗？", detail: result.title || result.sourceUrl });
    if (confirmation.response !== 1) return { ok: false, error: "已取消" };
    await shell.openExternal(result.sourceUrl); return { ok: true };
  }
  async function addModels(window) {
    const result = await dialog.showOpenDialog(window || null, { title: "添加 3D 模型", properties: ["openFile", "multiSelections"], filters: [{ name: "3D 模型", extensions: ["glb", "gltf"] }] });
    if (result.canceled) return { ok: true, models: [] };
    const models = [];
    for (const file of result.filePaths.slice(0, 8)) {
      const extension = path.extname(file).toLowerCase(); const stat = fs.statSync(file);
      if (![".glb", ".gltf"].includes(extension) || stat.size > MAX_MODEL_BYTES) continue;
      const id = modelId(); fs.mkdirSync(modelsDir, { recursive: true }); fs.copyFileSync(file, modelFile(id, extension)); const meta = { id, name: clean(path.basename(file), 180), extension, size: stat.size, createdAt: Date.now() }; fs.writeFileSync(modelMeta(id), JSON.stringify(meta), "utf8"); models.push(meta);
    }
    return { ok: true, models };
  }
  function listModels() {
    try { return fs.readdirSync(modelsDir).filter((file) => MODEL_ID.test(path.basename(file, ".json")) && file.endsWith(".json")).flatMap((file) => { try { const meta = JSON.parse(fs.readFileSync(path.join(modelsDir, file), "utf8")); return [{ id: meta.id, name: clean(meta.name, 180), size: Number(meta.size) || 0 }]; } catch { return []; } }); } catch { return []; }
  }
  function getModel(id) {
    if (!MODEL_ID.test(String(id || ""))) return { ok: false, error: "无效的模型" };
    try { const meta = JSON.parse(fs.readFileSync(modelMeta(id), "utf8")); const bytes = fs.readFileSync(modelFile(id, meta.extension)); if (bytes.length > MAX_MODEL_BYTES) return { ok: false, error: "模型超过显示上限" }; return { ok: true, id: meta.id, name: meta.name, assetUrl: `data:${meta.extension === ".glb" ? "model/gltf-binary" : "model/gltf+json"};base64,${bytes.toString("base64")}` }; } catch { return { ok: false, error: "模型文件不可用" }; }
  }
  return { registerSearchSources, resolveSource, openSource, addModels, listModels, getModel };
}

module.exports = { createA2uiMediaService };
