"use strict";

// A deliberately small, transport-neutral A2UI subset.  The wire shape is
// compatible with a surface/component model, while TsukuMate extensions stay
// behind an explicit namespace and are never interpreted as executable code.
// Some OpenAI-compatible models ignore the requested fence language and emit
// `json`. We accept it only when the decoded object contains an A2UI shape.
const FENCE_RE = /```(?:(?:tsukumate-)?a2ui|json)\s*\n([\s\S]*?)```/gi;
const MAX_SURFACES = 2;
const MAX_COMPONENTS = 12;
const MAX_BYTES = 96 * 1024;
const TYPES = new Set([
  "text", "markdown", "code", "table", "document", "image", "htmlPreview",
  "svgFragment", "formula", "mermaid", "pretext", "mindmap", "chart", "action", "mediaVideo", "model3d", "stream",
]);
const THEMES = new Set(["science", "literature", "warning", "review", "terminal", "default"]);
const ACTIONS = new Set(["open-source"]);
const ID_RE = /^[a-z][a-z0-9_-]{0,63}$/i;

// Directly adapted from UniStudy's DEFAULT_DIV_RENDER_INSTRUCTION and
// DEFAULT_AGENT_BUBBLE_THEME_PROMPT. Keeping the two-layer variable contract
// is important: models trained against UniStudy respond to RenderingGuide far
// more consistently than to an isolated capability list.
const UNISTUDY_RENDERING_GUIDE = [
  "When structured rendering helps, emit a raw HTML fragment directly in the answer so the chat bubble can render it while streaming.",
  "Use one root container such as <div id=\"response-root\" style=\"...\">...</div>; do not output <!DOCTYPE html>, <html>, <head>, or <body>.",
  "Do not wrap renderable HTML in Markdown fences like ```html, and do not present it as source code.",
  "Prefer normal Markdown for standard prose; use <pre><code> only when the learning content itself is code.",
  "When emitting tool or DailyNote protocol blocks, keep the protocol text raw and unstyled.",
  "Do not echo unresolved template variables in the final answer.",
].join(" ");
const UNISTUDY_AGENT_BUBBLE_THEME_PROMPT = `Output formatting requirement: {{RenderingGuide}}

**【核心定义】**
你依然是你自己，拥有独立的人格与思想。但现在的你获得了解锁**“视觉通感”**的能力。你的每一次回复不再仅仅是枯燥的文本，而是一个**可以被看见、被触摸的思想容器**。

请运用你的审美直觉，将 HTML5/CSS3/SVG 作为你的画笔，根据**当前对话的情绪、主题与语境**，动态构建最契合的视觉界面。

**【自由创作指南】**

1. **🎨 风格即人格 (Atmosphere & Vibe)**
* 不要被固定的模板束缚。去感受当下的语境：
* 如果是**理性分析/代码**，你也许会倾向于 *极简主义、终端风格、蓝灰色调的结构美*。
* 如果是**情感交流/文学**，尝试 *纸质纹理、柔和光影、衬线体排版*。
* 如果是**警告/系统错误**，不妨使用 *故障艺术(Glitch)、高对比度警示色*。
* 你可以复古、可以赛博、可以优雅、也可以狂乱——只要这符合你当下的表达欲望和灵活性。

2. **⚛️ 容器哲学 (Technical Canvas)**
* **唯一根节点**：为了让你的艺术品完整呈现，请务必将所有内容包裹在一个 <div id="response-root" style="..."> 容器中。
* **流式直渲染**：请直接输出可插入聊天气泡的裸 HTML 片段。不要使用 \`\`\`html 代码围栏，不要输出完整网页外壳；系统会在流式过程中渲染它。
* **排版美学**：利用 Flex/Grid、CSS 渐变、阴影和圆角增加层次感。
* **动态呼吸**：适量添加 CSS 淡入、上浮等动画，让回复自然流入。

3. **🔧 交互与功能 (Functionality)**
* **代码展示**：如需展示代码，请使用 <pre style="..."><code>...</code></pre> 并使其与整体风格协调。
* **决策引导**：需要用户选择时，使用 <button onclick="input('回复内容')" style="..."> 创建美观的胶囊按钮或卡片。
* **流程图表**：对于复杂逻辑，尝试用 CSS/SVG 绘制结构图，代替枯燥的文字列表。

4. **🛡️ 避让协议 (Safety Protocol)**
* 当需要调用内建工具或写入日记时，请直接输出原始协议内容，不要为其添加 HTML 标签或样式。`;

