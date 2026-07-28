/*
 * Adapted from UniStudy's MIT-licensed safeHtml/contentProcessor preview
 * pipeline. TsukuMate runs interactive previews only in an opaque iframe
 * sandbox: the preview never receives Electron, filesystem, parent-window,
 * form, popup, navigation or unrestricted network privileges.
 */
import DOMPurify from "dompurify";
import { marked } from "marked";
import morphdom from "morphdom";
import { createContentPipeline, PIPELINE_MODES } from "./unistudy-content-pipeline.js";
import { scopeCss } from "./unistudy-scoped-css.js";

const BLOCKED_TAGS = ["script", "style", "form", "iframe", "object", "embed", "meta", "link", "base", "video", "audio"];
const SCRIPT_HOSTS = new Set(["unpkg.com", "cdn.jsdelivr.net", "esm.sh"]);
// Reused from UniStudy's vendored Three.js build so generated examples do not
// depend on a CDN, module CORS, or a model-selected version at render time.
const LOCAL_THREE_URL = new URL("./three.min.js", document.currentScript?.src || window.location.href).href;
const unistudyPipeline = createContentPipeline({
  // Retain UniStudy's protect → normalize → restore ordering while keeping
  // TsukuMate's renderer responsible for the final safe DOM construction.
  escapeHtml: (value) => String(value || "").replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[char])),
  deIndentMisinterpretedCodeBlocks: (value) => String(value || "").replace(/^\s+(```)/gm, "$1"),
  deIndentHtml: (value) => String(value || "").replace(/^\s+(?=<\/?(?:html|head|body|script|style)\b)/gmi, ""),
  ensureHtmlFenced: (value) => String(value || "").replace(/(^|\n)((?:<!doctype\s+html\b[^>]*>|<html\b[^>]*>)[\s\S]*?<\/html\s*>)/gi, (_all, prefix, document) => `${prefix}\`\`\`html\n${document}\n\`\`\``),
  getCodeFenceRegex: () => /```[\s\S]*?```/g,
});

function prepareMessageContent(value, streaming = false) {
  return unistudyPipeline.process(String(value || ""), { mode: streaming ? PIPELINE_MODES.STREAM_FAST : PIPELINE_MODES.FULL_RENDER }).text;
}

function safeCss(value) {
  return String(value || "")
    .replace(/@import[\s\S]*?;/gi, "")
    .replace(/url\s*\([^)]*\)/gi, "none")
    .replace(/expression\s*\([^)]*\)/gi, "");
}

