/* TsukuMate's A2UI renderer. Components are declarative and intentionally do
 * not evaluate model supplied JavaScript or URLs. */
import { Schemas } from "@a2ui/web_core";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import katex from "katex";
import mermaid from "mermaid";
import DOMPurify from "dompurify";

const cleanups = new WeakMap();
const coreAvailable = !!Schemas;
const escape = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const text = (tag, value, className = "") => { const node = document.createElement(tag); node.className = className; node.textContent = String(value || ""); return node; };
const safeRatio = (value) => /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/.test(String(value || "")) ? String(value) : "";
const THEMES = new Set(["science", "literature", "warning", "review", "terminal", "default"]);
mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "dark" });

function reserve(node, layout = {}) {
  if (safeRatio(layout.aspectRatio)) node.style.aspectRatio = layout.aspectRatio;
  const height = Number(layout.estimatedHeight || layout.minHeight || 0);
  if (height) node.style.minHeight = `${Math.max(0, Math.min(1200, height))}px`;
}
function copy(value) { navigator.clipboard?.writeText(String(value || "")).catch(() => {}); }
function download(name, value, type = "text/plain;charset=utf-8") { const url = URL.createObjectURL(new Blob([value], { type })); const link = document.createElement("a"); link.href = url; link.download = name || "a2ui-content.txt"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function renderMarkdown(value) {
  const root = document.createElement("div"); root.className = "a2ui-markdown";
  root.innerHTML = escape(value).replace(/^### (.*)$/gm, "<h3>$1</h3>").replace(/^## (.*)$/gm, "<h2>$1</h2>").replace(/^# (.*)$/gm, "<h1>$1</h1>").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");
  return root;
}
function renderFormula(component) { const host = document.createElement("div"); host.className = "a2ui-formula"; try { host.innerHTML = katex.renderToString(component.tex || "", { displayMode: component.display !== false, throwOnError: false, strict: "ignore" }); } catch { host.textContent = component.tex || "公式不可用"; } return host; }
function renderStaticFragment(component, svg = false) { const host = document.createElement("div"); host.className = svg ? "a2ui-svg-fragment" : "a2ui-html-fragment"; const raw = svg ? component.svg : component.html; host.innerHTML = DOMPurify.sanitize(String(raw || ""), { FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "link", "meta"], FORBID_ATTR: ["src", "href", "onload", "onclick", "onerror", "style"], ALLOW_DATA_ATTR: false }); return host; }
async function renderMermaid(component, host) { const id = `tm-mermaid-${Math.random().toString(36).slice(2)}`; try { const result = await mermaid.render(id, String(component.diagram || "")); host.innerHTML = DOMPurify.sanitize(result.svg, { USE_PROFILES: { svg: true, svgFilters: true } }); } catch { host.textContent = "图表语法无效"; host.classList.add("a2ui-error"); } }
function renderPretext(component) { const host = document.createElement("article"); host.className = "a2ui-pretext"; const doc = new DOMParser().parseFromString(String(component.xml || ""), "application/xml"); const error = doc.querySelector("parsererror"); if (error) { host.append(text("pre", component.xml || "", "a2ui-code-content")); return host; } for (const node of doc.querySelectorAll("title, p, paragraph, li, item")) { const tag = node.localName === "title" ? "h3" : node.localName === "li" || node.localName === "item" ? "li" : "p"; host.append(text(tag, node.textContent || "")); } if (!host.childNodes.length) host.append(text("pre", component.xml || "", "a2ui-code-content")); return host; }
function renderGraph(component, chart = false) {
  const shell = document.createElement("div"); shell.className = `a2ui-graph ${chart ? "a2ui-chart" : "a2ui-mindmap"}`; reserve(shell, component.layout);
  const nodes = component.nodes || []; const edges = component.edges || []; const width = 680; const height = Math.max(220, Math.min(520, 120 + nodes.length * 44)); const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("viewBox", `0 0 ${width} ${height}`); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", chart ? "AI 生成的图表" : "AI 生成的思维导图");
  const positions = new Map(nodes.map((node, index) => [node.id, { x: 80 + (index % 3) * 250, y: 50 + Math.floor(index / 3) * 100 }]));
  for (const edge of edges) { const from = positions.get(edge.from); const to = positions.get(edge.to); if (!from || !to) continue; const line = document.createElementNS(svg.namespaceURI, "line"); line.setAttribute("x1", from.x); line.setAttribute("y1", from.y); line.setAttribute("x2", to.x); line.setAttribute("y2", to.y); line.setAttribute("class", "a2ui-graph-edge"); svg.append(line); }
  const max = Math.max(1, ...nodes.map((node) => Math.abs(Number(node.value) || 0)));
  for (const [index, node] of nodes.entries()) { const point = positions.get(node.id); if (chart) { const rect = document.createElementNS(svg.namespaceURI, "rect"); const value = Math.max(6, (Math.abs(Number(node.value) || 0) / max) * (height - 90)); rect.setAttribute("x", String(50 + index * Math.max(34, (width - 100) / Math.max(1, nodes.length)))); rect.setAttribute("y", String(height - 42 - value)); rect.setAttribute("width", "26"); rect.setAttribute("height", String(value)); rect.setAttribute("rx", "8"); rect.setAttribute("class", "a2ui-chart-bar"); svg.append(rect); const label = document.createElementNS(svg.namespaceURI, "text"); label.textContent = node.label; label.setAttribute("x", rect.getAttribute("x")); label.setAttribute("y", String(height - 18)); label.setAttribute("class", "a2ui-graph-label"); svg.append(label); continue; }
    const group = document.createElementNS(svg.namespaceURI, "g"); const rect = document.createElementNS(svg.namespaceURI, "rect"); rect.setAttribute("x", String(point.x - 72)); rect.setAttribute("y", String(point.y - 22)); rect.setAttribute("width", "144"); rect.setAttribute("height", "44"); rect.setAttribute("rx", "14"); rect.setAttribute("class", "a2ui-graph-node"); const label = document.createElementNS(svg.namespaceURI, "text"); label.textContent = node.label; label.setAttribute("x", String(point.x)); label.setAttribute("y", String(point.y + 5)); label.setAttribute("text-anchor", "middle"); label.setAttribute("class", "a2ui-graph-label"); group.append(rect, label); svg.append(group); }
  shell.append(svg); return shell;
}
async function source(component, kind) { return window.chatWorkspace?.getA2uiSource(component.sourceId, kind); }
function render3d(component) {
  const shell = document.createElement("section"); shell.className = "a2ui-model"; reserve(shell, { ...component.layout, aspectRatio: component.layout?.aspectRatio || "16/10", estimatedHeight: component.layout?.estimatedHeight || 300 }); shell.append(text("span", "正在加载 3D 模型…", "a2ui-loading"));
  let renderer; let frame = 0; let disposed = false; const observer = new IntersectionObserver(async ([entry]) => {
    if (!entry.isIntersecting || renderer || disposed) return;
    const result = await window.chatWorkspace?.getA2uiModel(component.modelId); if (!result?.ok || !result.assetUrl) { shell.replaceChildren(text("span", result?.error || "3D 模型不可用", "a2ui-error")); return; }
    try { const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(42, 1, .1, 100); camera.position.set(0, 1.1, 3); renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); shell.replaceChildren(renderer.domElement); const loader = new GLTFLoader(); const gltf = await loader.loadAsync(result.assetUrl); scene.add(gltf.scene); scene.add(new THREE.HemisphereLight(0xffffff, 0x273b67, 2)); const resize = () => { const box = shell.getBoundingClientRect(); renderer.setSize(box.width, box.height, false); camera.aspect = box.width / Math.max(1, box.height); camera.updateProjectionMatrix(); }; const draw = () => { if (disposed || !shell.isConnected) return; renderer.render(scene, camera); frame = requestAnimationFrame(draw); }; new ResizeObserver(resize).observe(shell); resize(); draw();
    } catch { shell.replaceChildren(text("span", "无法加载此 3D 模型", "a2ui-error")); }
  }, { threshold: .05 }); observer.observe(shell); cleanups.set(shell, () => { disposed = true; observer.disconnect(); cancelAnimationFrame(frame); renderer?.dispose(); }); return shell;
}
async function renderExternal(shell, component, video = false) {
  const result = await source(component, video ? "video" : "image"); if (!result?.ok) { shell.append(text("span", result?.error || "来源不可用", "a2ui-error")); return; }
  if (video && result.embedUrl) { const frame = document.createElement("iframe"); frame.src = result.embedUrl; frame.title = result.title || "外部视频"; frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"; frame.referrerPolicy = "strict-origin-when-cross-origin"; frame.sandbox = "allow-scripts allow-same-origin allow-presentation"; shell.append(frame); }
  else if (!video && result.imageUrl) { const image = new Image(); image.src = result.imageUrl; image.alt = component.alt || result.title || "AI 检索图片"; image.referrerPolicy = "no-referrer"; shell.append(image); }
  else shell.append(text("span", result.title || "此来源无法内嵌显示", "a2ui-error"));
  const caption = document.createElement("button"); caption.type = "button"; caption.className = "a2ui-source-link"; caption.textContent = `打开来源：${result.title || "网页"}`; caption.onclick = () => window.chatWorkspace?.performA2uiAction({ intent: "open-source", sourceId: component.sourceId }); shell.append(caption);
}
function renderComponent(component, surfaceId) {
  const shell = document.createElement("section"); shell.className = `a2ui-component a2ui-${component.type}`; shell.dataset.a2uiComponent = component.id; reserve(shell, component.layout);
  if (component.title && component.type !== "code") shell.append(text("h3", component.title, "a2ui-component-title"));
  if (component.type === "text" || component.type === "document") shell.append(text("div", component.text, "a2ui-text"));
  else if (component.type === "markdown") shell.append(renderMarkdown(component.text));
  else if (component.type === "code") { const header = document.createElement("header"); header.append(text("span", component.language || "text"), text("span", component.filename || "代码")); const copyButton = text("button", "复制"); copyButton.type = "button"; copyButton.onclick = () => copy(component.code); const exportButton = text("button", "导出"); exportButton.type = "button"; exportButton.onclick = () => download(component.filename || `snippet.${component.language || "txt"}`, component.code); header.append(copyButton, exportButton); const body = document.createElement("div"); body.className = `a2ui-code-body${component.output ? " has-output" : ""}`; const codePane = document.createElement("section"); codePane.className = "a2ui-code-pane"; codePane.append(text("pre", component.code, "a2ui-code-content")); body.append(codePane); if (component.output) { const outputPane = document.createElement("section"); outputPane.className = "a2ui-output-pane"; outputPane.append(text("h4", "输出"), text("pre", component.output, "a2ui-output-content")); body.append(outputPane); } shell.append(header, body); }
  else if (component.type === "table") { const table = document.createElement("table"); const head = document.createElement("thead"); const row = document.createElement("tr"); component.columns.forEach((column) => row.append(text("th", column))); head.append(row); const body = document.createElement("tbody"); component.rows.forEach((values) => { const line = document.createElement("tr"); values.forEach((value) => line.append(text("td", value))); body.append(line); }); table.append(head, body); shell.append(table); }
  else if (component.type === "htmlPreview") { const host = document.createElement("div"); shell.append(host); window.TsukuMateRichContent?.renderCard(host, { html: component.html, css: component.css }); }
  else if (component.type === "svgFragment") shell.append(renderStaticFragment(component, true));
  else if (component.type === "formula") shell.append(renderFormula(component));
  else if (component.type === "mermaid") { const host = document.createElement("div"); host.className = "a2ui-mermaid"; shell.append(host); void renderMermaid(component, host); }
  else if (component.type === "pretext") shell.append(renderPretext(component));
  else if (component.type === "mindmap") shell.append(renderGraph(component));
  else if (component.type === "chart") shell.append(renderGraph(component, true));
  else if (component.type === "image" || component.type === "mediaVideo") { shell.classList.add("a2ui-media"); void renderExternal(shell, component, component.type === "mediaVideo"); }
  else if (component.type === "model3d") return render3d(component);
  else if (component.type === "stream") { const video = document.createElement("video"); video.id = `a2ui-stream-${surfaceId}-${component.id}`.replace(/[^\w-]/g, "_"); video.controls = true; video.playsInline = true; video.className = "a2ui-stream-video"; shell.append(video, text("span", component.label || "正在连接实时流…", "a2ui-stream-status")); const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) video.play().catch(() => {}); else video.pause(); }, { threshold: .05 }); observer.observe(shell); void window.chatWorkspace?.startA2uiStream(component.streamId, video.id).then((result) => { const status = shell.querySelector(".a2ui-stream-status"); if (status) status.textContent = result?.ok ? (component.label || "实时流") : (result?.error || "实时流不可用"); }); cleanups.set(shell, () => { observer.disconnect(); window.chatWorkspace?.stopA2uiStream(video.id); }); }
  else if (component.type === "action") { const button = text("button", component.label || "执行操作", `a2ui-action ${component.tone || "default"}`); button.type = "button"; button.onclick = async () => { button.disabled = true; const result = await window.chatWorkspace?.performA2uiAction({ intent: component.intent, sourceId: component.sourceId, surfaceId, componentId: component.id }); if (!result?.ok) button.title = result?.error || "此操作不可用"; button.disabled = false; }; shell.append(button); }
  return shell;
}
function renderSurface(host, surface) {
  const root = document.createElement("div"); root.className = "a2ui-surface"; root.dataset.a2uiSurface = surface.id; root.dataset.a2uiTheme = THEMES.has(surface.theme) ? surface.theme : "default"; root.dataset.a2uiCore = coreAvailable ? "v0.8" : "fallback";
  for (const component of surface.components || []) root.append(renderComponent(component, surface.id)); host.append(root);
  return () => { root.querySelectorAll(".a2ui-model").forEach((node) => cleanups.get(node)?.()); root.remove(); };
}
window.TsukuMateA2UI = { renderSurface };