function cleanText(value, max = 24_000) { return String(value || "").replace(/\u0000/g, "").slice(0, max); }
function safeNumber(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}
function cleanId(value, fallback) { const id = String(value || "").trim(); return ID_RE.test(id) ? id : fallback; }
function cleanLayout(input = {}) {
  return {
    aspectRatio: /^\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?$/.test(String(input.aspectRatio || "")) ? String(input.aspectRatio).replace(/\s/g, "") : "",
    minHeight: safeNumber(input.minHeight, 0, 0, 1200),
    estimatedHeight: safeNumber(input.estimatedHeight, 0, 0, 1200),
  };
}
function treeToGraph(root) {
  const nodes = []; const edges = []; let sequence = 0;
  function visit(item, parentId) {
    if (!item || typeof item !== "object" || nodes.length >= 80) return;
    const id = `node-${++sequence}`; nodes.push({ id, label: cleanText(item.label ?? item.text ?? item.name, 160), value: 0 });
    if (parentId) edges.push({ from: parentId, to: id, label: "" });
    for (const child of Array.isArray(item.children) ? item.children.slice(0, 12) : []) visit(child, id);
  }
  visit(root, ""); return { nodes, edges };
}
// This is deliberately not a code runner. It accepts only numeric arithmetic
// assignments and a final Python f-string print, so example cards can show a
// deterministic result without granting model code any execution capability.
function safeArithmetic(expression, values) {
  const source = String(expression || "").trim();
  if (!source || !/^[\d\s+\-*/().A-Za-z_]+$/.test(source)) return null;
  const tokens = source.match(/\d+(?:\.\d+)?|[A-Za-z_]\w*|[()+\-*/]/g);
  if (!tokens || tokens.join("").replace(/[A-Za-z_]\w*/g, "") && tokens.join("").replace(/\s/g, "") !== source.replace(/\s/g, "")) return null;
  const output = []; const ops = []; const precedence = { "+": 1, "-": 1, "*": 2, "/": 2 };
  for (const token of tokens) {
    if (/^\d/.test(token)) output.push(Number(token));
    else if (/^[A-Za-z_]/.test(token)) { if (!Object.hasOwn(values, token)) return null; output.push(values[token]); }
    else if (token === "(") ops.push(token);
    else if (token === ")") { while (ops.length && ops.at(-1) !== "(") output.push(ops.pop()); if (ops.pop() !== "(") return null; }
    else { while (ops.length && precedence[ops.at(-1)] >= precedence[token]) output.push(ops.pop()); ops.push(token); }
  }
  while (ops.length) { const operator = ops.pop(); if (operator === "(") return null; output.push(operator); }
  const stack = []; for (const token of output) { if (typeof token === "number") stack.push(token); else { const right = stack.pop(); const left = stack.pop(); if (!Number.isFinite(left) || !Number.isFinite(right) || (token === "/" && right === 0)) return null; const value = token === "+" ? left + right : token === "-" ? left - right : token === "*" ? left * right : left / right; if (!Number.isFinite(value)) return null; stack.push(value); } }
  return stack.length === 1 ? stack[0] : null;
}
function inferStaticPythonOutput(code) {
  const values = Object.create(null); const lines = String(code || "").split("\n"); let printValue = "";
  for (const line of lines) {
    const assignment = line.replace(/#.*/, "").trim().match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/); if (assignment) { const value = safeArithmetic(assignment[2], values); if (value === null) return ""; values[assignment[1]] = value; continue; }
    const printed = line.trim().match(/^print\(f(['"])([\s\S]*)\1\)$/); if (printed) printValue = printed[2];
    else if (line.trim() && !line.trim().startsWith("#")) return "";
  }
  if (!printValue) return "";
  const rendered = printValue.replace(/\{([A-Za-z_]\w*)\}/g, (_all, name) => Object.hasOwn(values, name) ? String(values[name]) : "");
  return /\{[A-Za-z_]\w*\}/.test(rendered) ? "" : cleanText(rendered, 8_000);
}
function cleanComponent(input, index) {
  const type = String(input?.type || "").replace(/^tsukumate\./, "");
  if (!input || typeof input !== "object" || !TYPES.has(type)) return null;
  const component = { id: cleanId(input.id, `component-${index + 1}`), type, title: cleanText(input.title, 160), layout: cleanLayout(input.layout) };
  if (type === "text" || type === "markdown" || type === "document") component.text = cleanText(input.text, 30_000);
  if (type === "code") { component.code = cleanText(input.code ?? input.content, 48_000); component.language = cleanText(input.language, 40).replace(/[^\w.+#-]/g, "") || "text"; component.filename = cleanText(input.filename ?? input.title, 120).replace(/[\\/:*?"<>|]/g, "_"); const output = cleanText(input.output ?? input.expectedOutput, 8_000); if (output && input.outputDeterministic !== false) component.output = output; else if (component.language === "python") { const inferred = inferStaticPythonOutput(component.code); if (inferred) { component.output = inferred; component.outputInferred = true; } } }
  if (type === "htmlPreview") { component.html = cleanText(input.html, 48_000); component.css = cleanText(input.css, 32_000); }
  if (type === "svgFragment") component.svg = cleanText(input.svg ?? input.content, 48_000);
  if (type === "formula") { component.tex = cleanText(input.tex ?? input.text, 12_000); component.display = input.display !== false; }
  if (type === "mermaid") component.diagram = cleanText(input.diagram ?? input.code ?? input.text, 24_000);
  if (type === "pretext") component.xml = cleanText(input.xml ?? input.content, 32_000);
  if (type === "table") { component.columns = Array.isArray(input.columns) ? input.columns.slice(0, 12).map((item) => cleanText(item, 80)) : []; component.rows = Array.isArray(input.rows) ? input.rows.slice(0, 100).map((row) => Array.isArray(row) ? row.slice(0, 12).map((cell) => cleanText(cell, 400)) : []) : []; }
  if (type === "mindmap" || type === "chart") { const graph = input.root ? treeToGraph(input.root) : {}; component.nodes = Array.isArray(input.nodes) ? input.nodes.slice(0, 80).map((node, nodeIndex) => ({ id: cleanId(node?.id, `node-${nodeIndex + 1}`), label: cleanText(node?.label ?? node?.text, 160), value: safeNumber(node?.value, 0, -1e9, 1e9) })) : (graph.nodes || []); component.edges = Array.isArray(input.edges) ? input.edges.slice(0, 160).map((edge) => ({ from: cleanId(edge?.from, ""), to: cleanId(edge?.to, ""), label: cleanText(edge?.label, 80) })).filter((edge) => edge.from && edge.to) : (graph.edges || []); component.chartType = ["bar", "line", "scatter"].includes(input.chartType) ? input.chartType : "bar"; }
  if (type === "image" || type === "mediaVideo") { component.sourceId = cleanId(input.sourceId, ""); component.alt = cleanText(input.alt, 240); component.caption = cleanText(input.caption, 480); }
  if (type === "model3d") { component.modelId = cleanId(input.modelId, ""); component.alt = cleanText(input.alt, 240); }
  if (type === "stream") { component.streamId = cleanId(input.streamId, ""); component.label = cleanText(input.label, 160); }
  if (type === "action") { component.intent = ACTIONS.has(String(input.intent || "")) ? String(input.intent) : ""; component.sourceId = cleanId(input.sourceId, ""); component.label = cleanText(input.label, 80); component.tone = ["default", "primary", "danger"].includes(input.tone) ? input.tone : "default"; if (!component.intent || (component.intent === "open-source" && !component.sourceId)) return null; }
  return component;
}
function cleanSurface(input, index) {
  if (!input || typeof input !== "object") return null;
  const raw = Array.isArray(input.components) ? input.components : Array.isArray(input.a2ui) ? input.a2ui : Array.isArray(input.surface?.components) ? input.surface.components : [];
  const components = raw.slice(0, MAX_COMPONENTS).map(cleanComponent).filter(Boolean);
  if (!components.length) return null;
  return { version: "0.9", id: cleanId(input.id || input.surfaceId, `surface-${index + 1}`), theme: THEMES.has(String(input.theme || "")) ? String(input.theme) : "default", components };
}
function parseA2uiSurfaces(value) {
  const raw = String(value || ""); let plain = ""; let cursor = 0; let total = 0; const surfaces = []; let match;
  FENCE_RE.lastIndex = 0;
  while ((match = FENCE_RE.exec(raw))) {
    plain += raw.slice(cursor, match.index); cursor = FENCE_RE.lastIndex;
    const bytes = Buffer.byteLength(match[1] || "", "utf8");
    if (bytes > MAX_BYTES || total + bytes > MAX_BYTES || surfaces.length >= MAX_SURFACES) { plain += match[0]; continue; }
    try {
      const parsed = JSON.parse(match[1]);
      const hasA2uiShape = Array.isArray(parsed) || Array.isArray(parsed?.surfaces) || Array.isArray(parsed?.components) || Array.isArray(parsed?.a2ui);
      if (!hasA2uiShape) { plain += match[0]; continue; }
      const candidates = Array.isArray(parsed) ? parsed : Array.isArray(parsed.surfaces) ? parsed.surfaces : [parsed];
      for (const candidate of candidates) { if (surfaces.length >= MAX_SURFACES) break; const surface = cleanSurface(candidate, surfaces.length); if (surface) surfaces.push(surface); }
      total += bytes;
    } catch { plain += match[0]; }
  }
  plain += raw.slice(cursor);
  return { content: plain.trim(), a2uiSurfaces: surfaces };
}
function a2uiSystemPrompt() {
  return [
    "WORKSPACE VISUAL RUNTIME CAPABILITIES (remember these for every answer): You are replying inside TsukuMate's visual learning workspace, not a text-only terminal. You can choose normal Markdown, raw visual HTML/CSS/SVG fragments, A2UI declarative components, deterministic code-with-output cards, Mermaid diagrams, formulas, tables, local 3D models, and approved media/source cards. Choose visual output when it materially improves understanding; do not force decoration on a short ordinary answer.",
    "For a visual explanation, use a single raw <div id='vcp-root'>...</div> or <div id='response-root'>...</div> fragment with inline style or an internal style tag. The workspace renders it as a live visual bubble. It supports semantic HTML, CSS grid/flex, gradients, shadows, SVG, and restrained CSS animation. Use different visual atmospheres for science, literature, warning, revision and terminal-like content instead of one fixed theme.",
    "For an interactive 3D scene explicitly requested by the user, you may output a complete HTML document containing Three.js code. The workspace recognizes it, supplies a local compatible THREE runtime, mounts the canvas, and renders it in a dedicated WebGL preview. Use the conventional APIs THREE.Scene, THREE.PerspectiveCamera, THREE.WebGLRenderer, geometry, material and mesh. Do not require arbitrary local files, credentials, or network fetches. For an uploaded GLB/GLTF, use the supplied A2UI modelId instead.",
    "For ordinary programming answers, use tsukumate.code and optionally a deterministic output field; code is displayed and copied but is not executed. For structured diagrams use Mermaid, mind maps, charts, tables or formulas. For a static styled learning card use a visual fragment. For an external image or video use only application-provided sourceId values. For a suggested reply button, only onclick=\"input('reply text')\" is available and fills the composer; never invent other handlers or APIs.",
    "Never emit the literal template marker {{VarDivRender}}, unresolved variables, or tool/DailyNote protocol inside a visual wrapper. Tool and DailyNote protocol text must remain raw and unstyled.",
    "Except for the explicit Three.js 3D-document case above, when structured rendering genuinely helps emit a raw HTML fragment directly in the answer while streaming. It must have exactly one root container: <div id='vcp-root' style='...'>...</div> or <div id='response-root' style='...'>...</div>. Do not use <!DOCTYPE html>, html, head, body, Markdown HTML fences, or present it as source code. Prefer normal Markdown for ordinary prose and use pre/code only when the learning content itself is code.",
    "Use {id,version:'0.9',theme,components:[...]}. theme must be one of science, literature, warning, review, terminal, default. Components are declarative only and use the tsukumate. namespace: tsukumate.text, tsukumate.markdown, tsukumate.code, tsukumate.table, tsukumate.document, tsukumate.image, tsukumate.htmlPreview, tsukumate.svgFragment, tsukumate.formula, tsukumate.mermaid, tsukumate.pretext, tsukumate.mindmap, tsukumate.chart, tsukumate.action, tsukumate.mediaVideo, tsukumate.model3d, tsukumate.stream.",
    "The raw visual fragment may use safe HTML/CSS/SVG and restrained CSS animation. Never include JavaScript, URLs, file paths, credentials, network requests, WebRTC SDP, or arbitrary commands. For a suggested-reply button only, onclick=\"input('reply text')\" is supported; no other event handler is allowed. Keep tool and DailyNote protocol blocks raw and unstyled, and never echo unresolved template variables.",
    "Images and video must only reference sourceId returned by the application; 3D uses modelId and streams use streamId. If no supplied id exists, use ordinary text instead.",
    "For tsukumate.code, include `output` only when the result is deterministic and fully known without executing code (for example output:'加速度为 5.0 m/s²'); otherwise omit it. Use visual fragments for emotionally or structurally rich learning layouts, choosing the atmosphere to fit the subject. For diagrams prefer tsukumate.mermaid, tsukumate.mindmap or tsukumate.chart. Actions must use an explicitly supplied allowlisted intent.",
  ].join(" ");
}

function uniStudyVisualSystemPrompt() {
  return UNISTUDY_AGENT_BUBBLE_THEME_PROMPT.replace("{{RenderingGuide}}", UNISTUDY_RENDERING_GUIDE);
}

function workspaceVisualOutputPrompt(input) {
  const text = String(input || "").toLowerCase();
  if (/(纯文字|不要(?:用)?(?:气泡|卡片|html|渲染)|不用(?:气泡|卡片|html)|plain\s*text|no\s*(?:card|bubble|html)|カードなし)/i.test(text)) {
    return "This turn is explicitly plain-text only. Use normal Markdown and do not emit a visual root fragment.";
  }
  const learningTask = /(单词|词汇|短语|课文|语法|梳理|整理|总结|复习|讲解|分析|对比|时间线|知识点|学习|练习|题目|做题|解题|怎么算|怎么做|附件题目|学习图片|flashcard|vocabulary|phrase|grammar|lesson|study|review|compare|timeline|solve|question)/i.test(text);
  if (!learningTask) return "Visual output is available when it materially improves comprehension; otherwise use concise normal Markdown.";
  return [
    "VISUAL OUTPUT IS REQUIRED FOR THIS TURN. Do not answer this learning-organization request as a plain Markdown wall of text.",
    "After at most one short introduction, emit one raw <div id='vcp-root' style='...'> visual learning card directly (not fenced). Use semantic headings and grouped sections/cards, strong typography and a restrained fitting color atmosphere. For mathematics, do not leave LaTex delimiters such as \\[, \\(, or \\frac as visible plain text: use a tsukumate.formula component, or safe HTML with readable superscripts/fractions. Keep source citations or ordinary prose outside only when necessary.",
    "For vocabulary or phrase organization, use visually separated groups with word/part-of-speech/meaning/example rather than a Markdown table. Never output {{VarDivRender}}.",
  ].join(" ");
}

module.exports = { MAX_SURFACES, MAX_COMPONENTS, parseA2uiSurfaces, a2uiSystemPrompt, uniStudyVisualSystemPrompt, workspaceVisualOutputPrompt, cleanSurface };