function safeHtml(value) {
  // Compatibility with UniStudy's visual-choice convention. Only the exact
  // input('text') form becomes a data attribute; arbitrary onclick remains
  // stripped by DOMPurify and can never execute in the parent application.
  const withInputActions = String(value || "").replace(/\s+onclick\s*=\s*(["'])\s*input\(\s*(["'])([\s\S]*?)\2\s*\)\s*\1/gi, (_all, _outer, _inner, reply) => ` data-tm-input="${String(reply).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")}"`);
  return DOMPurify.sanitize(withInputActions, {
    FORBID_TAGS: BLOCKED_TAGS,
    FORBID_ATTR: ["src", "srcset", "href", "action", "formaction", "target"],
    ADD_ATTR: ["data-tm-input"],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: true,
  });
}

function extractTagContents(value, tag) {
  const values = [];
  const expression = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}\\s*>`, "gi");
  const html = String(value || "").replace(expression, (_all, body) => { values.push(body); return ""; });
  return { html, values };
}

function safeRemoteScript(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && SCRIPT_HOSTS.has(url.hostname) ? url.href : "";
  } catch { return ""; }
}

function extractScripts(value) {
  const scripts = [];
  const html = String(value || "").replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi, (_all, attributes, body) => {
    const type = String(attributes.match(/\btype\s*=\s*["']?([^"'\s>]+)/i)?.[1] || "").toLowerCase();
    if (type && !["module", "text/javascript", "application/javascript"].includes(type)) return "";
    const src = attributes.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
    if (src) { const safe = safeRemoteScript(src); if (safe) scripts.push({ src: safe, type }); }
    else if (body.length <= 96_000) scripts.push({ code: body.replace(/<\/script/gi, "<\\/script"), type });
    return "";
  });
  return { html, scripts };
}

function previewDocument(card) {
  const extracted = extractScripts(card.html);
  const styles = extractTagContents(extracted.html, "style");
  const html = safeHtml(styles.html);
  const css = safeCss([card.css, ...styles.values].filter(Boolean).join("\n"));
  const scripts = extracted.scripts.map((script) => script.src
    ? `<script${script.type === "module" ? " type=\"module\"" : ""} src="${script.src}"></script>`
    : `<script${script.type === "module" ? " type=\"module\"" : ""}>${script.code}</script>`).join("\n");
  return { html, css, scripts, interactive: extracted.scripts.length > 0 };
}

// Adapted from UniStudy's contentProcessor iframe lifecycle: a preview reports
// its measured height and runtime state to its owning card. The parent accepts
// messages only from that exact opaque sandbox frame.
function buildPreviewDocument(preview, frameId) {
  const bootstrap = `<script>(function(){const id=${JSON.stringify(frameId)};const report=(type,payload)=>parent.postMessage({type:'tsukumate-preview-'+type,frameId:id,...payload},'*');const resize=()=>{const root=document.documentElement;const height=Math.max(160,Math.ceil(Math.max(root.scrollHeight,document.body?document.body.scrollHeight:0)+2));report('resize',{height:Math.min(height,720)});};document.addEventListener('click',event=>{const button=event.target.closest?.('[data-tm-input]');if(!button)return;event.preventDefault();report('input',{value:button.getAttribute('data-tm-input')||''});});addEventListener('error',event=>report('status',{status:'error',message:String(event.message||'网页运行出错')}));addEventListener('unhandledrejection',event=>report('status',{status:'error',message:String(event.reason?.message||event.reason||'网页运行出错')}));addEventListener('load',()=>{report('status',{status:'ready',message:''});resize();setTimeout(resize,80);setTimeout(resize,500);});new ResizeObserver(resize).observe(document.documentElement);})();</script>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net https://esm.sh; connect-src 'none'; font-src 'none'; media-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none';"><style>html,body{margin:0;padding:0;background:transparent;color:#eef0f6;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif}*{box-sizing:border-box}${preview.css}</style></head><body>${preview.html}${preview.scripts}${bootstrap}</body></html>`;
}

function isThreePreview(preview) {
  return /\bTHREE\.(?:WebGLRenderer|Scene|PerspectiveCamera|BoxGeometry|Mesh)\b|from\s*["'][^"']*three(?:\.module)?\.js/i.test(`${preview.html}\n${preview.scripts}`);
}

function buildThreePreviewDocument(preview, frameId) {
  // This is an intentionally small adaptation of UniStudy's buildThreeJsPreviewHtml:
  // load its known local Three build, turn common module imports into the global
  // THREE it exposes, and keep a canvas appended by the generated page in-frame.
  const script = preview.scripts
    .replace(/<script\b[^>]*>/gi, "").replace(/<\/script\s*>/gi, "")
    .replace(/^\s*import\s+\*\s+as\s+THREE\s+from\s+["'][^"']*three(?:\.module)?\.js[^"']*["'];?\s*$/gmi, "")
    .replace(/<\/script/gi, "<\\/script");
  const bootstrap = `<script>(function(){const id=${JSON.stringify(frameId)};const mount=document.getElementById('tm-three-mount')||document.body;const post=(type,payload)=>parent.postMessage({type:'tsukumate-preview-'+type,frameId:id,...payload},'*');const resize=()=>post('resize',{height:Math.min(720,Math.max(360,Math.ceil(Math.max(document.documentElement.scrollHeight,document.body.scrollHeight))) )});const append=document.body.appendChild.bind(document.body);document.body.appendChild=node=>node&&node.tagName==='CANVAS'?mount.appendChild(node):append(node);addEventListener('error',event=>post('status',{status:'error',message:String(event.message||'Three.js 运行出错')}));addEventListener('unhandledrejection',event=>post('status',{status:'error',message:String(event.reason?.message||event.reason||'Three.js 运行出错')}));addEventListener('load',()=>{if(!window.THREE){post('status',{status:'error',message:'本地 Three.js 未能加载'});return;}post('status',{status:'ready',message:''});resize();setTimeout(resize,100);setTimeout(resize,550);});new ResizeObserver(resize).observe(document.documentElement);})();</script>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline' file:; connect-src 'none'; font-src 'none'; media-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none';"><style>html,body{margin:0;min-height:360px;background:#020617;color:#eef0f6;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif}*{box-sizing:border-box}canvas{display:block;max-width:100%}${preview.css}</style></head><body>${preview.html}<div id="tm-three-mount"></div><script src="${LOCAL_THREE_URL}"></script>${bootstrap}<script>${script}</script></body></html>`;
}

function sourceText(card) {
  return `${card.css ? `<style>\n${card.css}\n</style>\n` : ""}${card.html || ""}`;
}

function structuredDocument(value) {
  try {
    const parsed = JSON.parse(String(value || "").trim());
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
    const content = typeof parsed.content === "string" ? parsed.content.trim() : (typeof parsed.text === "string" ? parsed.text.trim() : "");
    return title || content ? { title, content } : null;
  } catch { return null; }
}

function renderStructuredDocument(host, model, raw) {
  const shell = document.createElement("section"); shell.className = "study-card-shell study-document-shell";
  const toolbar = document.createElement("div"); toolbar.className = "study-card-toolbar";
  const status = document.createElement("span"); status.className = "study-card-status"; status.textContent = "学习文档";
  const toggle = document.createElement("button"); toggle.type = "button"; toggle.textContent = "查看源码";
  const body = document.createElement("article"); body.className = "study-document-body";
  if (model.title) { const heading = document.createElement("h3"); heading.textContent = model.title; body.append(heading); }
  for (const paragraph of model.content.split(/\n{2,}|\\n{2,}/).map((item) => item.replace(/\\n/g, "\n").trim()).filter(Boolean)) { const item = document.createElement("p"); item.textContent = paragraph; body.append(item); }
  const source = document.createElement("pre"); source.className = "study-card-source"; source.hidden = true; source.textContent = raw;
  toggle.onclick = () => { const showingSource = source.hidden; source.hidden = !showingSource; body.hidden = showingSource; toggle.textContent = showingSource ? "返回文档" : "查看源码"; };
  toolbar.append(status, toggle); shell.append(toolbar, body, source); host.append(shell);
  return () => shell.remove();
}

// UniStudy's normal-chat path mounts an explicit response-root directly into
// the message DOM. Use it only for that declared root shape; complete pages
// and Three.js remain isolated in iframes below.
function renderInlineFragment(host, raw) {
  const styles = extractTagContents(raw, "style");
  const shell = document.createElement("section"); shell.className = "tm-inline-visual-fragment";
  const style = safeCss(styles.values.join("\n"));
  if (style) { const node = document.createElement("style"); node.textContent = style; shell.append(node); }
  const content = document.createElement("div"); content.className = "tm-inline-visual-content"; content.innerHTML = safeHtml(styles.html);
  content.addEventListener("click", (event) => { const button = event.target.closest?.("[data-tm-input]"); if (!button) return; event.preventDefault(); window.TsukuMateRichContent?.onInput?.(button.getAttribute("data-tm-input") || ""); });
  shell.append(content); host.append(shell);
  return () => shell.remove();
}

// This is the small, workspace-shaped adapter of UniStudy's message renderer
// and streamManager.  In particular, completed paragraphs move into `stable`
// once, while only `tail` is morphed as more tokens arrive.  This avoids the
// previous TsukuMate behaviour of destroying the whole bubble for every token.
function splitStreamAtSafeBoundary(source, previousStableLength = 0) {
  const text = String(source || "");
  if (!text) return { stableLength: 0, tail: "" };
  const candidates = [text.lastIndexOf("\n\n"), text.lastIndexOf("\n")].filter((index) => index >= previousStableLength);
  const stableLength = candidates.length ? Math.max(...candidates) + 1 : previousStableLength;
  return { stableLength: Math.min(stableLength, text.length), tail: text.slice(Math.min(stableLength, text.length)) };
}

function scopedVisualStyles(source, scopeId) {
  const extracted = extractTagContents(source, "style");
  const css = safeCss(extracted.values.join("\n"));
  return { markup: extracted.html, css: css ? scopeCss(css, scopeId) : "" };
}

function installScopedStyle(state, css) {
  if (!css) return;
  if (!state.styleNode) {
    state.styleNode = document.createElement("style");
    state.styleNode.dataset.tmVisualScope = state.scopeId;
    document.head.append(state.styleNode);
  }
  if (state.styleNode.textContent !== css) state.styleNode.textContent = css;
}

function markdownHtml(source, state) {
  const visual = scopedVisualStyles(source, state.scopeId);
  installScopedStyle(state, visual.css);
  // UniStudy uses marked for all normal prose and leaves declared visual roots
  // as raw HTML.  DOMPurify then applies our Electron-safe tag/URL boundary.
  return safeHtml(marked.parse(visual.markup, { gfm: true, breaks: true }));
}

function preserveRuntimeNode(fromEl, toEl) {
  if (fromEl.isEqualNode(toEl)) return false;
  if (fromEl.matches?.("iframe, video:not([paused]), audio:not([paused]), canvas[data-tm-keep-alive]")) return false;
  if (fromEl === document.activeElement) queueMicrotask(() => fromEl.focus?.());
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(fromEl.tagName)) {
    toEl.value = fromEl.value;
    toEl.checked = fromEl.checked;
  }
  if (fromEl.tagName === "BUTTON" && fromEl.dataset.interacted === "true") {
    toEl.dataset.interacted = "true";
    toEl.setAttribute("aria-pressed", fromEl.getAttribute("aria-pressed") || "true");
  }
  return true;
}

function ensureStreamingRoots(host) {
  let stable = host.querySelector(":scope > .unistudy-stream-stable-root");
  let tail = host.querySelector(":scope > .unistudy-stream-tail-root");
  if (!stable || !tail) {
    host.replaceChildren();
    stable = document.createElement("div"); stable.className = "unistudy-stream-stable-root visual-bubble-stable";
    tail = document.createElement("div"); tail.className = "unistudy-stream-tail-root visual-bubble-tail";
    host.append(stable, tail);
  }
  return { stable, tail };
}

function renderVisualMessage(host, value, options = {}) {
  const state = host._tmVisualState || {
    scopeId: `tm-visual-${String(options.messageId || Math.random().toString(36).slice(2)).replace(/[^a-zA-Z0-9_-]/g, "")}`,
    stableLength: 0,
    stableSource: "",
    styleNode: null,
  };
  host._tmVisualState = state;
  host.id = state.scopeId;
  host.classList.add("tm-unistudy-message-content");
  const source = prepareMessageContent(value, !!options.streaming);
  const { stable, tail } = ensureStreamingRoots(host);

  if (!options.streaming) {
    state.stableLength = source.length;
    state.stableSource = source;
    stable.innerHTML = markdownHtml(source, state);
    tail.replaceChildren();
    return () => cleanupVisualMessage(host);
  }

  const split = splitStreamAtSafeBoundary(source, state.stableLength);
  if (split.stableLength > state.stableLength) {
    state.stableSource = source.slice(0, split.stableLength);
    stable.innerHTML = markdownHtml(state.stableSource, state);
    state.stableLength = split.stableLength;
  }
  const tailSource = source.slice(state.stableLength);
  const next = document.createElement("div");
  next.innerHTML = markdownHtml(tailSource, state);
  try {
    morphdom(tail, next, {
      childrenOnly: true,
      onBeforeElUpdated: preserveRuntimeNode,
      onNodeAdded(node) {
        if (node.nodeType === 1 && /^(P|DIV|UL|OL|LI|PRE|TABLE|H[1-6])$/.test(node.tagName)) node.classList.add("unistudy-stream-element-fade-in");
        return node;
      },
    });
  } catch {
    // Incomplete streamed HTML is normal.  Keep the last valid DOM until the
    // next chunk can be parsed, exactly as UniStudy's stream manager does.
  }
  return () => cleanupVisualMessage(host);
}

function cleanupVisualMessage(host) {
  const state = host?._tmVisualState;
  if (state?.styleNode) state.styleNode.remove();
  if (host) delete host._tmVisualState;
}

function renderCard(host, card) {
  const document = structuredDocument(card.html);
  if (document) return renderStructuredDocument(host, document, sourceText(card));
  const shell = document.createElement("section");
  shell.className = "study-card-shell";
  const toolbar = document.createElement("div"); toolbar.className = "study-card-toolbar";
  const preview = previewDocument(card);
  const status = document.createElement("span"); status.className = "study-card-status"; status.textContent = preview.interactive ? "正在加载互动网页…" : "正在加载网页预览…";
  const toggle = document.createElement("button"); toggle.type = "button"; toggle.textContent = "查看源码";
  const frame = document.createElement("iframe"); frame.className = "study-card-frame";
  frame.setAttribute("sandbox", "allow-scripts"); frame.setAttribute("referrerpolicy", "no-referrer");
  frame.title = "AI 生成的学习卡片";
  const source = document.createElement("pre"); source.className = "study-card-source"; source.hidden = true;
  source.textContent = sourceText(card);
  const frameId = `tm-preview-${Math.random().toString(36).slice(2)}`;
  let timeout = setTimeout(() => { status.textContent = "预览加载较慢，可查看源码"; status.dataset.state = "error"; }, 5000);
  const markReady = () => {
    if (timeout) { clearTimeout(timeout); timeout = null; }
    if (status.dataset.state !== "error") { status.dataset.state = "ready"; status.textContent = preview.interactive ? "互动网页（隔离运行）" : "网页预览"; }
  };
  const onMessage = (event) => {
    if (event.source !== frame.contentWindow || event.data?.frameId !== frameId) return;
    if (event.data.type === "tsukumate-preview-resize" && Number.isFinite(event.data.height)) frame.style.height = `${Math.max(160, Math.min(720, event.data.height))}px`;
    if (event.data.type === "tsukumate-preview-status") {
      if (timeout) { clearTimeout(timeout); timeout = null; }
      const failed = event.data.status === "error"; status.dataset.state = failed ? "error" : "ready";
      status.textContent = failed ? (event.data.message || "网页预览运行出错") : (preview.interactive ? "互动网页（隔离运行）" : "网页预览");
    }
    if (event.data.type === "tsukumate-preview-input") window.TsukuMateRichContent?.onInput?.(String(event.data.value || ""));
  };
  window.addEventListener("message", onMessage);
  // The iframe load event is the reliable fallback for pages whose own script
  // replaces window.onload before the injected UniStudy-style bridge runs.
  frame.addEventListener("load", markReady, { once: true });
  frame.srcdoc = isThreePreview(preview) ? buildThreePreviewDocument(preview, frameId) : buildPreviewDocument(preview, frameId);
  toggle.addEventListener("click", () => {
    const showingSource = source.hidden;
    source.hidden = !showingSource; frame.hidden = showingSource;
    toggle.textContent = showingSource ? "返回卡片" : "查看源码";
  });
  toolbar.append(status, toggle); shell.append(toolbar, frame, source); host.appendChild(shell);
  return () => { if (timeout) clearTimeout(timeout); window.removeEventListener("message", onMessage); frame.srcdoc = ""; shell.remove(); };
}

window.TsukuMateRichContent = { renderCard, renderInlineFragment, renderVisualMessage, cleanupVisualMessage, safeCss, safeHtml, prepareMessageContent, onInput: null };
