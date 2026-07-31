"use strict";

const $ = (id) => document.getElementById(id);
const api = window.chatWorkspace;
let session = { messages: [], generating: false, conversation: null };
let pendingAttachments = [];
let selectedDiary = null;
let diaryOriginal = "";
let viewState = { content: "chat", drawer: null };
let learningTab = "notes";
let selectedNoteId = null;
let selectedPracticeId = null;
let learningNotes = [];
let learningResources = [];
let activePractice = null;
let activeQuestionIndex = 0;
let practiceDrafts = new Map();
let codingQaProblems = [];
let activeCodingQa = null;
let codingQaEditing = false;
let codingQaGenerating = false;
let codingQaPanel = "chat";
let codingRunnerLanguage = "cpp";
let codingRunnerRunning = false;
let codingRunnerStatus = "";
const codingEditorCursors = new Map();
// Keep the latest editor text locally while an asynchronous runner save is
// pending. Switching to the AI panel must never repaint the editor with an
// older persisted snapshot.
const codingEditorDrafts = new Map();
let codingRunnerSaveTimer = null;
let codingRunnerSaveChain = Promise.resolve();
let codingOjResults = [];
const codingQaMessageNodeCache = new Map();
const cardCleanups = [];
const a2uiCleanups = [];
const messageNodeCache = new Map();
let navigatorIdleTimer = null;
let navigatorDragging = false;
let live2dHasVisibleFrame = false;
let live2dPhase = "loading";
let webSearchEnabled = false;
let webSearchAvailable = false;
let pendingSessionSnapshot = null;
let pendingSessionTimer = null;
let activeMessageEdit = null;
let previewImage = null;
let previewAttachmentId = null;
let previewTool = null;
let previewDrawing = false;
let previewLastPoint = null;
let contextAttachmentId = null;
let conversationDrawerTab = "tree";
let previewZoom = 1;
let previewFitZoom = 1;
let annotationOps = [];
let annotationHistory = [[]];
let annotationHistoryIndex = 0;
let annotationDraft = null;
let annotationSelection = null;
let selectedAnnotationIndexes = new Set();
let annotationMoveOrigin = null;
let annotationMoveSnapshot = null;
if (window.TsukuMateRichContent) window.TsukuMateRichContent.onInput = (value) => { const prompt = $("prompt"); prompt.value = String(value || ""); prompt.focus(); };

function cleanupCards() { while (cardCleanups.length) { try { cardCleanups.pop()(); } catch {} } while (a2uiCleanups.length) { try { a2uiCleanups.pop()(); } catch {} } }
function escapeCodeHtml(value) { return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function highlightCode(value, language) {
  const escaped = escapeCodeHtml(value);
  const pattern = language === "python" ? /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#[^\n]*|\b(?:and|as|assert|async|await|break|class|continue|def|del|elif|else|except|False|finally|for|from|global|if|import|in|is|lambda|None|nonlocal|not|or|pass|raise|return|True|try|while|with|yield)\b|\b\d+(?:\.\d+)?\b)/g : /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#\s*\w+|\/\/[^\n]*|\/\*[\s\S]*?\*\/|\b(?:alignas|auto|bool|break|case|catch|char|class|const|constexpr|continue|default|delete|do|double|else|enum|explicit|extern|false|float|for|friend|if|inline|int|long|namespace|new|nullptr|operator|private|protected|public|return|short|signed|sizeof|static|string|struct|switch|template|this|throw|true|try|typedef|typename|union|unsigned|using|virtual|void|while)\b|\b\d+(?:\.\d+)?\b)/g;
  return escaped.replace(pattern, (token) => { const kind = token.startsWith("#") && language !== "python" ? "directive" : token.startsWith("//") || token.startsWith("/*") || token.startsWith("#") ? "comment" : token.startsWith("\"") || token.startsWith("'") ? "string" : /^\d/.test(token) ? "number" : "keyword"; return `<span class="token-${kind}">${token}</span>`; });
}
function setupCodingEditor() {
  const editor = $("coding-run-code"); if (!editor) return;
  let shell = $("coding-editor-shell");
  if (!shell) {
    shell = document.createElement("div"); shell.id = "coding-editor-shell"; shell.className = "coding-editor-shell";
    const gutter = document.createElement("div"); gutter.id = "coding-editor-gutter"; gutter.className = "coding-editor-gutter"; gutter.setAttribute("aria-hidden", "true");
    const highlight = document.createElement("pre"); highlight.id = "coding-editor-highlight"; highlight.className = "coding-editor-highlight"; highlight.setAttribute("aria-hidden", "true");
    editor.parentNode.insertBefore(shell, editor); shell.append(gutter, highlight, editor);
  }
  editor.classList.add("coding-code-editor");
  if (editor.dataset.editorReady) return;
  editor.dataset.editorReady = "true";
  const sync = () => { const gutter = $("coding-editor-gutter"); const highlight = $("coding-editor-highlight"); if (gutter) gutter.textContent = Array.from({ length: Math.max(1, editor.value.split("\n").length) }, (_, index) => String(index + 1)).join("\n"); if (highlight) { highlight.innerHTML = `${highlightCode(editor.value, codingRunnerLanguage)}\n`; highlight.scrollTop = editor.scrollTop; highlight.scrollLeft = editor.scrollLeft; } if (gutter) gutter.scrollTop = editor.scrollTop; };
  editor.addEventListener("input", () => { const key = codingEditorDraftKey(); if (key) codingEditorDrafts.set(key, editor.value); sync(); scheduleCodingRunnerSave(); });
  editor.addEventListener("scroll", sync, { passive: true });
  editor.addEventListener("keydown", (event) => {
    const start = editor.selectionStart; const end = editor.selectionEnd;
    const replace = (text, cursor = start + text.length) => { editor.setRangeText(text, start, end, "end"); editor.selectionStart = editor.selectionEnd = cursor; editor.dispatchEvent(new Event("input", { bubbles: true })); };
    if (event.key === "Tab") { event.preventDefault(); replace("  "); return; }
    if (event.key !== "Enter") return;
    event.preventDefault();
    const line = editor.value.slice(0, start).split("\n").pop() || "";
    const indentation = (line.match(/^\s*/) || [""])[0];
    const addsLevel = codingRunnerLanguage === "python" ? /:\s*(?:#.*)?$/.test(line) : /[{:([{]\s*(?:\/\/.*)?$/.test(line);
    replace(`\n${indentation}${addsLevel ? "  " : ""}`);
  });
  editor.addEventListener("blur", () => { void flushCodingRunnerSave(); });
  sync();
}
function setupCodingSplitter() {
  const layout = document.querySelector(".coding-qa-layout"); const problemPane = layout?.querySelector(".coding-problem-pane"); const chatPane = layout?.querySelector(".coding-chat-pane");
  if (!layout || !problemPane || !chatPane || layout.querySelector(".coding-pane-divider")) return;
  const divider = document.createElement("div"); divider.className = "coding-pane-divider"; divider.tabIndex = 0; divider.setAttribute("role", "separator"); divider.setAttribute("aria-label", "调整题面与答疑区域宽度"); divider.setAttribute("aria-orientation", "vertical"); divider.innerHTML = "<span aria-hidden=\"true\"></span>";
  layout.insertBefore(divider, chatPane); layout.classList.add("has-resizable-split");
  const stored = Number(localStorage.getItem("tsukumate.coding-problem-width")); if (Number.isFinite(stored) && stored > 0) layout.style.setProperty("--coding-problem-width", `${stored}px`);
  const applyWidth = (clientX) => { const bounds = layout.getBoundingClientRect(); const width = Math.round(Math.max(280, Math.min(bounds.width - 332, clientX - bounds.left))); layout.style.setProperty("--coding-problem-width", `${width}px`); divider.setAttribute("aria-valuenow", String(width)); localStorage.setItem("tsukumate.coding-problem-width", String(width)); };
  divider.addEventListener("pointerdown", (event) => { event.preventDefault(); divider.setPointerCapture(event.pointerId); divider.classList.add("is-dragging"); document.body.classList.add("coding-split-resizing"); applyWidth(event.clientX); });
  divider.addEventListener("pointermove", (event) => { if (divider.hasPointerCapture(event.pointerId)) applyWidth(event.clientX); });
  const stop = (event) => { if (divider.hasPointerCapture(event.pointerId)) divider.releasePointerCapture(event.pointerId); divider.classList.remove("is-dragging"); document.body.classList.remove("coding-split-resizing"); };
  divider.addEventListener("pointerup", stop); divider.addEventListener("pointercancel", stop);
  divider.addEventListener("keydown", (event) => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const bounds = layout.getBoundingClientRect(); const current = Number.parseFloat(getComputedStyle(layout).getPropertyValue("--coding-problem-width")) || problemPane.getBoundingClientRect().width; const target = event.key === "Home" ? 280 : event.key === "End" ? bounds.width - 332 : current + (event.key === "ArrowLeft" ? -24 : 24); applyWidth(bounds.left + target); });
}
function setupCodingProblemActions() {
  const pane = document.querySelector(".coding-problem-pane"); const headerActions = pane?.querySelector("header > div:last-child"); const upload = $("coding-qa-image"); const edit = $("coding-qa-edit"); const remove = $("coding-qa-delete");
  if (!pane || !headerActions || !upload || upload.parentElement === headerActions) return;
  const icons = {
    upload: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m0 0-4 4m4-4 4 4M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg>',
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16.5-.8 4.3 4.3-.8L19 8.5 15.5 5 4 16.5Z"/><path d="m14.5 6 3.5 3.5"/></svg>',
    remove: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M9 7l1-3h4l1 3m-9 0 1 13h10l1-13"/></svg>',
  };
  [[upload, "上传题目图片", icons.upload], [edit, "编辑题目", icons.edit], [remove, "删除题目", icons.remove]].forEach(([button, label, icon]) => { button.classList.add("coding-problem-icon"); button.title = label; button.setAttribute("aria-label", label); button.innerHTML = icon; });
  headerActions.prepend(upload);
}
function setupComposer() {
  const attachment = $("attachment-button"); const search = $("web-search"); const send = $("send"); const model = $("a2ui-model-button");
  if (!attachment || attachment.dataset.composerReady) return; attachment.dataset.composerReady = "true"; model.hidden = true;
  attachment.classList.add("composer-icon-button"); attachment.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17.5 18.3 11a4 4 0 0 0-5.7-5.6l-7.1 7.2a5.5 5.5 0 1 0 7.8 7.8l6.5-6.5"/></svg>'; attachment.setAttribute("aria-label", "添加附件"); attachment.title = "添加附件：图片、视频、3D 模型或代码文件";
  search.classList.add("composer-search-button"); search.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4M8.5 11h5M11 8.5v5"/></svg><span>网络搜索</span>';
  send.classList.add("composer-send-button"); send.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 4 16 8-16 8 3-8-3-8Zm3 8h8"/></svg>'; send.setAttribute("aria-label", "发送消息"); send.title = "发送消息";
}
function setupCodingQaComposer() {
  const code = $("coding-qa-send-code"); const send = $("coding-qa-send"); if (!code || code.dataset.composerReady) return; code.dataset.composerReady = "true";
  code.classList.add("coding-qa-composer-icon"); code.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 8-4 4 4 4m8-8 4 4-4 4M14 5l-4 14"/></svg>'; code.title = "发送当前代码给 AI"; code.setAttribute("aria-label", code.title);
  send.classList.add("coding-qa-composer-send"); send.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 4 16 8-16 8 3-8-3-8Zm3 8h8"/></svg>'; send.title = "发送问题"; send.setAttribute("aria-label", send.title);
}
function editableSelectionOffset(root) { const selection = window.getSelection(); if (!selection?.rangeCount || !root.contains(selection.anchorNode)) return root.textContent.length; const range = selection.getRangeAt(0).cloneRange(); range.selectNodeContents(root); range.setEnd(selection.anchorNode, selection.anchorOffset); return range.toString().length; }
function placeEditableCursor(root, offset) { const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let node; let remaining = Math.max(0, offset); while ((node = walker.nextNode())) { if (remaining <= node.data.length) { const range = document.createRange(); range.setStart(node, remaining); range.collapse(true); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); return; } remaining -= node.data.length; } root.focus(); }
function renderEditableCode(value, cursor) { const input = $("coding-editor-input"); if (!input) return; input.dataset.empty = String(!String(value || "").length); input.innerHTML = `${highlightCode(value, codingRunnerLanguage)}\n`; if (document.activeElement === input) placeEditableCursor(input, cursor); }
function codingEditorDraftKey(problemId = activeCodingQa?.id, language = codingRunnerLanguage) { return problemId ? `${problemId}:${language}` : null; }
function updateCodingEditor() { const editor = $("coding-run-code"); const input = $("coding-editor-input"); const gutter = $("coding-editor-gutter"); if (!editor || !input || !gutter) return; const cursor = editableSelectionOffset(input); const value = input.textContent.replace(/\n$/, ""); input.dataset.empty = String(!value.length); editor.value = value; const key = codingEditorDraftKey(); if (key) codingEditorDrafts.set(key, value); if (document.activeElement === input) codingEditorCursors.set(codingRunnerLanguage, cursor); gutter.textContent = Array.from({ length: Math.max(1, value.split("\n").length) }, (_, index) => String(index + 1)).join("\n"); if (document.activeElement === input) renderEditableCode(value, cursor); }
function setCodingEditorValue(value) { const editor = $("coding-run-code"); if (!editor) return; editor.value = String(value || ""); const key = codingEditorDraftKey(); if (key) codingEditorDrafts.set(key, editor.value); const gutter = $("coding-editor-gutter"); if (gutter) gutter.textContent = Array.from({ length: Math.max(1, editor.value.split("\n").length) }, (_, index) => String(index + 1)).join("\n"); const highlight = $("coding-editor-highlight"); if (highlight) highlight.innerHTML = `${highlightCode(editor.value, codingRunnerLanguage)}\n`; }
function replaceEditableSelection(root, text) { const start = editableSelectionOffset(root); const value = root.textContent.replace(/\n$/, ""); const selection = window.getSelection(); let end = start; if (selection?.rangeCount) { const range = selection.getRangeAt(0).cloneRange(); range.selectNodeContents(root); range.setEnd(selection.focusNode, selection.focusOffset); end = range.toString().length; } const next = `${value.slice(0, start)}${text}${value.slice(end)}`; $("coding-run-code").value = next; codingEditorCursors.set(codingRunnerLanguage, start + text.length); renderEditableCode(next, start + text.length); updateCodingEditor(); scheduleCodingRunnerSave(); }
function handleCodingEditorKeydown(event) { const input = event.currentTarget; if (event.key === "Tab") { event.preventDefault(); replaceEditableSelection(input, "  "); return; } if (event.key === "Enter") { const cursor = editableSelectionOffset(input); const value = input.textContent.replace(/\n$/, ""); const line = value.slice(0, cursor).split("\n").pop() || ""; const indentation = (line.match(/^\s*/) || [""])[0]; replaceEditableSelection(input, `\n${indentation}${/[{:([{]\s*$/.test(line) ? "  " : ""}`); return; } const pairs = { "(": ")", "[": "]", "{": "}", "\"": "\"", "'": "'" }; if (pairs[event.key]) { event.preventDefault(); const cursor = editableSelectionOffset(input); replaceEditableSelection(input, `${event.key}${pairs[event.key]}`); placeEditableCursor(input, cursor + 1); } }
function nearBottom() { const view = $("chat-view"); return view.scrollHeight - view.scrollTop - view.clientHeight < 90; }
function scrollToLatest(behavior = "auto") { $("chat-view").scrollTo({ top: $("chat-view").scrollHeight, behavior }); $("jump-bottom").hidden = true; activateConversationNavigator(); }
function updateJumpBottom() { $("jump-bottom").hidden = viewState.content !== "chat" || nearBottom(); }
function activateConversationNavigator() { const navigator = $("conversation-navigator"); navigator.classList.add("is-active"); clearTimeout(navigatorIdleTimer); navigatorIdleTimer = setTimeout(() => { if (!navigatorDragging) navigator.classList.remove("is-active"); }, 1000); }
function updateConversationNavigator() {
  const view = $("chat-view"); const navigator = $("conversation-navigator"); const track = $("conversation-nav-track"); const thumb = $("conversation-nav-thumb"); const markers = $("conversation-nav-markers"); const users = [...document.querySelectorAll(".message.user")]; const maxScroll = Math.max(0, view.scrollHeight - view.clientHeight);
  navigator.hidden = viewState.content !== "chat" || !users.length || !maxScroll;
  if (navigator.hidden) return;
  const trackHeight = Math.max(1, track.clientHeight); const thumbHeight = Math.max(28, Math.min(trackHeight, Math.round(trackHeight * (view.clientHeight / view.scrollHeight)))); const thumbTop = Math.round((trackHeight - thumbHeight) * (view.scrollTop / maxScroll));
  thumb.style.height = `${thumbHeight}px`; thumb.style.transform = `translateY(${thumbTop}px)`; track.setAttribute("aria-valuemin", "0"); track.setAttribute("aria-valuemax", String(Math.round(maxScroll))); track.setAttribute("aria-valuenow", String(Math.round(view.scrollTop))); markers.replaceChildren();
  for (const element of users) { const marker = document.createElement("button"); marker.type = "button"; marker.className = "conversation-nav-marker"; const label = `定位到第 ${element.dataset.messageIndex || ""} 条用户消息`; marker.title = label; marker.setAttribute("aria-label", label); const center = element.offsetTop + (element.offsetHeight / 2); marker.style.top = `${Math.max(3, Math.min(trackHeight - 7, (center / view.scrollHeight) * trackHeight))}px`; marker.onclick = () => { view.scrollTo({ top: Math.max(0, element.offsetTop - ((view.clientHeight - element.offsetHeight) / 2)), behavior: "smooth" }); activateConversationNavigator(); }; markers.append(marker); }
}
function scrollNavigatorTo(clientY) { const track = $("conversation-nav-track"); const view = $("chat-view"); const rect = track.getBoundingClientRect(); const progress = Math.max(0, Math.min(1, (clientY - rect.top) / Math.max(1, rect.height))); view.scrollTop = progress * Math.max(0, view.scrollHeight - view.clientHeight); }
function renderAttachment(attachment, interactive = false) {
  const chip = document.createElement("button"); chip.type = "button"; chip.className = "attachment-chip";
  const icon = attachment.kind === "image" ? "🖼" : attachment.kind === "media" ? "▸" : attachment.kind === "model" ? "◇" : "⌘";
  chip.textContent = `${icon} ${attachment.name}`;
  if (interactive) {
    chip.title = attachment.kind === "image" ? "点击预览；右键删除" : "右键删除附件";
    chip.onclick = () => { if (attachment.kind === "image") void openImageViewer(attachment); };
    chip.oncontextmenu = (event) => { event.preventDefault(); showAttachmentContextMenu(attachment.id, event.clientX, event.clientY); };
  } else chip.onclick = () => { if (attachment.kind === "image") void openImageViewer(attachment); else api.openAttachment(attachment.id); };
  return chip;
}
function showAttachmentContextMenu(id, x, y) { contextAttachmentId = id; const menu = $("attachment-context-menu"); menu.hidden = false; menu.style.left = `${Math.min(x, window.innerWidth - 150)}px`; menu.style.top = `${Math.min(y, window.innerHeight - 56)}px`; }
function closeAttachmentContextMenu() { $("attachment-context-menu").hidden = true; contextAttachmentId = null; }
function previewCanvasPoint(event) { const canvas = $("image-canvas"); const rect = canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) }; }
function applyPreviewZoom() { const canvas = $("image-canvas"); canvas.style.width = `${Math.max(1, Math.round(canvas.width * previewZoom))}px`; canvas.style.height = `${Math.max(1, Math.round(canvas.height * previewZoom))}px`; $("image-zoom-value").textContent = `${Math.round(previewZoom * 100)}%`; }
function fitPreviewImage() { const canvas = $("image-canvas"); const wrap = document.querySelector(".image-canvas-wrap"); if (!canvas.width || !wrap) return; previewFitZoom = Math.max(.08, Math.min(1, (wrap.clientWidth - 36) / canvas.width, (wrap.clientHeight - 36) / canvas.height)); previewZoom = previewFitZoom; applyPreviewZoom(); }
function opBounds(op) { if (op.type === "text") return { x: op.x, y: op.y - op.size, w: Math.max(op.size * op.text.length, op.size), h: op.size * 1.25 }; const points = op.points || [{ x: op.x1, y: op.y1 }, { x: op.x2, y: op.y2 }]; const xs = points.map((p) => p.x); const ys = points.map((p) => p.y); const pad = (op.width || 1) + 4; return { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...ys) - Math.min(...ys) + pad * 2 }; }
function rectsIntersect(a, b) { return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y; }
function drawAnnotation(ctx, op) { ctx.save(); ctx.strokeStyle = op.color; ctx.fillStyle = op.color; ctx.lineWidth = op.width; ctx.lineCap = "round"; ctx.lineJoin = "round"; if (op.type === "brush") { ctx.beginPath(); op.points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.stroke(); } else if (op.type === "line") { ctx.beginPath(); ctx.moveTo(op.x1, op.y1); ctx.lineTo(op.x2, op.y2); ctx.stroke(); } else if (op.type === "rect") { ctx.strokeRect(Math.min(op.x1, op.x2), Math.min(op.y1, op.y2), Math.abs(op.x2 - op.x1), Math.abs(op.y2 - op.y1)); } else if (op.type === "circle") { ctx.beginPath(); const cx = (op.x1 + op.x2) / 2; const cy = (op.y1 + op.y2) / 2; ctx.ellipse(cx, cy, Math.abs(op.x2 - op.x1) / 2, Math.abs(op.y2 - op.y1) / 2, 0, 0, Math.PI * 2); ctx.stroke(); } else if (op.type === "text") { ctx.font = `${op.size}px -apple-system, PingFang SC, sans-serif`; ctx.fillText(op.text, op.x, op.y); } ctx.restore(); }
function renderAnnotations() { const canvas = $("image-canvas"); if (!previewImage) return; const ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(previewImage, 0, 0, canvas.width, canvas.height); annotationOps.forEach((op, index) => { drawAnnotation(ctx, op); if (selectedAnnotationIndexes.has(index)) { const box = opBounds(op); ctx.save(); ctx.strokeStyle = "#70b1ff"; ctx.lineWidth = Math.max(1, canvas.width / 1200); ctx.setLineDash([7, 5]); ctx.strokeRect(box.x, box.y, box.w, box.h); ctx.restore(); } }); if (annotationDraft) drawAnnotation(ctx, annotationDraft); if (annotationSelection) { ctx.save(); ctx.strokeStyle = "#70b1ff"; ctx.lineWidth = Math.max(1, canvas.width / 1200); ctx.setLineDash([8, 5]); ctx.fillStyle = "rgba(78,152,255,.12)"; ctx.fillRect(annotationSelection.x, annotationSelection.y, annotationSelection.w, annotationSelection.h); ctx.strokeRect(annotationSelection.x, annotationSelection.y, annotationSelection.w, annotationSelection.h); ctx.restore(); } }
function drawPreviewBase() { const canvas = $("image-canvas"); if (!previewImage) return; const max = 4096; const scale = Math.min(1, max / Math.max(previewImage.naturalWidth, previewImage.naturalHeight)); canvas.width = Math.max(1, Math.round(previewImage.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(previewImage.naturalHeight * scale)); annotationOps = []; annotationHistory = [[]]; annotationHistoryIndex = 0; selectedAnnotationIndexes.clear(); renderAnnotations(); }
function commitAnnotations() { annotationHistory = annotationHistory.slice(0, annotationHistoryIndex + 1); annotationHistory.push(structuredClone(annotationOps)); annotationHistoryIndex += 1; updateAnnotationHistoryButtons(); }
function updateAnnotationHistoryButtons() { $("image-undo").disabled = annotationHistoryIndex <= 0; $("image-redo").disabled = annotationHistoryIndex >= annotationHistory.length - 1; }
function restoreAnnotationHistory(index) { annotationHistoryIndex = Math.max(0, Math.min(annotationHistory.length - 1, index)); annotationOps = structuredClone(annotationHistory[annotationHistoryIndex]); selectedAnnotationIndexes.clear(); annotationSelection = null; hideAnnotationSelectionMenu(); renderAnnotations(); updateAnnotationHistoryButtons(); }
function clearAnnotations() { if (!annotationOps.length) return; annotationOps = []; selectedAnnotationIndexes.clear(); annotationSelection = null; hideAnnotationSelectionMenu(); commitAnnotations(); renderAnnotations(); }
function selectedAnnotationBounds() { const boxes = [...selectedAnnotationIndexes].map((index) => opBounds(annotationOps[index])).filter(Boolean); if (!boxes.length) return null; const x = Math.min(...boxes.map((box) => box.x)); const y = Math.min(...boxes.map((box) => box.y)); const right = Math.max(...boxes.map((box) => box.x + box.w)); const bottom = Math.max(...boxes.map((box) => box.y + box.h)); return { x, y, w: right - x, h: bottom - y }; }
function moveAnnotation(op, dx, dy) { if (op.points) op.points = op.points.map((point) => ({ x: point.x + dx, y: point.y + dy })); else if (op.type === "text") { op.x += dx; op.y += dy; } else { op.x1 += dx; op.y1 += dy; op.x2 += dx; op.y2 += dy; } }
function scaleAnnotation(op, center, factor) { const scalePoint = (point) => ({ x: center.x + (point.x - center.x) * factor, y: center.y + (point.y - center.y) * factor }); if (op.points) op.points = op.points.map(scalePoint); else if (op.type === "text") { const p = scalePoint(op); op.x = p.x; op.y = p.y; op.size *= factor; } else { const a = scalePoint({ x: op.x1, y: op.y1 }); const b = scalePoint({ x: op.x2, y: op.y2 }); op.x1 = a.x; op.y1 = a.y; op.x2 = b.x; op.y2 = b.y; } op.width = Math.max(1, (op.width || 1) * factor); }
function hideAnnotationSelectionMenu() { $("annotation-selection-menu").hidden = true; }
function showAnnotationSelectionMenu() { const bounds = selectedAnnotationBounds(); if (!bounds) return hideAnnotationSelectionMenu(); const canvas = $("image-canvas"); const wrap = document.querySelector(".image-canvas-wrap"); const canvasRect = canvas.getBoundingClientRect(); const wrapRect = wrap.getBoundingClientRect(); const menu = $("annotation-selection-menu"); menu.hidden = false; menu.style.left = `${Math.max(8, Math.min(wrap.clientWidth - 156, canvasRect.left - wrapRect.left + ((bounds.x + bounds.w) / canvas.width) * canvasRect.width + 8))}px`; menu.style.top = `${Math.max(8, canvasRect.top - wrapRect.top + (bounds.y / canvas.height) * canvasRect.height - 4)}px`; $("annotation-color").value = annotationOps[[...selectedAnnotationIndexes][0]]?.color || $("image-color").value; }
function selectPreviewTool(tool) { previewTool = tool; for (const id of ["image-select", "image-brush", "image-text", "image-eraser", "image-line", "image-rect", "image-circle"]) $(id).classList.toggle("active", (id === "image-select" && tool === "select") || id === `image-${tool}`); $("image-canvas").style.cursor = tool === "select" ? "default" : "crosshair"; }
async function openImageViewer(attachment) {
  const result = await api.previewAttachmentImage(attachment.id); if (!result?.ok || !result.image) { $("send-status").textContent = result?.error || "无法打开图片预览"; return; }
  openImageViewerData(result.image, attachment.id);
}
function openImageViewerData(imageData, attachmentId = null) {
  const image = new Image(); image.onload = () => { previewImage = image; previewAttachmentId = attachmentId; $("image-viewer-title").textContent = imageData.name || "图片预览"; $("image-ocr-result").hidden = true; $("image-ocr-text").value = ""; $("image-more-menu").hidden = true; $("image-markup-panel").hidden = true; $("image-markup-toggle").setAttribute("aria-pressed", "false"); selectPreviewTool("select"); drawPreviewBase(); updateAnnotationHistoryButtons(); $("image-viewer").hidden = false; requestAnimationFrame(fitPreviewImage); }; image.onerror = () => { $("send-status").textContent = "图片无法显示"; }; image.src = imageData.dataUrl;
}
function closeImageViewer() { $("image-viewer").hidden = true; $("image-more-menu").hidden = true; $("image-markup-panel").hidden = true; previewImage = null; previewAttachmentId = null; previewDrawing = false; selectPreviewTool("select"); }
async function copyPreviewImage() { const canvas = $("image-canvas"); try { const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png")); if (!blob || !navigator.clipboard?.write || typeof ClipboardItem === "undefined") throw new Error("当前系统不支持写入图片剪贴板"); await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]); $("send-status").textContent = "图片已复制到剪贴板"; } catch (error) { $("send-status").textContent = String(error?.message || "复制图片失败"); } }
function downloadPreviewImage() { const link = document.createElement("a"); link.href = $("image-canvas").toDataURL("image/png"); link.download = `${$("image-viewer-title").textContent || "图片"}-批注.png`; link.click(); }
function appendMarkdownInline(target, value) {
  const parts = String(value || "").split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith("**") && part.endsWith("**")) { const strong = document.createElement("strong"); strong.textContent = part.slice(2, -2); target.append(strong); }
    else if (part.startsWith("`") && part.endsWith("`")) { const code = document.createElement("code"); code.textContent = part.slice(1, -1); target.append(code); }
    else target.append(document.createTextNode(part));
  }
}
function renderSafeMarkdown(value) {
  const root = document.createElement("div"); root.className = "message-markdown"; let list = null; let code = null; let codeLanguage = ""; let rawHtml = null; let fragment = null; let fragmentDepth = 0;
  const flushList = () => { if (list) root.append(list); list = null; };
  const appendCode = (source = code?.join("\n") || "", language = codeLanguage || "text", completed = true) => {
    if (completed && /^(html?|xhtml)$/i.test(language) && /^\s*<div\b[^>]*\bid\s*=\s*["'](?:vcp-root|response-root)["']/i.test(source) && window.TsukuMateRichContent?.renderInlineFragment) {
      const visual = document.createElement("div"); visual.className = "message-inline-visual";
      window.TsukuMateRichContent.renderInlineFragment(visual, source); root.append(visual);
      return;
    }
    // Like UniStudy, a complete web document opens as its preview card first.
    // Its source remains available from the card toolbar instead of pushing the
    // useful rendered result below hundreds of lines of HTML/JavaScript.
    if (completed && /^(html?|xhtml)$/i.test(language) && window.TsukuMateRichContent) {
      const preview = document.createElement("div"); preview.className = "message-html-preview";
      window.TsukuMateRichContent.renderCard(preview, { html: source, css: "" }); root.append(preview);
      return;
    }
    const shell = document.createElement("pre"); shell.className = "message-code-block"; shell.dataset.language = language;
    const codeNode = document.createElement("code"); codeNode.textContent = source; shell.append(codeNode); root.append(shell);
    // A fenced HTML document is a declared visual artifact, not prose. Keep its
    // source visible, then render it in the existing sandboxed UniStudy-derived
    // preview boundary. Scripts, network access and event handlers stay blocked.
  };
  const lines = String(value || "").split("\n");
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (fragment) {
      fragment.push(line); fragmentDepth += (line.match(/<div\b[^>]*>/gi) || []).length - (line.match(/<\/div\s*>/gi) || []).length;
      if (fragmentDepth <= 0) { appendCode(fragment.join("\n"), "html"); fragment = null; fragmentDepth = 0; }
      continue;
    }
    if (rawHtml) {
      rawHtml.push(line);
      if (/^\s*<\/html\s*>\s*$/i.test(line)) { appendCode(rawHtml.join("\n"), "html"); rawHtml = null; }
      continue;
    }
    const fence = line.match(/^```\s*([\w.+#-]*)\s*$/);
    if (fence) { flushList(); if (code) { appendCode(); code = null; codeLanguage = ""; } else { code = []; codeLanguage = fence[1] || "text"; } continue; }
    if (code) { code.push(line); continue; }
    // UniStudy recognizes a raw complete web document even when a model omits
    // the Markdown fence. Treat it as an HTML artifact rather than paragraphs.
    if (/^\s*(?:<!doctype\s+html\b[^>]*>|<html\b[^>]*>)/i.test(line)) {
      flushList(); rawHtml = [line];
      if (/<\/html\s*>\s*$/i.test(line)) { appendCode(rawHtml.join("\n"), "html"); rawHtml = null; }
      continue;
    }
    // UniStudy visual containers are raw fragments rather than complete HTML
    // documents. Render only the explicit root IDs, never arbitrary raw tags.
    if (/^\s*<div\b[^>]*\bid\s*=\s*["'](?:vcp-root|response-root)["']/i.test(line)) {
      flushList(); fragment = [line]; fragmentDepth = (line.match(/<div\b[^>]*>/gi) || []).length - (line.match(/<\/div\s*>/gi) || []).length;
      if (fragmentDepth <= 0) { appendCode(fragment.join("\n"), "html"); fragment = null; fragmentDepth = 0; }
      continue;
    }
    // Keep problem statements readable: programming questions frequently use
    // Markdown tables for constraints and samples.  Build the table with DOM
    // nodes so cell content stays escaped just like normal prose.
    const tableSeparator = lines[lineIndex + 1];
    if (/\|/.test(line) && /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(tableSeparator || "")) {
      flushList();
      const cells = (row) => String(row).trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
      const table = document.createElement("table"); const head = document.createElement("thead"); const headRow = document.createElement("tr");
      for (const cell of cells(line)) { const th = document.createElement("th"); appendMarkdownInline(th, cell); headRow.append(th); }
      head.append(headRow); table.append(head); const body = document.createElement("tbody"); lineIndex += 2;
      while (lineIndex < lines.length && /\|/.test(lines[lineIndex]) && lines[lineIndex].trim()) { const tr = document.createElement("tr"); for (const cell of cells(lines[lineIndex])) { const td = document.createElement("td"); appendMarkdownInline(td, cell); tr.append(td); } body.append(tr); lineIndex += 1; }
      lineIndex -= 1; table.append(body); root.append(table); continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/); const item = line.match(/^[-*]\s+(.+)$/);
    if (heading) { flushList(); const node = document.createElement(`h${heading[1].length + 1}`); appendMarkdownInline(node, heading[2]); root.append(node); }
    else if (item) { if (!list) list = document.createElement("ul"); const node = document.createElement("li"); appendMarkdownInline(node, item[1]); list.append(node); }
    else { flushList(); if (!line.trim()) { root.append(document.createElement("br")); continue; } const node = document.createElement("p"); appendMarkdownInline(node, line); root.append(node); }
  }
  if (code) appendCode(undefined, undefined, false);
  if (rawHtml) appendCode(rawHtml.join("\n"), "html", false);
  // Browsers close an unfinished div fragment safely, so showing it now gives
  // the UniStudy-style visual streaming effect instead of a raw HTML tail.
  if (fragment) appendCode(fragment.join("\n"), "html", true);
  flushList(); return root;
}
function splitStreamingContent(value, streaming) {
  const source = String(value || ""); if (!streaming) return { stable: source, tail: "" };
  const fence = source.lastIndexOf("```"); if (fence >= 0 && source.indexOf("```", fence + 3) < 0) return { stable: source.slice(0, fence), tail: source.slice(fence) };
  const boundary = source.lastIndexOf("\n\n"); return boundary >= 0 ? { stable: source.slice(0, boundary + 2), tail: source.slice(boundary + 2) } : { stable: "", tail: source };
}
function bubbleTheme(message) {
  const surfaceTheme = message.a2uiSurfaces?.find((item) => item?.theme)?.theme;
  if (surfaceTheme) return surfaceTheme;
  const value = String(message.content || "").toLowerCase();
  if (/(警告|危险|错误|注意|warning)/.test(value)) return "warning";
  if (/(诗|文学|散文|阅读|历史|语文)/.test(value)) return "literature";
  if (/(复习|练习|测验|flashcard)/.test(value)) return "review";
  if (/(代码|python|javascript|终端|debug)/.test(value)) return "terminal";
  return "default";
}
function clearMessageNode(row) { for (const cleanup of row._tmCleanups || []) { try { cleanup(); } catch {} } if (row._tmThinkingTimer) clearInterval(row._tmThinkingTimer); delete row._tmThinkingTimer; row._tmCleanups = []; delete row._tmVisualText; delete row._tmCompletedAssistantBlocks; }
async function copyMessageText(value, status = "内容已复制") { try { await navigator.clipboard.writeText(String(value || "")); $("send-status").textContent = status; } catch { $("send-status").textContent = "复制失败"; } }
const MESSAGE_ACTION_ICONS = {
  // Original TsukuMate line marks — intentionally not copied from AI Studio.
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 17.8 6.2 13l8.5-8.5 3.3 3.3-8.5 8.5L5 17.8Z"/><path d="m13.6 5.6 3.3 3.3M5 20h14"/></svg>',
  regenerate: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.5 8.2A7.2 7.2 0 0 0 6.3 6.5M5.5 4.8v3.9h3.9M5.5 15.8a7.2 7.2 0 0 0 12.2 1.7m.8 1.7v-3.9h-3.9"/></svg>',
  more: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h.01M12 7h.01M17 7h.01M7 12h.01M12 12h.01M17 12h.01M7 17h.01M12 17h.01M17 17h.01"/></svg>',
  branch: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4v9a4 4 0 0 0 4 4h8M14 8l4-4 4 4M14 20l4 4 4-4"/></svg>',
};
function createMessageAction(icon, label, onClick, className = "") {
  const button = document.createElement("button"); button.type = "button"; button.className = `message-action ${className}`.trim(); button.title = label; button.setAttribute("aria-label", label); button.innerHTML = MESSAGE_ACTION_ICONS[icon] || ""; button.onclick = onClick; return button;
}
function closeMessageActionMenus(except) { document.querySelectorAll(".message-more-menu:not([hidden])").forEach((menu) => { if (menu !== except) menu.hidden = true; }); }
function appendMessageMore(actions, items) {
  const wrap = document.createElement("div"); wrap.className = "message-more-wrap";
  const menu = document.createElement("div"); menu.className = "message-more-menu"; menu.hidden = true;
  for (const [label, action, danger] of items) { const button = document.createElement("button"); button.type = "button"; button.textContent = label; if (danger) button.className = "message-action-danger"; button.onclick = () => { menu.hidden = true; action(); }; menu.append(button); }
  const more = createMessageAction("more", "更多操作", (event) => { event.stopPropagation(); const next = menu.hidden; closeMessageActionMenus(menu); menu.hidden = !next; });
  wrap.append(more, menu); actions.append(wrap);
}
async function deleteWorkspaceMessage(message) {
  if (!message?.id || !confirm("删除这条消息吗？此操作无法撤销。")) return;
  const result = await api.deleteMessage(message.id);
  $("send-status").textContent = result?.ok ? "已删除消息" : (result?.error || "删除失败");
}
async function editWorkspaceMessage(message) {
  if (!message?.id || session.generating) return;
  cancelInlineMessageEdit();
  const row = document.querySelector(`[data-message-id="${CSS.escape(message.id)}"]`); const text = row?.querySelector(".message-text");
  if (!row || !text) { $("send-status").textContent = "无法定位要编辑的消息"; return; }
  try { window.TsukuMateRichContent?.cleanupVisualMessage?.(text); } catch {}
  const editor = document.createElement("textarea"); editor.className = "message-inline-editor"; editor.value = String(message.content || ""); editor.maxLength = 16000; editor.setAttribute("aria-label", message.role === "assistant" ? "编辑 AI 回复" : "编辑发送内容");
  const footer = document.createElement("div"); footer.className = "message-inline-editor-actions";
  const hint = document.createElement("span"); hint.textContent = "Cmd/Ctrl + Enter 保存";
  const cancel = document.createElement("button"); cancel.type = "button"; cancel.textContent = "取消"; cancel.onclick = () => cancelInlineMessageEdit();
  const save = document.createElement("button"); save.type = "button"; save.className = "primary"; save.textContent = "保存"; save.onclick = () => saveInlineMessageEdit();
  footer.append(hint, cancel, save); text.replaceChildren(editor, footer); row.classList.add("is-inline-editing");
  activeMessageEdit = { message, row, editor, save };
  editor.onkeydown = (event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); saveInlineMessageEdit(); } if (event.key === "Escape") cancelInlineMessageEdit(); };
  requestAnimationFrame(() => { editor.focus(); editor.setSelectionRange(0, 0); });
}
function cancelInlineMessageEdit(replacement) {
  const edit = activeMessageEdit; if (!edit) return;
  activeMessageEdit = null; edit.row.classList.remove("is-inline-editing");
  clearMessageNode(edit.row); edit.row.replaceChildren(); delete edit.row.dataset.signature;
  renderMessageNode(edit.row, replacement || edit.message);
}
async function saveInlineMessageEdit() {
  const edit = activeMessageEdit; const content = edit?.editor.value.trim();
  if (!edit || !content) { if (edit) $("send-status").textContent = "消息不能为空"; return; }
  edit.save.disabled = true; const result = await api.updateMessage(edit.message.id, content); edit.save.disabled = false;
  if (!result?.ok) { $("send-status").textContent = result?.error || "保存失败"; return; }
  cancelInlineMessageEdit({ ...edit.message, ...result.message }); $("send-status").textContent = "已保存编辑";
}
async function regenerateWorkspaceMessage(message) {
  if (!confirm("重新生成这条 AI 回复？当前回复将被替换。")) return;
  const result = await api.regenerateMessage(message.id);
  $("send-status").textContent = result?.ok ? "正在重新生成…" : (result?.error || "重新生成失败");
}
function openBranchPicker(message, vocabulary = null) {
  if (!message?.id || session.generating) return;
  document.querySelector(".branch-picker")?.remove(); const dialog = document.createElement("div"); dialog.className = "branch-picker"; dialog.setAttribute("role", "dialog"); dialog.setAttribute("aria-modal", "true");
  const term = vocabulary?.term || ""; const definition = vocabulary?.definition || ""; dialog.innerHTML = `<section><header><div><strong>${term ? `围绕“${term}”继续学习` : "建立对话分支"}</strong><small>${term ? definition : "选择新话题应如何使用当前对话"}</small></div><button type="button" aria-label="关闭">×</button></header><div class="branch-picker-options"></div></section>`;
  const close = () => dialog.remove(); dialog.onclick = (event) => { if (event.target === dialog) close(); }; dialog.querySelector("header button").onclick = close;
  const options = term ? [["词汇关联分支", "带入父话题摘要、原句和词汇解释", "vocabulary"]] : [["继承分支", "继承分支点前的对话与上下文", "inherit"], ["关联主题", "只带入父话题标题和摘要", "related"]]; const root = dialog.querySelector(".branch-picker-options");
  for (const [title, description, type] of options) { const button = document.createElement("button"); button.type = "button"; button.innerHTML = `<strong>${title}</strong><span>${description}</span>`; button.onclick = async () => { button.disabled = true; const result = await api.createBranch({ messageId: message.id, type, sentence: term ? String(message.content || "").slice(0, 1400) : "", term, definition }); if (!result?.ok) { $("send-status").textContent = result?.error || "建立分支失败"; button.disabled = false; return; } session = result.session || session; viewState = { content: "chat", drawer: null }; renderView(); $("send-status").textContent = "已创建分支对话"; close(); }; root.append(button); }
  document.body.append(dialog);
}
function closeVocabularyPopover() { document.querySelector(".learning-vocabulary-popover")?.remove(); }
function showVocabularyPopover(anchor, annotation, message) { closeVocabularyPopover(); const popover = document.createElement("section"); popover.className = "learning-vocabulary-popover"; popover.innerHTML = '<button type="button" class="vocabulary-close" aria-label="关闭">×</button><strong></strong><p></p><button type="button" class="vocabulary-branch">围绕此词继续学习</button>'; popover.querySelector("strong").textContent = annotation.term; popover.querySelector("p").textContent = annotation.definition; popover.querySelector(".vocabulary-close").onclick = closeVocabularyPopover; popover.querySelector(".vocabulary-branch").onclick = () => { closeVocabularyPopover(); openBranchPicker(message, annotation); }; document.body.append(popover); const rect = anchor.getBoundingClientRect(); popover.style.left = `${Math.max(12, Math.min(window.innerWidth - 350, rect.left))}px`; popover.style.top = `${Math.min(window.innerHeight - 180, rect.bottom + 10)}px`; }
function applyLearningAnnotations(root, message) { const annotations = Array.isArray(message.learningAnnotations) ? message.learningAnnotations.filter((item) => item?.term && item?.definition).slice(0, 5) : []; const fingerprint = JSON.stringify(annotations.map((item) => [item.id, item.start, item.end, item.term])); if (!annotations.length || !root || root.dataset.annotationsFor === fingerprint) return; const terms = annotations.slice().sort((a, b) => String(b.term).length - String(a.term).length); const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const nodes = []; let node; while ((node = walker.nextNode())) if (node.parentElement && !node.parentElement.closest("code,pre,a,button,textarea,input,.thinking-card,.message-actions,.tm-inline-visual-fragment,.study-card-list,.a2ui-surface-list")) nodes.push(node); for (const textNode of nodes) { const value = textNode.data; const matches = terms.map((annotation) => ({ annotation, start: value.indexOf(annotation.term) })).filter((item) => item.start >= 0).sort((a, b) => a.start - b.start); if (!matches.length) continue; const fragment = document.createDocumentFragment(); let cursor = 0; for (const match of matches) { const end = match.start + match.annotation.term.length; if (match.start < cursor) continue; fragment.append(document.createTextNode(value.slice(cursor, match.start))); const mark = document.createElement("button"); mark.type = "button"; mark.className = "learning-vocabulary-term"; mark.textContent = value.slice(match.start, end); mark.title = `查看“${match.annotation.term}”解释`; mark.onclick = () => showVocabularyPopover(mark, match.annotation, message); fragment.append(mark); cursor = end; } fragment.append(document.createTextNode(value.slice(cursor))); textNode.replaceWith(fragment); } root.dataset.annotationsFor = fingerprint; }
function downloadAssistantMessage(message) {
  const content = String(message.content || "");
  const code = content.match(/```([a-zA-Z0-9_+-]+)?\s*\n([\s\S]*?)```/);
  const html = /<(?:div|style|svg|canvas)\b/i.test(content);
  const extensionMap = { javascript: "js", js: "js", typescript: "ts", ts: "ts", python: "py", py: "py", java: "java", cpp: "cpp", "c++": "cpp", cxx: "cpp", cc: "cpp", c: "c", csharp: "cs", "c#": "cs", cs: "cs", html: "html", css: "css", json: "json", sql: "sql", bash: "sh", shell: "sh" };
  const extension = code ? (extensionMap[String(code[1] || "").toLowerCase()] || "txt") : (html ? "html" : "md");
  const output = code && extension !== "txt" ? code[2] : content;
  const mime = extension === "html" ? "text/html;charset=utf-8" : extension === "md" ? "text/markdown;charset=utf-8" : "text/plain;charset=utf-8";
  const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([output], { type: mime })); link.download = `TsukuMate-${new Date().toISOString().slice(0, 10)}.${extension}`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 0);
  $("send-status").textContent = `已导出 .${extension} 文件`;
}
function appendUserMessageActions(row, message) {
  if (row._tmUserMessageActions) return;
  const actions = document.createElement("div"); actions.className = "message-actions message-user-actions";
  actions.append(createMessageAction("edit", "编辑消息", () => editWorkspaceMessage(message)));
  appendMessageMore(actions, [["建立分支", () => openBranchPicker(message)], ["复制", () => copyMessageText(message.content, "已复制发送内容")], ["删除", () => deleteWorkspaceMessage(message), true]]);
  row.prepend(actions); row._tmUserMessageActions = actions;
}
function appendCompletedAssistantBlocks(row, message) {
  if (row._tmCompletedAssistantBlocks) return;
  row._tmCompletedAssistantBlocks = true;
  if (Array.isArray(message.richCards) && window.TsukuMateRichContent) { const cards = document.createElement("div"); cards.className = "study-card-list"; row.append(cards); for (const card of message.richCards.slice(0, 3)) row._tmCleanups.push(window.TsukuMateRichContent.renderCard(cards, card)); }
  if (Array.isArray(message.a2uiSurfaces) && window.TsukuMateA2UI) { const surfaces = document.createElement("div"); surfaces.className = "a2ui-surface-list"; row.append(surfaces); for (const surface of message.a2uiSurfaces.slice(0, 2)) row._tmCleanups.push(window.TsukuMateA2UI.renderSurface(surfaces, surface)); }
  if (message.id) { const actions = document.createElement("div"); actions.className = "message-actions message-learning-actions"; actions.append(createMessageAction("edit", "编辑回复", () => editWorkspaceMessage(message)), createMessageAction("regenerate", "重新生成", () => regenerateWorkspaceMessage(message))); appendMessageMore(actions, [["建立分支", () => openBranchPicker(message)], ["记入笔记", async () => { const result = await api.noteFromMessage(message.id); if (!result?.ok) { $("send-status").textContent = result?.error || "创建笔记失败"; return; } selectedNoteId = result.note.id; await openLearning("notes"); }], ["复制", () => copyMessageText(message.content, "已复制 AI 回复")], ["下载", () => downloadAssistantMessage(message)], ["删除", () => deleteWorkspaceMessage(message), true]]); row.prepend(actions); }
}
function renderThinkingMarkdown(value) {
  const root = document.createElement("div"); root.className = "thinking-card-markdown"; let list = null; let code = null;
  const flushList = () => { if (list) { root.append(list); list = null; } };
  for (const line of String(value || "").split("\n")) {
    if (/^```/.test(line)) { flushList(); if (code) { root.append(code); code = null; } else { code = document.createElement("pre"); } continue; }
    if (code) { code.textContent += `${code.textContent ? "\n" : ""}${line}`; continue; }
    const heading = line.match(/^#{1,4}\s+(.+)$/); const item = line.match(/^[-*]\s+(.+)$/);
    if (heading) { flushList(); const node = document.createElement("strong"); appendMarkdownInline(node, heading[1]); root.append(node); }
    else if (item) { if (!list) list = document.createElement("ul"); const node = document.createElement("li"); appendMarkdownInline(node, item[1]); list.append(node); }
    else { flushList(); const node = document.createElement("p"); appendMarkdownInline(node, line || " "); root.append(node); }
  }
  if (code) root.append(code); flushList(); return root;
}
function displayThinkingText(value) {
  // Keep the model's streamed reasoning — this is what makes the card feel
  // alive like UniStudy/AI Studio — but remove protocol markers and translate
  // the two terse traces produced by the configured Codex gateway.
  return String(value || "").replace(/<\/?(?:think|thinking)>/gi, "").split("\n").map((line) => {
    const trimmed = line.trim();
    if (/^planning chinese visual explanation$/i.test(trimmed)) return "正在规划中文可视化讲解";
    if (/^designing detailed prose explanation$/i.test(trimmed)) return "正在组织详细的文字讲解";
    if (/^planning chinese greeting response(?:\s+with\s+.*)?$/i.test(trimmed)) return "正在规划问候与回应方式";
    return line.replace(/\b(?:CPA tag|system prompt|persona tag)\b/gi, "").trim();
  }).filter(Boolean).join("\n").trim();
}
function thinkingPreviewLines(value) {
  return displayThinkingText(value).split("\n").map((line) => line.trim()).filter(Boolean).slice(-3);
}
function formatGenerationTime(milliseconds) {
  const totalCentiseconds = Math.floor(Math.max(0, Number(milliseconds) || 0) / 10);
  const minutes = Math.floor(totalCentiseconds / 6000);
  const seconds = (totalCentiseconds % 6000) / 100;
  return minutes ? `${minutes}m ${seconds.toFixed(2).padStart(5, "0")}` : seconds.toFixed(2).padStart(5, "0");
}
function syncThinkingTimer(row, card, message) {
  const timer = card.querySelector(".thinking-card-timer");
  if (!timer) return;
  const startedAt = Number(message.generationStartedAt) || Date.parse(message.timestamp || "") || Date.now();
  const update = () => {
    const elapsed = message.streaming ? Date.now() - startedAt : (Number(message.generationDurationMs) || Date.now() - startedAt);
    timer.textContent = formatGenerationTime(elapsed);
  };
  update();
  if (message.streaming) {
    if (!row._tmThinkingTimer || row._tmThinkingTimerStartedAt !== startedAt) {
      if (row._tmThinkingTimer) clearInterval(row._tmThinkingTimer);
      row._tmThinkingTimerStartedAt = startedAt;
      row._tmThinkingTimer = setInterval(update, 40);
    }
  } else if (row._tmThinkingTimer) {
    clearInterval(row._tmThinkingTimer); delete row._tmThinkingTimer;
  }
}
function renderThinkingCard(row, message) {
  const shouldShow = message.role === "assistant" && (!!message.thinkingState || !!message.thinking || !!message.streaming);
  if (!shouldShow) { row._tmThinkingCard?.remove(); delete row._tmThinkingCard; return; }
  let card = row._tmThinkingCard;
  if (!card) {
    card = document.createElement("section"); card.className = "thinking-card";
    const toggle = document.createElement("button"); toggle.type = "button"; toggle.className = "thinking-card-toggle";
    const icon = document.createElement("span"); icon.className = "thinking-card-icon"; icon.setAttribute("aria-hidden", "true"); icon.textContent = "✦";
    const textWrap = document.createElement("span"); textWrap.className = "thinking-card-text-wrap";
    const title = document.createElement("span"); title.className = "thinking-card-title";
    const preview = document.createElement("span"); preview.className = "thinking-card-preview";
    const timer = document.createElement("span"); timer.className = "thinking-card-timer"; timer.setAttribute("aria-label", "生成耗时");
    const chevron = document.createElement("span"); chevron.className = "thinking-card-chevron"; chevron.setAttribute("aria-hidden", "true"); chevron.textContent = "⌄";
    textWrap.append(title, preview); toggle.append(icon, textWrap, timer, chevron);
    const detail = document.createElement("div"); detail.className = "thinking-card-detail"; detail.hidden = true;
    const detailBody = document.createElement("div"); detailBody.className = "thinking-card-markdown thinking-card-live-text";
    detail.append(detailBody);
    toggle.onclick = () => { card.dataset.expanded = card.dataset.expanded === "true" ? "false" : "true"; renderThinkingCard(row, card._tmMessage || message); };
    card.append(toggle, detail); row.prepend(card); row._tmThinkingCard = card;
  }
  const hasThought = !!String(message.thinking || "").trim();
  const state = message.error ? "error" : (message.thinkingState || (message.streaming ? "thinking" : "unavailable"));
  const title = state === "thinking" && !message.content ? "正在思考" : state === "error" ? "思考中断" : "已思考";
  const toggle = card.querySelector(".thinking-card-toggle"); const label = card.querySelector(".thinking-card-title"); const detail = card.querySelector(".thinking-card-detail");
  const expanded = hasThought && card.dataset.expanded === "true";
  card._tmMessage = message; card.dataset.state = state; card.classList.toggle("is-expanded", expanded); label.textContent = title;
  syncThinkingTimer(row, card, message);
  toggle.disabled = !hasThought; toggle.classList.toggle("is-static", !hasThought); toggle.querySelector(".thinking-card-chevron").hidden = !hasThought;
  toggle.setAttribute("aria-expanded", String(expanded)); toggle.setAttribute("aria-label", hasThought ? `${title}，${expanded ? "收起" : "展开"}模型思考` : title);
  const preview = card.querySelector(".thinking-card-preview");
  const previewLines = state === "thinking" && hasThought ? thinkingPreviewLines(message.thinking) : [];
  // Keep preview nodes stable while the stream grows. Replacing all three
  // nodes per token replays their CSS entrance transition and looks like a
  // flash when the card is collapsed.
  const existingPreview = [...preview.children];
  for (let index = 0; index < previewLines.length; index += 1) {
    const item = existingPreview[index] || document.createElement("span");
    if (item.textContent !== previewLines[index]) item.textContent = previewLines[index];
    if (!item.parentNode) preview.append(item);
  }
  for (let index = previewLines.length; index < existingPreview.length; index += 1) existingPreview[index].remove();
  preview.hidden = previewLines.length === 0;
  const thoughtText = displayThinkingText(message.thinking);
  const detailBody = detail.querySelector(".thinking-card-markdown");
  if (hasThought && detailBody) {
    if (state === "thinking") {
      // Do not replace the expanded card on every SSE delta. Updating this
      // single text node retains layout, scroll position and the glass layer.
      if (detailBody.dataset.mode !== "live") { detailBody.replaceChildren(); detailBody.dataset.mode = "live"; }
      if (detailBody.textContent !== thoughtText) detailBody.textContent = thoughtText;
    } else if (detailBody.dataset.mode !== "final" || detailBody.dataset.source !== thoughtText) {
      detailBody.replaceChildren(renderThinkingMarkdown(thoughtText));
      detailBody.dataset.mode = "final"; detailBody.dataset.source = thoughtText;
    }
  }
  detail.hidden = !expanded;
}
function renderMessageNode(row, message) {
  const signature = JSON.stringify({ content: message.content || "", thinking: message.thinking || "", thinkingState: message.thinkingState || "", streaming: !!message.streaming, error: !!message.error, attachments: message.attachments || [], richCards: message.richCards || [], a2ui: message.a2uiSurfaces || [], annotations: message.learningAnnotations || [] });
  if (row.dataset.signature === signature) return;
  // Saving an edit deliberately removes any derived visual cards. Rebuild
  // this one settled row once so stale cards and its old action toolbar cannot
  // remain attached below the newly edited response.
  if (message.editedAt && row.dataset.messageEditedAt !== String(message.editedAt)) { clearMessageNode(row); row.replaceChildren(); }
  // UniStudy's streaming renderer never replaces a message row per token: it
  // keeps the bubble and only morphs its unfinished tail.  Apart from looking
  // smoother, that preserves visual cards, focus and future interactive state.
  const vocabularyMode = session.conversation?.branchType === "vocabulary";
  if (message.role === "assistant" && row._tmVisualText && window.TsukuMateRichContent?.renderVisualMessage && !vocabularyMode) {
    row.dataset.signature = signature;
    // Do not reassign className on every delta: Chromium may restart the
    // descendant glass entry animation when its selector is recalculated.
    row.classList.add("message", "assistant");
    row.classList.toggle("streaming", !!message.streaming);
    row.classList.toggle("error", !!message.error);
    renderThinkingCard(row, message);
    row._tmVisualText.hidden = !message.content;
    if (message.content) { window.TsukuMateRichContent.renderVisualMessage(row._tmVisualText, message.content, { streaming: !!message.streaming, messageId: message.id }); queueMicrotask(() => applyLearningAnnotations(row._tmVisualText, message)); }
    // Crucially, finalising a stream must not rebuild the message row.  The
    // previous code did so, replaying the glass animation and recalculating a
    // different theme from the completed text — seen as a whole-bubble flash.
    if (!message.streaming) appendCompletedAssistantBlocks(row, message);
    return;
  }
  clearMessageNode(row); row.replaceChildren(); row.dataset.signature = signature; row.dataset.messageEditedAt = message.editedAt || ""; row.className = `message ${message.role}${message.streaming ? " streaming" : ""}${message.error ? " error" : ""}${vocabularyMode && message.role === "assistant" ? " vocabulary-plain" : ""}`; row.dataset.messageId = message.id || "";
  if (message.role === "user") row.dataset.messageIndex = String([...$("messages").querySelectorAll(".message.user")].length + 1);
  const text = document.createElement("div"); text.className = "message-text";
  text.dataset.bubbleTheme = message.role === "assistant" ? bubbleTheme(message) : "user";
  text.hidden = message.role === "assistant" && !message.content;
  if (message.role === "assistant" && window.TsukuMateRichContent?.renderVisualMessage && !vocabularyMode) {
    row._tmVisualText = text;
    row._tmCleanups.push(() => window.TsukuMateRichContent.cleanupVisualMessage?.(text));
    if (message.content) { window.TsukuMateRichContent.renderVisualMessage(text, message.content, { streaming: !!message.streaming, messageId: message.id }); queueMicrotask(() => applyLearningAnnotations(text, message)); }
  } else {
    const preparedContent = message.content || "";
    const parts = splitStreamingContent(preparedContent, !!message.streaming); const stable = document.createElement("div"); stable.className = "visual-bubble-stable"; stable.append(renderSafeMarkdown(parts.stable)); const tail = document.createElement("div"); tail.className = "visual-bubble-tail"; tail.append(renderSafeMarkdown(parts.tail)); text.append(stable, tail);
  }
  row.append(text); if (vocabularyMode || message.role !== "assistant") applyLearningAnnotations(text, message); renderThinkingCard(row, message);
  if (Array.isArray(message.attachments) && message.attachments.length) { const list = document.createElement("div"); list.className = "message-attachments"; for (const attachment of message.attachments) list.append(renderAttachment(attachment)); row.append(list); }
  if (message.role === "user") appendUserMessageActions(row, message);
  if (message.role === "assistant" && !message.streaming) appendCompletedAssistantBlocks(row, message);
}
function renderMessages() {
  const follow = nearBottom();
  const root = $("messages");
  if (!session.messages.length) {
    for (const row of messageNodeCache.values()) clearMessageNode(row); messageNodeCache.clear(); root.replaceChildren();
    const empty = document.createElement("div"); empty.className = "chat-empty";
    empty.innerHTML = "<strong>从一个问题开始</strong><span>上传讲义、PDF、文档或图片，也可以要求 TsukuMate 用学习卡片整理。</span>";
    root.append(empty); requestAnimationFrame(updateConversationNavigator); return;
  }
  // Never append an already-mounted row on every streamed token.  Doing so
  // briefly detaches/reinserts the user row and then the assistant row, which
  // repaints both glass bubbles as a visible flash.  Keep nodes in place and
  // only insert when their actual order changes.
  root.querySelector(".chat-empty")?.remove();
  let previous = null;
  const placeInOrder = (node) => {
    const expectedPrevious = previous;
    if (node.parentNode !== root) {
      root.insertBefore(node, expectedPrevious ? expectedPrevious.nextSibling : root.firstChild);
    } else if (node.previousSibling !== expectedPrevious) {
      root.insertBefore(node, expectedPrevious ? expectedPrevious.nextSibling : root.firstChild);
    }
    previous = node;
  };
  const live = new Set();
  for (const message of session.messages) {
    if (message.role === "context-boundary") {
      const key = message.id || `boundary-${live.size}`; live.add(key); let boundary = messageNodeCache.get(key); if (!boundary) { boundary = document.createElement("div"); boundary.className = "context-boundary"; boundary.textContent = "已清除此处之前的对话上下文"; messageNodeCache.set(key, boundary); } placeInOrder(boundary); continue;
    }
    const key = message.id || `${message.role}-${live.size}`; live.add(key); let row = messageNodeCache.get(key); if (!row) { row = document.createElement("article"); messageNodeCache.set(key, row); } renderMessageNode(row, message);
    placeInOrder(row);
  }
  for (const [key, row] of messageNodeCache) if (!live.has(key)) { clearMessageNode(row); row.remove(); messageNodeCache.delete(key); }
  requestAnimationFrame(() => { if (follow) scrollToLatest(); else updateJumpBottom(); updateConversationNavigator(); });
}
function renderSession(value) {
  session = value || session;
  const conversation = session.conversation || {};
  $("page-title").textContent = conversation.title || "新对话";
  $("title-edit").hidden = !!conversation.legacy || viewState.content === "diary";
  $("send-status").textContent = session.generating ? "正在回复…" : "准备就绪";
  $("cancel").hidden = !session.generating;
  for (const id of ["send", "attachment-button", "a2ui-model-button", "new-conversation", "clear-context"]) $(id).disabled = !!session.generating;
  $("web-search").disabled = !!session.generating || !webSearchAvailable;
  syncConversationSelection();
  renderMessages();
}
// Remote providers can emit many tiny deltas in the same paint interval.
// Rendering every one causes backdrop-filter surfaces to repaint visibly,
// which looked like the answer bubble was flashing.  Keep the newest snapshot
// and paint at a calm, UniStudy-like cadence instead.
function scheduleSessionRender(value) {
  pendingSessionSnapshot = value || pendingSessionSnapshot;
  if (pendingSessionTimer) return;
  pendingSessionTimer = setTimeout(() => {
    pendingSessionTimer = null;
    const snapshot = pendingSessionSnapshot;
    pendingSessionSnapshot = null;
    requestAnimationFrame(() => renderSession(snapshot));
  }, 48);
}
function syncConversationSelection() {
  const activeId = session.conversation?.id || "";
  document.querySelectorAll(".date-item[data-conversation-id]").forEach((node) => {
    node.classList.toggle("active", node.dataset.conversationId === activeId);
    node.setAttribute("aria-current", node.dataset.conversationId === activeId ? "true" : "false");
  });
}
function renderPendingAttachments() {
  const root = $("attachment-list"); root.replaceChildren(); root.hidden = !pendingAttachments.length;
  for (const attachment of pendingAttachments) root.append(renderAttachment(attachment, true));
}
async function discardPendingAttachments() {
  const current = pendingAttachments; pendingAttachments = []; renderPendingAttachments();
  await Promise.all(current.map((item) => api.discardAttachment(item.id).catch(() => {})));
}
function renderView() {
  const diary = viewState.content === "diary";
  const learning = viewState.content === "notes" || viewState.content === "practice";
  const codingQa = viewState.content === "coding-qa";
  const editingDiary = diary && !!selectedDiary;
  $("diary-view").hidden = !diary; $("notes-view").hidden = viewState.content !== "notes"; $("practice-view").hidden = viewState.content !== "practice"; $("coding-qa-view").hidden = !codingQa;
  $("chat-reading-area").hidden = diary || learning || codingQa; $("composer").hidden = diary || learning || codingQa; $("jump-bottom").hidden = diary || learning || codingQa || nearBottom(); $("conversation-navigator").hidden = diary || learning || codingQa;
  $("diary-empty-state").hidden = editingDiary; $("diary-editor").hidden = !editingDiary; $("diary-view").querySelector("footer").hidden = !editingDiary;
  $("back-button").hidden = !(diary || learning || codingQa); $("back-button").textContent = "‹ 返回对话"; $("drawer").setAttribute("aria-hidden", String(!viewState.drawer));
  document.querySelector(".workspace").classList.toggle("drawer-open", !!viewState.drawer);
  document.querySelectorAll(".tool").forEach((node) => node.classList.remove("active"));
  $(viewState.content === "diary" ? "diary-tool" : viewState.content === "notes" ? "notes-tool" : viewState.content === "practice" ? "practice-tool" : codingQa ? "coding-qa-tool" : "chat-tool").classList.add("active");
  document.querySelector(".header-actions").hidden = diary || learning || codingQa; $("coding-qa-top-actions").hidden = !codingQa;
  const learningTitle = viewState.content === "notes" ? (learningTab === "resources" ? "学习资源" : "我的笔记") : viewState.content === "practice" ? "学习练习" : "";
  if (learningTitle) { $("page-title").textContent = learningTitle; $("title-edit").hidden = true; }
  if (codingQa) { $("page-title").textContent = "编程答疑"; $("title-edit").hidden = true; }
  if (!diary && !learning && !codingQa && session.conversation) { $("page-title").textContent = session.conversation.title || "新对话"; $("title-edit").hidden = !!session.conversation.legacy; }
  $("page-subtitle").textContent = viewState.content === "notes" ? (learningTab === "resources" ? "上传、转写并检索你的学习资料" : "从 AI 回复保存、整理并用于生成练习") : viewState.content === "practice" ? "从选中的笔记与学习资源生成练习" : codingQa ? "题目与答疑记录会保存在本地" : "对话和学习附件会保存在本地";
  if (!diary) requestAnimationFrame(updateConversationNavigator);
}
function renderCodingQaMessageNode(row, message) {
  const signature = JSON.stringify({ content: message.content || "", thinking: message.thinking || "", thinkingState: message.thinkingState || "", streaming: !!message.streaming, error: !!message.error });
  if (row.dataset.signature === signature) return;
  row.dataset.signature = signature; row.className = `message ${message.role}${message.streaming ? " streaming" : ""}${message.error ? " error" : ""}`; row.dataset.messageId = message.id || "";
  renderThinkingCard(row, message);
  let body = row._tmCodingBody;
  // Use the same bubble container as the main conversation so its content
  // and the thinking card share one horizontal alignment contract.
  if (!body) { body = document.createElement("div"); body.className = "message-text coding-qa-message-body"; row._tmCodingBody = body; row.append(body); }
  body.dataset.bubbleTheme = message.role === "assistant" ? bubbleTheme(message) : "user";
  body.hidden = message.role === "assistant" && !message.content;
  if (message.content) body.replaceChildren(renderSafeMarkdown(message.content)); else body.replaceChildren();
}
function renderCodingQa() {
  const problem = activeCodingQa;
  $("coding-qa-empty").hidden = !!problem; $("coding-qa-layout").hidden = !problem;
  const list = $("coding-qa-list"); list.replaceChildren();
  for (const item of codingQaProblems) {
    const row = document.createElement("article"); row.className = `coding-qa-list-item${item.id === problem?.id ? " active" : ""}`;
    const open = document.createElement("button"); open.className = "coding-qa-list-open"; open.type = "button"; open.disabled = codingQaGenerating;
    const title = document.createElement("strong"); title.textContent = item.title; const date = document.createElement("small"); date.textContent = new Date(item.updatedAt).toLocaleDateString(); open.append(title, date); open.onclick = () => openCodingQa(item.id);
    const remove = document.createElement("button"); remove.className = "coding-qa-list-delete"; remove.type = "button"; remove.disabled = codingQaGenerating; remove.title = `删除“${item.title}”`; remove.setAttribute("aria-label", remove.title); remove.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M9 7l1-3h4l1 3m-9 0 1 13h10l1-13"/></svg>';
    remove.onclick = async () => { if (!confirm(`删除题目“${item.title}”及其全部答疑、代码和附件？`)) return; const result = await api.deleteCodingQa(item.id); if (!result?.ok) { alert(result?.error || "删除题目失败"); return; } if (activeCodingQa?.id === item.id) activeCodingQa = null; await loadCodingQa(); };
    row.append(open, remove); list.append(row);
  }
  if (!problem) { renderCodingOjResults(); return; }
  $("coding-qa-title").textContent = problem.title || "未命名编程题"; $("coding-qa-title-input").value = problem.title || "";
  $("coding-qa-title").hidden = codingQaEditing; $("coding-qa-title-input").hidden = !codingQaEditing;
  $("coding-qa-preview").hidden = codingQaEditing; $("coding-qa-markdown").hidden = !codingQaEditing; $("coding-qa-markdown").value = problem.markdown || "";
  $("coding-qa-save").hidden = !codingQaEditing; $("coding-qa-edit").title = codingQaEditing ? "取消编辑" : "编辑题目"; $("coding-qa-edit").setAttribute("aria-label", $("coding-qa-edit").title);
  const previewMarkdown = (problem.markdown || "_尚未填写题目。点击“编辑”输入 Markdown，或上传题目图片。_").replace(/\n##\s*样例\s*1[\s\S]*$/m, "");
  $("coding-qa-preview").replaceChildren(renderSafeMarkdown(previewMarkdown));
  $("coding-qa-status").textContent = codingQaGenerating ? "正在答疑，题目已锁定" : "";
  $("coding-qa-image").disabled = codingQaGenerating; $("coding-qa-recognize").disabled = codingQaGenerating || !problem.image; $("coding-qa-delete").disabled = codingQaGenerating; $("coding-qa-new").disabled = codingQaGenerating;
  $("coding-qa-image-preview").hidden = !problem.image;
  if (problem.image) api.readCodingQaImage(problem.id).then((result) => { if (activeCodingQa?.id === problem.id && result?.ok) $("coding-qa-image-thumb").src = result.image.dataUrl; });
  const runner = problem.runner || { language: "cpp", code: { cpp: "", python: "" }, tests: [], lastRun: null };
  codingRunnerLanguage = ["cpp", "python"].includes(codingRunnerLanguage) ? codingRunnerLanguage : runner.language;
  $("coding-qa-chat-panel").hidden = codingQaPanel !== "chat"; $("coding-run-panel").hidden = codingQaPanel !== "run";
  $("coding-qa-chat-tab").classList.toggle("active", codingQaPanel === "chat"); $("coding-qa-run-tab").classList.toggle("active", codingQaPanel === "run");
  document.querySelectorAll(".coding-language-tabs button").forEach((button) => button.classList.toggle("active", button.dataset.language === codingRunnerLanguage));
  const code = $("coding-run-code"); const editorKey = codingEditorDraftKey(problem.id, codingRunnerLanguage); if (document.activeElement !== $("coding-editor-input")) setCodingEditorValue(codingEditorDrafts.has(editorKey) ? codingEditorDrafts.get(editorKey) : (runner.code?.[codingRunnerLanguage] || ""));
  $("coding-run-all").disabled = codingRunnerRunning; $("coding-run-cancel").hidden = !codingRunnerRunning;
  $("coding-run-all").textContent = "运行";
  $("coding-run-status").textContent = codingRunnerRunning ? "正在运行…" : (codingRunnerStatus || "可输入自定义数据并查看输出");
  renderCodingSamples((runner.tests || []).filter((item) => item.source === "sample")); renderCodingRunResult(runner.lastRun);
  const messages = $("coding-qa-messages"); const live = new Set(); let previous = null;
  for (const message of problem.messages || []) {
    const key = message.id || `${message.role}-${live.size}`; live.add(key);
    let row = codingQaMessageNodeCache.get(key); if (!row) { row = document.createElement("article"); codingQaMessageNodeCache.set(key, row); }
    renderCodingQaMessageNode(row, message);
    if (row.parentNode !== messages) messages.insertBefore(row, previous ? previous.nextSibling : messages.firstChild);
    else if (row.previousSibling !== previous) messages.insertBefore(row, previous ? previous.nextSibling : messages.firstChild);
    previous = row;
  }
  for (const [key, row] of codingQaMessageNodeCache) if (!live.has(key)) { row.remove(); codingQaMessageNodeCache.delete(key); }
  messages.scrollTop = messages.scrollHeight;
  $("coding-qa-cancel").hidden = !codingQaGenerating; $("coding-qa-send").disabled = codingQaGenerating; $("coding-qa-prompt").disabled = codingQaGenerating;
}
function renderCodingOjResults() {
  const root = $("coding-oj-results"); root.replaceChildren(); const items = codingOjResults.length ? codingOjResults : codingQaProblems.slice(0, 8).map((item) => ({ ...item, source: "本地题库", local: true, summary: `最近更新：${new Date(item.updatedAt).toLocaleString()}` }));
  for (const item of items) { const card = document.createElement("article"); card.className = "coding-oj-card"; const head = document.createElement("div"); const title = document.createElement("strong"); title.textContent = item.title; const source = document.createElement("span"); source.textContent = item.source; head.append(title, source); const details = document.createElement("p"); details.textContent = [item.label, item.difficulty, ...(item.tags || [])].filter(Boolean).join(" · ") || item.summary || "公开题面"; const actions = document.createElement("div"); const open = document.createElement("button"); open.className = "primary"; open.textContent = item.local ? "继续练习" : "导入并练习"; open.onclick = async () => { open.disabled = true; if (item.local) { await openCodingQa(item.id); return; } const result = await api.importCodingOj(item.url); if (!result?.ok) { $("coding-oj-status").textContent = result?.error || "导入题目失败"; open.disabled = false; return; } activeCodingQa = result.problem; codingQaPanel = "chat"; await loadCodingQa(activeCodingQa.id); }; actions.append(open); card.append(head, details, actions); root.append(card); }
  if (!codingOjResults.length && $("coding-oj-status").textContent) root.textContent = "";
}
function renderCodingSamples(tests) { const root = $("coding-samples"); root.replaceChildren(); root.hidden = codingQaEditing || !tests.length; tests.forEach((test, index) => { const card = document.createElement("article"); card.className = "coding-sample-card"; const head = document.createElement("header"); const title = document.createElement("strong"); title.textContent = `样例 ${index + 1}`; const actions = document.createElement("div"); const run = document.createElement("button"); run.textContent = "运行"; run.disabled = codingRunnerRunning; run.onclick = () => runCodingSample(test.id); const copy = document.createElement("button"); copy.textContent = "复制"; copy.onclick = async () => { try { await navigator.clipboard.writeText(test.input || ""); copy.textContent = "已复制"; setTimeout(() => { copy.textContent = "复制"; }, 1100); } catch { copy.textContent = "复制失败"; } }; actions.append(run, copy); head.append(title, actions); const grid = document.createElement("div"); grid.className = "coding-sample-io"; for (const [label, value] of [["输入", test.input], ["输出", test.output]]) { const cell = document.createElement("section"); const labelNode = document.createElement("small"); labelNode.textContent = label; const code = document.createElement("pre"); code.textContent = value || "（空）"; cell.append(labelNode, code); grid.append(cell); } card.append(head, grid); root.append(card); }); }
function renderCodingRunResult(summary) { const root = $("coding-run-result"); root.replaceChildren(); if (!summary) { root.textContent = "点击“运行”，输入自定义标准输入后查看程序输出。"; return; } const heading = document.createElement("header"); const title = document.createElement("strong"); title.textContent = "本地样例结果"; const score = document.createElement("span"); score.textContent = `本地样例：${summary.passed}/${summary.total} 通过`; heading.append(title, score); const results = Array.isArray(summary.results) ? summary.results : []; if (!results.length) { const pending = document.createElement("p"); pending.className = "coding-verdict-pending"; pending.textContent = "没有可显示的样例结果。"; root.append(heading, pending); return; } const grid = document.createElement("div"); grid.className = "coding-verdict-grid"; for (const [index, item] of results.entries()) { const card = document.createElement("button"); card.type = "button"; const verdict = String(item.status || "JUDGING").toUpperCase(); card.className = `coding-verdict ${item.passed ? "passed" : "failed"}`; card.title = `${verdict} · ${item.durationMs || 0}ms`; const ordinal = document.createElement("small"); ordinal.textContent = `#${index + 1}`; const status = document.createElement("strong"); status.textContent = verdict; const time = document.createElement("span"); time.textContent = item.durationMs ? `${item.durationMs}ms${item.memoryKb ? ` / ${item.memoryKb}KB` : ""}` : "—"; card.append(ordinal, status, time); card.onclick = () => { const detail = document.createElement("pre"); detail.className = "coding-verdict-detail"; detail.textContent = `样例 ${index + 1}\n\n预期输出:\n${item.expected || "（空）"}\n\n实际输出:\n${item.actual || "（空）"}${item.stderr ? `\n\n错误输出:\n${item.stderr}` : ""}`; const old = root.querySelector(".coding-verdict-detail"); old?.remove(); root.append(detail); }; grid.append(card); } root.append(heading, grid); }
function openCodingRunModal() { if (!activeCodingQa || $("coding-run-modal")) return; const modal = document.createElement("div"); modal.id = "coding-run-modal"; modal.className = "coding-run-modal"; modal.innerHTML = '<section class="coding-run-dialog" role="dialog" aria-modal="true" aria-label="运行代码"><header><div><strong>运行代码</strong><small>自定义标准输入，查看当前代码的输出</small></div><button type="button" aria-label="关闭">×</button></header><div class="coding-run-io"><label>输入<textarea id="coding-run-input" spellcheck="false" placeholder="在这里输入标准输入"></textarea></label><label>输出<pre id="coding-run-output">点击右上角“运行”执行当前代码</pre></label></div><footer><span id="coding-run-modal-status"></span><button type="button" class="primary" id="coding-run-modal-submit">运行</button></footer></section>'; document.body.append(modal); const close = () => modal.remove(); modal.addEventListener("click", (event) => { if (event.target === modal) close(); }); modal.querySelector("header button").onclick = close; const input = $("coding-run-input"); const output = $("coding-run-output"); const status = $("coding-run-modal-status"); modal.querySelector("#coding-run-modal-submit").onclick = async (event) => { const button = event.currentTarget; button.disabled = true; status.textContent = "正在运行…"; output.textContent = ""; const saved = await saveCodingRunner(); const result = saved?.ok ? await api.runCodingInput({ id: activeCodingQa.id, language: codingRunnerLanguage, code: $("coding-run-code").value, input: input.value }) : saved; button.disabled = false; if (!result?.ok) { status.textContent = result?.error || "运行失败"; return; } const run = result.run || {}; status.textContent = `${run.status || "完成"}${run.durationMs ? ` · ${run.durationMs}ms` : ""}`; output.textContent = run.stdout || run.stderr || "（无输出）"; if (run.stderr && run.stdout) output.textContent += `\n\n错误输出:\n${run.stderr}`; }; input.focus(); }
function codingRunnerDraft() {
  if (!activeCodingQa) return null;
  const previous = activeCodingQa.runner || { code: { cpp: "", python: "" }, tests: [] };
  return { id: activeCodingQa.id, language: codingRunnerLanguage, code: { ...previous.code, [codingRunnerLanguage]: currentCodingEditorValue() }, tests: previous.tests };
}
function currentCodingEditorValue() {
  const editor = $("coding-run-code"); const input = $("coding-editor-input");
  // The visible editor is contenteditable.  Read it directly for actions
  // invoked during a keystroke/blur transition instead of trusting the hidden
  // textarea or an older asynchronous save result.
  const value = input ? input.textContent.replace(/\n$/, "") : String(editor?.value || "");
  if (editor && editor.value !== value) editor.value = value;
  const key = codingEditorDraftKey(); if (key) codingEditorDrafts.set(key, value);
  return value;
}
function queueCodingRunnerSave(draft) {
  if (!draft) return Promise.resolve(null);
  // Serialising snapshots means a slow earlier IPC write cannot overwrite a
  // newer keystroke after the user has continued typing.
  codingRunnerSaveChain = codingRunnerSaveChain.catch(() => null).then(async () => {
    const result = await api.saveCodingRunner(draft);
    if (result?.ok && activeCodingQa?.id === draft.id) activeCodingQa = result.problem;
    return result;
  });
  return codingRunnerSaveChain;
}
function scheduleCodingRunnerSave() {
  const draft = codingRunnerDraft();
  if (!draft) return;
  clearTimeout(codingRunnerSaveTimer);
  codingRunnerSaveTimer = setTimeout(() => { codingRunnerSaveTimer = null; void queueCodingRunnerSave(draft); }, 550);
}
function flushCodingRunnerSave() {
  clearTimeout(codingRunnerSaveTimer); codingRunnerSaveTimer = null;
  return queueCodingRunnerSave(codingRunnerDraft());
}
async function saveCodingRunner() { return flushCodingRunnerSave(); }
async function runCodingSample(testId) { if (!activeCodingQa || codingRunnerRunning) return; const saved = await saveCodingRunner(); if (!saved?.ok) return; codingRunnerRunning = true; renderCodingQa(); const result = await api.runCodingTests({ id: activeCodingQa.id, language: codingRunnerLanguage, code: $("coding-run-code").value, testIds: [testId] }); codingRunnerRunning = false; if (result?.ok) { activeCodingQa = result.problem; codingQaPanel = "run"; renderCodingQa(); } else { $("coding-run-status").textContent = result?.error || "运行失败"; renderCodingQa(); } }
async function loadCodingQa(preferredId) {
  const result = await api.listCodingQa(); codingQaProblems = result?.problems || [];
  if (preferredId === "__home__") { activeCodingQa = null; renderCodingQa(); return; }
  const id = preferredId || activeCodingQa?.id || codingQaProblems[0]?.id;
  if (id) await openCodingQa(id, true); else { activeCodingQa = null; renderCodingQa(); }
}
async function openCodingQa(id, skipList = false) {
  if (codingQaGenerating) return;
  const result = await api.getCodingQa(id); if (!result?.ok || !result.problem) return;
  activeCodingQa = result.problem; codingRunnerLanguage = activeCodingQa.runner?.language || "cpp"; codingQaEditing = false; if (!skipList) { const list = await api.listCodingQa(); codingQaProblems = list?.problems || []; } renderCodingQa();
}
async function createCodingQa() { if (codingQaGenerating) return; const result = await api.createCodingQa(); if (!result?.ok) return alert(result?.error || "新建题目失败"); activeCodingQa = result.problem; codingQaEditing = true; await loadCodingQa(activeCodingQa.id); codingQaEditing = true; renderCodingQa(); }
async function saveCodingQa() { if (!activeCodingQa) return; const result = await api.saveCodingQa({ id: activeCodingQa.id, title: $("coding-qa-title-input").value, markdown: $("coding-qa-markdown").value }); if (!result?.ok) return alert(result?.error || "保存题目失败"); activeCodingQa = result.problem; codingQaEditing = false; await loadCodingQa(activeCodingQa.id); }
async function selectCodingQaImage() { if (!activeCodingQa) { await createCodingQa(); if (!activeCodingQa) return; } const result = await api.selectCodingQaImage(activeCodingQa.id); if (!result?.ok || result.canceled) { if (!result?.canceled) $("coding-qa-status").textContent = result?.error || "图片上传失败"; return; } activeCodingQa = result.problem; renderCodingQa(); $("coding-qa-status").textContent = "图片已保存，正在识别并整理…"; const recognized = await api.recognizeCodingQa(activeCodingQa.id); if (recognized?.ok) { activeCodingQa = recognized.problem; await loadCodingQa(activeCodingQa.id); } else $("coding-qa-status").textContent = recognized?.error || "识别失败，可重试"; }
async function sendCodingQa() {
  if (!activeCodingQa || codingQaGenerating) return;
  const text = $("coding-qa-prompt").value.trim(); if (!text) return;
  const problemId = activeCodingQa.id;
  const messages = activeCodingQa.messages || (activeCodingQa.messages = []);
  // The main process emits its initial thinking delta before the IPC request
  // resolves. Insert the user row first so that delta can only land below it.
  const localUser = { id: `user-local-${Date.now()}`, role: "user", content: text, timestamp: new Date().toISOString() };
  messages.push(localUser); $("coding-qa-prompt").value = ""; codingQaGenerating = true; renderCodingQa();
  let result;
  try { result = await api.sendCodingQa(problemId, text); } catch { result = { ok: false, error: "发送失败" }; }
  if (!result?.ok) {
    const index = messages.findIndex((item) => item.id === localUser.id);
    if (index >= 0) messages.splice(index, 1);
    codingQaGenerating = false; $("coding-qa-send-status").textContent = result?.error || "发送失败"; renderCodingQa(); return;
  }
  const assistant = result.assistant || { id: `assistant-local-${Date.now()}`, role: "assistant", content: "", thinking: "", thinkingState: "thinking", streaming: true, timestamp: new Date().toISOString() };
  if (!messages.some((item) => item.id === assistant.id)) messages.push(assistant);
  renderCodingQa();
}
function openCodingQaView() { viewState = { content: "coding-qa", drawer: null }; activeCodingQa = null; codingOjResults = []; $("coding-oj-status").textContent = "输入关键词、题号或公开题目链接开始搜索。"; renderView(); void loadCodingQa("__home__"); }
async function confirmDiaryDiscard() { return viewState.content !== "diary" || $("diary-editor").value === diaryOriginal || confirm("日记有未保存修改，确定放弃吗？"); }
async function returnToChat() { if (!(await confirmDiaryDiscard())) return; viewState = { content: "chat", drawer: null }; renderView(); $("prompt").focus(); }
function empty(node, text) { node.replaceChildren(); const item = document.createElement("div"); item.className = "learning-empty"; item.textContent = text; node.append(item); }
function noteListItem(note) { const button = document.createElement("button"); button.className = `learning-list-item${note.id === selectedNoteId ? " active" : ""}`; const title = document.createElement("strong"); title.textContent = note.title || "未命名笔记"; const date = document.createElement("small"); date.textContent = new Date(note.updatedAt).toLocaleString(); button.append(title, date); button.onclick = () => { selectedNoteId = note.id; renderNotes(); }; return button; }
function renderNotes() {
  const list = $("notes-list"); list.replaceChildren();
  $("notes-primary-action").textContent = learningTab === "resources" ? "＋ 添加资源" : "＋ 新建笔记";
  if (learningTab === "notes") for (const note of learningNotes) list.append(noteListItem(note));
  const note = learningNotes.find((item) => item.id === selectedNoteId);
  $("notes-tab").classList.toggle("active", learningTab === "notes"); $("resources-tab").classList.toggle("active", learningTab === "resources");
  $("notes-heading").textContent = learningTab === "resources" ? "学习资源" : "我的笔记"; $("notes-subheading").textContent = learningTab === "resources" ? "上传、转写并检索你的学习资料" : "从 AI 回复保存、整理并用于生成练习";
  $("note-empty").hidden = learningTab !== "notes" || !!note; $("note-editor").hidden = learningTab !== "notes" || !note; $("resource-panel").hidden = learningTab !== "resources";
  if (note) { $("note-title").value = note.title || ""; $("note-content").value = note.content || ""; $("note-status").textContent = ""; $("note-source").hidden = !note.sourceMessageId; }
  renderResources();
}
function renderResources() { const root = $("resources-list"); root.replaceChildren(); if (!learningResources.length) { empty(root, "还没有学习资源。可上传讲义、PDF、文档或图片。"); return; } for (const resource of learningResources) { const row = document.createElement("article"); row.className = "resource-item"; const title = document.createElement("strong"); title.textContent = resource.name; const detail = document.createElement("small"); detail.textContent = `${resource.status === "ready" ? "已建立检索文本" : resource.status === "processing" ? "处理中…" : `处理失败：${resource.error || "可重试"}`} · ${Math.ceil((resource.size || 0) / 1024)} KB`; const preview = document.createElement("p"); preview.textContent = resource.preview || "暂无可预览内容"; const remove = document.createElement("button"); remove.textContent = "删除"; remove.onclick = async () => { if (confirm(`删除学习资源“${resource.name}”？已完成练习会保留。`)) { await api.deleteLearningResource(resource.id); await loadLearningNotes(); } }; row.append(title, detail, preview); if (resource.status === "failed") { const retry = document.createElement("button"); retry.textContent = "重试转写"; retry.onclick = async () => { retry.disabled = true; const result = await api.retryLearningResource(resource.id); if (!result?.ok) alert(result?.error || "重试失败"); await loadLearningNotes(); }; row.append(retry); } row.append(remove); root.append(row); } }
async function loadLearningNotes() { const [notesResult, resourcesResult] = await Promise.all([api.listLearningNotes(), api.listLearningResources()]); learningNotes = notesResult?.notes || []; learningResources = resourcesResult?.resources || []; if (selectedNoteId && !learningNotes.some((item) => item.id === selectedNoteId)) selectedNoteId = null; renderNotes(); }
function practiceLabel(kind) { return ({ choice: "选择题", flashcards: "闪卡", fill: "填空题", short: "简答题", review: "复习题" })[kind] || "学习练习"; }
function practiceCard(practice) { const card = document.createElement("article"); card.className = "practice-library-card"; const head = document.createElement("div"); head.className = "practice-card-head"; const title = document.createElement("h3"); title.textContent = practice.title; const tag = document.createElement("span"); tag.textContent = practiceLabel(practice.kind); head.append(title, tag); const meta = document.createElement("p"); meta.textContent = `${practice.subject || "通用"} · ${practice.completed || 0}/${practice.total || 0} 已完成 · ${new Date(practice.updatedAt).toLocaleDateString()}`; const actions = document.createElement("div"); actions.className = "practice-card-actions"; const open = document.createElement("button"); open.className = "primary"; open.textContent = "开始练习"; open.onclick = async () => { const result = await api.getPractice(practice.id); if (result?.practice) openPracticeAnswer(result.practice); }; const remove = document.createElement("button"); remove.className = "danger-button"; remove.textContent = "删除"; remove.onclick = async () => { if (!confirm(`删除练习“${practice.title}”？此操作会删除作答与错题解析。`)) return; const result = await api.deletePractice(practice.id); if (!result?.ok) return alert("删除练习失败"); await loadPractices(); }; actions.append(open, remove); card.append(head, meta, actions); return card; }
async function loadPractices() { const result = await api.listPractices(); const root = $("practice-library"); root.replaceChildren(); const practices = result?.practices || []; if (!practices.length) { empty(root, "尚未生成练习，点击右上角开始生成。"); return; } for (const practice of practices) root.append(practiceCard(practice)); }
function draftFor(question) { if (!practiceDrafts.has(question.id)) practiceDrafts.set(question.id, { answer: question.response?.answer || "", imageDataUrl: question.response?.image || "", mastered: question.response?.answer === "__mastered__", flipped: false }); return practiceDrafts.get(question.id); }
function questionState(question) { const draft = draftFor(question); if (question.response) return question.response.correct ? "correct" : "wrong"; if (question.type === "flashcard") return draft.mastered ? "filled" : "empty"; return draft.answer || draft.imageDataUrl ? "filled" : "empty"; }
function renderQuestionList() { const root = $("practice-question-list"); root.replaceChildren(); for (const [index, question] of (activePractice?.questions || []).entries()) { const button = document.createElement("button"); button.className = `practice-question-nav ${questionState(question)}${index === activeQuestionIndex ? " active" : ""}`; const number = document.createElement("span"); number.textContent = String(index + 1); const label = document.createElement("span"); label.textContent = practiceLabel(question.type); button.append(number, label); button.onclick = () => { activeQuestionIndex = index; renderPracticeAnswer(); }; root.append(button); } }
function renderPracticeAnswer() { const root = $("practice-answer-content"); if (!activePractice) return; const question = activePractice.questions[activeQuestionIndex]; if (!question) return; const draft = draftFor(question); $("practice-answer-title").textContent = activePractice.title; renderQuestionList(); root.replaceChildren(); const card = document.createElement("article"); card.className = "practice-answer-card"; const count = document.createElement("p"); count.className = "practice-count"; count.textContent = `第 ${activeQuestionIndex + 1} 题 · ${practiceLabel(question.type)}`; const prompt = document.createElement("h3"); prompt.textContent = question.prompt; card.append(count, prompt);
  if (question.type === "flashcard") { const face = document.createElement("div"); face.className = "flashcard-face"; face.textContent = draft.flipped ? question.answer : question.prompt; const flip = document.createElement("button"); flip.textContent = draft.flipped ? "查看问题" : "翻面查看答案"; flip.onclick = () => { draft.flipped = !draft.flipped; renderPracticeAnswer(); }; const choices = document.createElement("div"); choices.className = "flashcard-actions"; for (const [text, mastered] of [["待复习", false], ["已掌握", true]]) { const button = document.createElement("button"); button.className = mastered === draft.mastered ? "primary" : ""; button.textContent = text; button.onclick = () => { draft.mastered = mastered; renderPracticeAnswer(); }; choices.append(button); } card.append(face, flip, choices); }
  else { const input = document.createElement("textarea"); input.placeholder = question.type === "short" ? "输入你的步骤或答案，也可上传图片" : "输入答案"; input.value = draft.answer; input.oninput = () => { draft.answer = input.value; renderQuestionList(); }; if (question.type === "choice" && question.options?.length) { const options = document.createElement("div"); options.className = "practice-options"; question.options.forEach((option, index) => { const button = document.createElement("button"); button.type = "button"; button.className = draft.answer === option ? "selected" : ""; button.textContent = `${String.fromCharCode(65 + index)}. ${option}`; button.onclick = () => { draft.answer = option; renderPracticeAnswer(); }; options.append(button); }); card.append(options); } card.append(input); if (question.type === "short") { const image = document.createElement("button"); image.textContent = draft.imageDataUrl ? "已选择答案图片" : "上传答案图片"; image.onclick = async () => { const result = await api.selectPracticeImage(); if (result?.imageDataUrl) { draft.imageDataUrl = result.imageDataUrl; renderPracticeAnswer(); } }; card.append(image); } }
  if (question.response) { const result = document.createElement("div"); result.className = `practice-result ${question.response.correct ? "correct" : "wrong"}`; result.textContent = question.response.correct ? `回答正确。标准答案：${question.answer}` : `回答有误。标准答案：${question.answer}${question.response.analysis ? `\n${question.response.analysis}` : ""}`; card.append(result); }
  const navigation = document.createElement("nav"); navigation.className = "practice-question-actions"; navigation.setAttribute("aria-label", "题目导航");
  const previous = document.createElement("button"); previous.type = "button"; previous.textContent = "‹ 上一题"; previous.disabled = activeQuestionIndex === 0; previous.onclick = () => { activeQuestionIndex -= 1; renderPracticeAnswer(); };
  const progress = document.createElement("span"); progress.textContent = `${activeQuestionIndex + 1} / ${activePractice.questions.length}`;
  const next = document.createElement("button"); next.type = "button"; next.textContent = "下一题 ›"; next.className = "primary"; next.disabled = activeQuestionIndex >= activePractice.questions.length - 1; next.onclick = () => { activeQuestionIndex += 1; renderPracticeAnswer(); };
  navigation.append(previous, progress, next); card.append(navigation); root.append(card); }
function openPracticeAnswer(practice) { selectedPracticeId = practice.id; activePractice = practice; activeQuestionIndex = 0; practiceDrafts = new Map(); for (const question of practice.questions || []) draftFor(question); $("practice-library").hidden = true; $("practice-answer-view").hidden = false; renderPracticeAnswer(); }
function closePracticeAnswer() { activePractice = null; practiceDrafts = new Map(); $("practice-answer-view").hidden = true; $("practice-library").hidden = false; void loadPractices(); }
async function submitPracticeBatch() { if (!activePractice) return; const button = $("practice-submit-all"); button.disabled = true; button.textContent = "正在交卷…"; const answers = activePractice.questions.map((question) => { const draft = draftFor(question); return { questionId: question.id, answer: draft.answer, imageDataUrl: draft.imageDataUrl, mastered: draft.mastered }; }); const result = await api.submitPracticeBatch({ practiceId: activePractice.id, answers }); button.disabled = false; button.textContent = "交卷"; if (!result?.ok || !result.practice) return alert(result?.error || "交卷失败"); activePractice = result.practice; practiceDrafts = new Map(); for (const question of activePractice.questions || []) draftFor(question); renderPracticeAnswer(); }
async function openLearning(kind) { if (!(await confirmDiaryDiscard())) return; viewState = { content: kind === "practice" ? "practice" : "notes", drawer: null }; if (viewState.content === "notes") await loadLearningNotes(); else { closePracticeAnswer(); await loadPractices(); } renderView(); }
async function openPracticeModal() { await loadLearningNotes(); const search = await api.getLearningSearchStatus(); $("practice-source-row").hidden = !search?.available; $("practice-source").value = "local"; $("practice-notes-picker").replaceChildren(...learningNotes.map((note) => { const label = document.createElement("label"); const box = document.createElement("input"); box.type = "checkbox"; box.value = note.id; label.append(box, document.createTextNode(` ${note.title}`)); return label; })); $("practice-resources-picker").replaceChildren(...learningResources.filter((r) => r.status === "ready").map((resource) => { const label = document.createElement("label"); const box = document.createElement("input"); box.type = "checkbox"; box.value = resource.id; label.append(box, document.createTextNode(` ${resource.name}`)); return label; })); $("practice-generate-status").textContent = ""; $("practice-modal").hidden = false; }
async function showConversationDrawer() {
  if (!(await confirmDiaryDiscard())) return; viewState = { content: "chat", drawer: "history" }; renderView();
  $("drawer-title").textContent = "对话"; const root = $("date-list"); root.innerHTML = '<div class="drawer-status">正在加载…</div>';
  const result = await api.listConversations(); root.replaceChildren(); if (!result?.ok) { root.innerHTML = '<div class="drawer-status error">读取失败</div>'; return; }
  const tabs = document.createElement("nav"); tabs.className = "conversation-drawer-tabs"; for (const [id, label] of [["tree", "对话树"], ["network", "思维网络"]]) { const button = document.createElement("button"); button.type = "button"; button.textContent = label; button.classList.toggle("active", conversationDrawerTab === id); button.onclick = () => { conversationDrawerTab = id; void showConversationDrawer(); }; tabs.append(button); } root.append(tabs);
  const body = document.createElement("div"); body.className = "conversation-drawer-body"; root.append(body); const conversations = result.conversations || [];
  const openConversation = async (item) => { await discardPendingAttachments(); const loaded = await api.loadConversation(item.id); if (!loaded?.ok) { $("send-status").textContent = loaded?.error || "切换失败"; return; } session = loaded.session || session; syncConversationSelection(); };
  const removeConversation = async (item) => { if (!confirm(`删除对话“${item.title}”及其全部子分支？其中的消息和已发送附件将被永久删除。`)) return; const deleted = await api.deleteConversation(item.id); if (!deleted?.ok) { $("send-status").textContent = deleted?.error || "删除失败"; return; } if (deleted.session) session = deleted.session; await showConversationDrawer(); };
  if (conversationDrawerTab === "tree") {
    const byParent = new Map(); for (const item of conversations) { const key = item.parentConversationId || "root"; if (!byParent.has(key)) byParent.set(key, []); byParent.get(key).push(item); } for (const items of byParent.values()) items.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    const draw = (item, depth) => { const row = document.createElement("div"); row.className = `conversation-tree-row${item.id === (session.conversation?.id || session.conversationId) ? " active" : ""}`; row.style.setProperty("--conversation-depth", String(depth)); const open = document.createElement("button"); open.type = "button"; open.className = "conversation-tree-open"; open.disabled = !!session.generating; const icon = item.branchType === "inherit" ? "↳" : item.branchType === "vocabulary" ? "⌁" : item.branchType === "related" ? "◇" : "▾"; open.innerHTML = `<span class="conversation-tree-icon">${icon}</span><span><strong></strong><small></small></span>`; open.querySelector("strong").textContent = item.title; open.querySelector("small").textContent = item.branchType === "inherit" ? "继承分支" : item.branchType === "related" ? "关联主题" : item.branchType === "vocabulary" ? "词汇学习" : (item.legacy ? "旧版记录" : new Date(item.updatedAt).toLocaleDateString()); open.onclick = () => openConversation(item); row.append(open); if (!item.legacy) { const remove = document.createElement("button"); remove.type = "button"; remove.className = "conversation-tree-delete"; remove.textContent = "×"; remove.title = `删除对话：${item.title}`; remove.disabled = !!session.generating; remove.onclick = () => removeConversation(item); row.append(remove); } body.append(row); for (const child of byParent.get(item.id) || []) draw(child, depth + 1); };
    for (const item of byParent.get("root") || []) draw(item, 0);
  } else {
    const network = await api.getConversationNetwork(); const nodes = network?.nodes || conversations.map((item) => ({ ...item, branchType: item.branchType || "root" })); const byId = new Map(nodes.map((item) => [item.id, item])); const depths = new Map(); const depth = (item) => { if (depths.has(item.id)) return depths.get(item.id); const next = item.parentConversationId && byId.has(item.parentConversationId) ? depth(byId.get(item.parentConversationId)) + 1 : 0; depths.set(item.id, next); return next; }; nodes.forEach(depth); const canvas = document.createElement("div"); canvas.className = "conversation-network-canvas"; const columns = Math.max(1, ...nodes.map((item) => depth(item) + 1)); canvas.style.minHeight = `${Math.max(260, nodes.length * 72)}px`; const positions = new Map(); nodes.forEach((item, index) => positions.set(item.id, { x: 18 + depth(item) * 120, y: 18 + index * 68 })); const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("class", "conversation-network-lines"); svg.setAttribute("width", String(columns * 130 + 60)); svg.setAttribute("height", String(Math.max(260, nodes.length * 72))); for (const edge of network?.edges || nodes.filter((item) => item.parentConversationId).map((item) => ({ from: item.parentConversationId, to: item.id }))) { const from = positions.get(edge.from); const to = positions.get(edge.to); if (!from || !to) continue; const line = document.createElementNS("http://www.w3.org/2000/svg", "path"); line.setAttribute("d", `M ${from.x + 92} ${from.y + 23} C ${from.x + 108} ${from.y + 23}, ${to.x - 16} ${to.y + 23}, ${to.x} ${to.y + 23}`); svg.append(line); } canvas.append(svg); const detail = document.createElement("article"); detail.className = "conversation-network-summary"; detail.hidden = true; body.append(canvas, detail); for (const item of nodes) { const point = positions.get(item.id); const button = document.createElement("button"); button.type = "button"; button.className = `conversation-network-node ${item.branchType || "root"}`; button.style.left = `${point.x}px`; button.style.top = `${point.y}px`; button.textContent = item.title; button.onclick = () => { detail.hidden = false; detail.replaceChildren(); const title = document.createElement("strong"); title.textContent = item.title; const summary = document.createElement("p"); summary.textContent = item.summary || "尚未生成摘要，将在下一次回复完成后更新。"; const open = document.createElement("button"); open.type = "button"; open.textContent = "打开对话"; open.onclick = () => openConversation(item); detail.append(title, summary, open); }; canvas.append(button); }
  }
}
async function showDiaryDrawer() {
  if (!(await confirmDiaryDiscard())) return; selectedDiary = null; diaryOriginal = ""; viewState = { content: "diary", drawer: "diary" }; renderView(); $("drawer-title").textContent = "日记";
  const root = $("date-list"); root.innerHTML = '<div class="drawer-status">正在加载…</div>';
  const result = await api.listDiaries(); root.replaceChildren();
  for (const date of result && result.dates || []) { const button = document.createElement("button"); button.className = "date-item"; button.textContent = date; button.onclick = () => loadDiary(date); root.append(button); }
}
async function loadDiary(date) {
  if (!(await confirmDiaryDiscard())) return; const result = await api.loadDiary(date); if (!result.ok) return;
  selectedDiary = date; diaryOriginal = result.content || ""; $("diary-editor").value = diaryOriginal; $("diary-status").textContent = "";
  viewState.content = "diary"; renderView();
}
async function send() {
  const text = $("prompt").value.trim(); if ((!text && !pendingAttachments.length) || session.generating) return;
  const ids = pendingAttachments.map((item) => item.id);
  const result = await api.send({ text, attachmentIds: ids, webSearch: webSearchEnabled });
  if (result.ok) { pendingAttachments = []; renderPendingAttachments(); $("prompt").value = ""; if (webSearchEnabled) { webSearchEnabled = false; $("web-search").classList.remove("active"); $("web-search").setAttribute("aria-pressed", "false"); } }
  else $("send-status").textContent = result.error || "发送失败";
}
async function editTitle() {
  const input = $("title-input"); input.value = session.conversation && session.conversation.title || ""; $("page-title").hidden = true; $("title-edit").hidden = true; input.hidden = false; input.focus(); input.select();
}
async function finishTitle(save) {
  const input = $("title-input"); if (input.hidden) return;
  if (save && input.value.trim()) { const result = await api.updateTitle(input.value); if (!result.ok) $("send-status").textContent = result.error || "标题保存失败"; }
  input.hidden = true; $("page-title").hidden = false; $("title-edit").hidden = !!(session.conversation && session.conversation.legacy);
}

$("send").onclick = send; $("cancel").onclick = async () => { const result = await api.cancel(); if (result?.ok) $("send-status").textContent = "已暂停本次输出，已生成内容会保留"; };
$("attachment-button").onclick = async () => { const result = await api.selectAttachments(); if (result && result.ok) { pendingAttachments.push(...(result.attachments || [])); renderPendingAttachments(); } else $("send-status").textContent = result && result.error || "附件读取失败"; };
$("a2ui-model-button").onclick = async () => { const result = await api.addA2uiModels(); $("send-status").textContent = result?.ok ? (result.models?.length ? `已添加 ${result.models.length} 个 3D 模型，可在下一次请求中让 AI 展示。` : "未添加 3D 模型") : (result?.error || "添加 3D 模型失败"); };
$("web-search").onclick = () => { if (!webSearchAvailable || session.generating) return; webSearchEnabled = !webSearchEnabled; $("web-search").classList.toggle("active", webSearchEnabled); $("web-search").setAttribute("aria-pressed", String(webSearchEnabled)); $("send-status").textContent = webSearchEnabled ? "本轮将使用网络搜索" : "准备就绪"; };
$("new-conversation").onclick = async () => { if (session.generating) return; if (($("prompt").value.trim() || pendingAttachments.length) && !confirm("放弃尚未发送的内容并新建对话吗？")) return; await discardPendingAttachments(); await api.createConversation(); viewState = { content: "chat", drawer: null }; renderView(); };
$("clear-context").onclick = async () => { if (!session.generating && confirm("保留记录，但让后续回复不再使用此处之前的对话？")) await api.clearContext(); };
$("title-edit").onclick = editTitle; $("title-input").onblur = () => finishTitle(true); $("title-input").onkeydown = (event) => { if (event.key === "Enter") { event.preventDefault(); finishTitle(true); } if (event.key === "Escape") { event.preventDefault(); finishTitle(false); } };
$("prompt").addEventListener("keydown", (event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); send(); } });
$("prompt").addEventListener("paste", async (event) => {
  if (session.generating) return;
  // Do not trust the browser MIME label here. macOS often exposes a copied
  // JPG as TIFF/JFIF; Electron's native clipboard API can normalize it.
  const items = [...(event.clipboardData?.items || [])].filter((item) => item.kind === "file" && /^image\//i.test(item.type));
  if (!items.length) return; // Preserve the browser's ordinary text paste.
  event.preventDefault();
  const result = await api.readClipboardImage();
  if (!result?.ok || !result.attachment) { $("send-status").textContent = result?.error || "无法添加剪贴板图片"; return; }
  pendingAttachments.push(result.attachment); renderPendingAttachments();
  $("send-status").textContent = "已从剪贴板添加图片";
});
$("image-viewer-close").onclick = closeImageViewer; $("image-viewer").onclick = (event) => { if (event.target === $("image-viewer")) closeImageViewer(); };
$("image-more").onclick = () => { const menu = $("image-more-menu"); menu.hidden = !menu.hidden; $("image-more").setAttribute("aria-expanded", String(!menu.hidden)); };
$("image-markup-toggle").onclick = () => { const panel = $("image-markup-panel"); panel.hidden = !panel.hidden; $("image-markup-toggle").setAttribute("aria-pressed", String(!panel.hidden)); $("image-more-menu").hidden = true; requestAnimationFrame(fitPreviewImage); };
$("attachment-context-delete").onclick = async () => { const id = contextAttachmentId; closeAttachmentContextMenu(); if (!id) return; const result = await api.discardAttachment(id); if (!result?.ok) { $("send-status").textContent = "删除附件失败"; return; } pendingAttachments = pendingAttachments.filter((item) => item.id !== id); renderPendingAttachments(); };
document.addEventListener("pointerdown", (event) => { if (!event.target.closest("#attachment-context-menu")) closeAttachmentContextMenu(); if (!event.target.closest("#image-more, #image-more-menu")) { $("image-more-menu").hidden = true; $("image-more").setAttribute("aria-expanded", "false"); } if (!event.target.closest(".message-more-wrap")) closeMessageActionMenus(); if (!event.target.closest(".learning-vocabulary-popover, .learning-vocabulary-term")) closeVocabularyPopover(); });
$("image-copy").onclick = copyPreviewImage; $("image-download").onclick = downloadPreviewImage; $("image-select").onclick = () => selectPreviewTool("select"); $("image-brush").onclick = () => selectPreviewTool("brush"); $("image-text").onclick = () => selectPreviewTool("text"); $("image-eraser").onclick = () => selectPreviewTool("eraser"); $("image-line").onclick = () => selectPreviewTool("line"); $("image-rect").onclick = () => selectPreviewTool("rect"); $("image-circle").onclick = () => selectPreviewTool("circle"); $("image-clear").onclick = clearAnnotations; $("image-panel-reset").onclick = clearAnnotations; $("image-undo").onclick = () => restoreAnnotationHistory(annotationHistoryIndex - 1); $("image-redo").onclick = () => restoreAnnotationHistory(annotationHistoryIndex + 1);
$("image-zoom-out").onclick = () => { previewZoom = Math.max(.08, previewZoom - .15); applyPreviewZoom(); }; $("image-zoom-in").onclick = () => { previewZoom = Math.min(4, previewZoom + .15); applyPreviewZoom(); }; $("image-zoom-reset").onclick = fitPreviewImage;
// Chromium reports a macOS trackpad pinch as a Ctrl-modified wheel event.
// Keep it scoped to the viewer so normal workspace scrolling is unaffected.
document.querySelector(".image-canvas-wrap").addEventListener("wheel", (event) => { if (!event.ctrlKey || !previewImage || $("image-viewer").hidden) return; event.preventDefault(); const factor = Math.exp(-event.deltaY * .0022); previewZoom = Math.max(.08, Math.min(4, previewZoom * factor)); applyPreviewZoom(); }, { passive: false });
$("image-canvas").addEventListener("pointerdown", (event) => { const tool = previewTool || "select"; const canvas = event.currentTarget; const point = previewCanvasPoint(event); const width = Math.max(2, Number($("image-brush-size").value) * (canvas.width / 900)); if (tool === "text") { const text = prompt("输入批注文字"); if (text) { annotationOps.push({ type: "text", text: text.slice(0, 300), x: point.x, y: point.y, color: $("image-color").value, size: Math.max(16, Math.round(width * 5)) }); commitAnnotations(); renderAnnotations(); } return; } previewDrawing = true; previewLastPoint = point; canvas.setPointerCapture(event.pointerId); if (tool === "select") { const bounds = selectedAnnotationBounds(); if (bounds && point.x >= bounds.x && point.x <= bounds.x + bounds.w && point.y >= bounds.y && point.y <= bounds.y + bounds.h) { annotationMoveOrigin = point; annotationMoveSnapshot = structuredClone(annotationOps); } else { annotationSelection = { x: point.x, y: point.y, w: 0, h: 0 }; selectedAnnotationIndexes.clear(); hideAnnotationSelectionMenu(); } } else if (tool === "brush") annotationDraft = { type: "brush", points: [point], color: $("image-color").value, width }; else if (["line", "rect", "circle"].includes(tool)) annotationDraft = { type: tool, x1: point.x, y1: point.y, x2: point.x, y2: point.y, color: $("image-color").value, width }; else if (tool === "eraser") { const radius = Math.max(width * 3, 16); annotationOps = annotationOps.filter((op) => { const box = opBounds(op); const dx = Math.max(box.x - point.x, 0, point.x - (box.x + box.w)); const dy = Math.max(box.y - point.y, 0, point.y - (box.y + box.h)); return Math.hypot(dx, dy) > radius; }); selectedAnnotationIndexes.clear(); hideAnnotationSelectionMenu(); renderAnnotations(); } });
$("image-canvas").addEventListener("pointermove", (event) => { if (!previewDrawing) return; const point = previewCanvasPoint(event); if (previewTool === "select" && annotationMoveOrigin && annotationMoveSnapshot) { annotationOps = structuredClone(annotationMoveSnapshot); const dx = point.x - annotationMoveOrigin.x; const dy = point.y - annotationMoveOrigin.y; for (const index of selectedAnnotationIndexes) moveAnnotation(annotationOps[index], dx, dy); renderAnnotations(); showAnnotationSelectionMenu(); return; } if (previewTool === "select" && annotationSelection) { annotationSelection.w = point.x - annotationSelection.x; annotationSelection.h = point.y - annotationSelection.y; renderAnnotations(); return; } if (previewTool === "brush" && annotationDraft) annotationDraft.points.push(point); else if (["line", "rect", "circle"].includes(previewTool) && annotationDraft) { annotationDraft.x2 = point.x; annotationDraft.y2 = point.y; } else if (previewTool === "eraser") { const radius = Math.max(Number($("image-brush-size").value) * 3, 16); annotationOps = annotationOps.filter((op) => { const box = opBounds(op); const dx = Math.max(box.x - point.x, 0, point.x - (box.x + box.w)); const dy = Math.max(box.y - point.y, 0, point.y - (box.y + box.h)); return Math.hypot(dx, dy) > radius; }); selectedAnnotationIndexes.clear(); hideAnnotationSelectionMenu(); } renderAnnotations(); });
$("image-canvas").addEventListener("pointerup", (event) => { if (!previewDrawing) return; previewDrawing = false; if (previewTool === "select" && annotationMoveOrigin) { annotationMoveOrigin = null; annotationMoveSnapshot = null; commitAnnotations(); showAnnotationSelectionMenu(); } else if (previewTool === "select" && annotationSelection) { const raw = annotationSelection; const area = { x: Math.min(raw.x, raw.x + raw.w), y: Math.min(raw.y, raw.y + raw.h), w: Math.abs(raw.w), h: Math.abs(raw.h) }; selectedAnnotationIndexes = new Set(annotationOps.map((op, index) => rectsIntersect(area, opBounds(op)) ? index : -1).filter((index) => index >= 0)); annotationSelection = null; showAnnotationSelectionMenu(); } else if (annotationDraft) { annotationOps.push(annotationDraft); annotationDraft = null; commitAnnotations(); } else if (previewTool === "eraser") commitAnnotations(); previewLastPoint = null; renderAnnotations(); event.currentTarget.releasePointerCapture?.(event.pointerId); });
$("annotation-delete").onclick = () => { if (!selectedAnnotationIndexes.size) return; annotationOps = annotationOps.filter((_op, index) => !selectedAnnotationIndexes.has(index)); selectedAnnotationIndexes.clear(); hideAnnotationSelectionMenu(); commitAnnotations(); renderAnnotations(); };
$("annotation-color").oninput = () => { if (!selectedAnnotationIndexes.size) return; for (const index of selectedAnnotationIndexes) annotationOps[index].color = $("annotation-color").value; commitAnnotations(); renderAnnotations(); showAnnotationSelectionMenu(); };
$("annotation-scale-down").onclick = () => { const box = selectedAnnotationBounds(); if (!box) return; const center = { x: box.x + box.w / 2, y: box.y + box.h / 2 }; for (const index of selectedAnnotationIndexes) scaleAnnotation(annotationOps[index], center, .85); commitAnnotations(); renderAnnotations(); showAnnotationSelectionMenu(); };
$("annotation-scale-up").onclick = () => { const box = selectedAnnotationBounds(); if (!box) return; const center = { x: box.x + box.w / 2, y: box.y + box.h / 2 }; for (const index of selectedAnnotationIndexes) scaleAnnotation(annotationOps[index], center, 1.18); commitAnnotations(); renderAnnotations(); showAnnotationSelectionMenu(); };
document.addEventListener("keydown", (event) => { if ($("image-viewer").hidden || !selectedAnnotationIndexes.size || !["Backspace", "Delete"].includes(event.key)) return; event.preventDefault(); annotationOps = annotationOps.filter((_op, index) => !selectedAnnotationIndexes.has(index)); selectedAnnotationIndexes.clear(); hideAnnotationSelectionMenu(); commitAnnotations(); renderAnnotations(); });
$("image-ocr").onclick = async () => { if (!previewAttachmentId) return; const button = $("image-ocr"); button.disabled = true; button.textContent = "识别中…"; const result = await api.ocrAttachmentImage(previewAttachmentId); button.disabled = false; button.textContent = "识别文字"; $("image-ocr-result").hidden = false; $("image-ocr-text").value = result?.ok ? result.text : (result?.error || "文字识别失败"); };
$("image-ocr-copy").onclick = async () => { try { await navigator.clipboard.writeText($("image-ocr-text").value); $("send-status").textContent = "识别文字已复制"; } catch { $("send-status").textContent = "复制文字失败"; } };
$("chat-tool").onclick = () => viewState.content === "chat" && viewState.drawer === "history" ? (viewState.drawer = null, renderView()) : showConversationDrawer(); $("diary-tool").onclick = showDiaryDrawer; $("drawer-close").onclick = () => { viewState.drawer = null; renderView(); }; $("back-button").onclick = returnToChat;
function bindTool(id, action) {
  const node = $(id); let lastPointerAt = 0;
  node.addEventListener("pointerdown", (event) => { if (event.button !== 0) return; lastPointerAt = Date.now(); event.preventDefault(); void action(); });
  node.addEventListener("click", () => { if (Date.now() - lastPointerAt > 500) void action(); });
}
bindTool("notes-tool", () => openLearning("notes")); bindTool("practice-tool", () => openLearning("practice"));
bindTool("coding-qa-tool", openCodingQaView);
$("coding-qa-library-toggle").onclick = () => { $("coding-qa-library").hidden = !$("coding-qa-library").hidden; };
$("coding-qa-library-close").onclick = () => { $("coding-qa-library").hidden = true; };
$("coding-qa-new").onclick = createCodingQa; $("coding-qa-empty-new").onclick = createCodingQa; $("coding-qa-empty-image").onclick = selectCodingQaImage;
$("coding-qa-edit").onclick = () => { if (!activeCodingQa || codingQaGenerating) return; codingQaEditing = !codingQaEditing; renderCodingQa(); if (codingQaEditing) $("coding-qa-markdown").focus(); };
$("coding-qa-save").onclick = saveCodingQa;
$("coding-qa-title-input").onkeydown = (event) => { if (event.key === "Enter") { event.preventDefault(); saveCodingQa(); } if (event.key === "Escape") { codingQaEditing = false; renderCodingQa(); } };
$("coding-qa-image").onclick = selectCodingQaImage; $("coding-qa-recognize").onclick = async () => { if (!activeCodingQa) return; $("coding-qa-status").textContent = "正在识别并整理…"; const result = await api.recognizeCodingQa(activeCodingQa.id); if (result?.ok) { activeCodingQa = result.problem; await loadCodingQa(activeCodingQa.id); } else $("coding-qa-status").textContent = result?.error || "识别失败"; };
$("coding-qa-image-preview").onclick = async () => { if (!activeCodingQa) return; const result = await api.readCodingQaImage(activeCodingQa.id); if (!result?.ok || !result.image) { $("coding-qa-status").textContent = result?.error || "无法打开题目原图"; return; } openImageViewerData(result.image); };
$("coding-qa-delete").onclick = async () => { if (!activeCodingQa || !confirm(`删除题目“${activeCodingQa.title}”及其全部答疑记录？`)) return; const id = activeCodingQa.id; const result = await api.deleteCodingQa(id); if (!result?.ok) return alert("删除题目失败"); activeCodingQa = null; await loadCodingQa(); };
$("coding-qa-send").onclick = sendCodingQa; $("coding-qa-cancel").onclick = () => activeCodingQa && api.cancelCodingQa(activeCodingQa.id); $("coding-qa-prompt").onkeydown = (event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); sendCodingQa(); } };
$("coding-oj-search").onsubmit = async (event) => { event.preventDefault(); const query = $("coding-oj-query").value.trim(); if (!query) return; $("coding-oj-status").textContent = "正在搜索公开题目…"; codingOjResults = []; renderCodingOjResults(); const result = await api.searchCodingOj(query, $("coding-oj-source").value); codingOjResults = result?.results || []; $("coding-oj-status").textContent = result?.ok ? (codingOjResults.length ? `找到 ${codingOjResults.length} 道可导入题目` : "没有找到可导入题目。可尝试题号或完整公开链接。") : (result?.error || "搜索失败"); renderCodingOjResults(); };
$("coding-qa-chat-tab").onclick = () => { codingQaPanel = "chat"; renderCodingQa(); };
$("coding-qa-run-tab").onclick = () => { codingQaPanel = "run"; renderCodingQa(); };
document.querySelectorAll(".coding-language-tabs button").forEach((button) => { button.onclick = async () => { await saveCodingRunner(); codingRunnerLanguage = button.dataset.language; renderCodingQa(); }; });
$("coding-editor-input")?.addEventListener("blur", () => { void flushCodingRunnerSave(); });
$("coding-run-all").onclick = () => openCodingRunModal();
$("coding-run-cancel").onclick = async () => { if (!activeCodingQa) return; await api.cancelCodingRun(activeCodingQa.id); };
$("coding-qa-send-code").onclick = () => { if (!activeCodingQa) return; const code = currentCodingEditorValue(); const runner = activeCodingQa.runner || {}; const summary = runner.lastRun ? `\n\n最近本地测试：${runner.lastRun.passed}/${runner.lastRun.total} 通过。` : ""; if (!code.trim()) { $("coding-qa-send-status").textContent = "当前代码为空，请先在代码运行页输入代码"; return; } void flushCodingRunnerSave(); $("coding-qa-prompt").value = `请分析我当前的 ${codingRunnerLanguage === "cpp" ? "C++17" : "Python 3"} 代码，指出问题并给出修改建议：\n\n\`\`\`${codingRunnerLanguage === "cpp" ? "cpp" : "python"}\n${code}\n\`\`\`${summary}`; $("coding-qa-send-status").textContent = `已同步 ${code.split("\n").length} 行代码，可补充问题后发送`; codingQaPanel = "chat"; renderCodingQa(); $("coding-qa-prompt").focus(); };
$("notes-tab").onclick = () => { learningTab = "notes"; renderNotes(); }; $("resources-tab").onclick = () => { learningTab = "resources"; renderNotes(); };
$("notes-primary-action").onclick = async () => { if (learningTab === "resources") { const result = await api.addLearningResources(); if (!result?.ok) alert(result?.error || "添加资源失败"); await loadLearningNotes(); return; } const result = await api.saveLearningNote({ title: "未命名笔记", content: "" }); if (result?.ok) { selectedNoteId = result.note.id; await loadLearningNotes(); } };
$("note-save").onclick = async () => { if (!selectedNoteId) return; const result = await api.saveLearningNote({ id: selectedNoteId, title: $("note-title").value, content: $("note-content").value }); if (result?.ok) { $("note-status").textContent = "已保存"; await loadLearningNotes(); } else $("note-status").textContent = result?.error || "保存失败"; };
$("note-source").onclick = async () => { const note = learningNotes.find((item) => item.id === selectedNoteId); if (!note?.sourceMessageId) return; if (note.conversationId && note.conversationId !== session.conversation?.id) { const result = await api.loadConversation(note.conversationId); if (!result?.ok) { $("note-status").textContent = "来源对话已不可用"; return; } } viewState = { content: "chat", drawer: null }; renderView(); requestAnimationFrame(() => document.querySelector(`[data-message-id="${CSS.escape(note.sourceMessageId)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" })); };
$("note-delete").onclick = async () => { if (selectedNoteId && confirm("删除这篇笔记？")) { await api.deleteLearningNote(selectedNoteId); selectedNoteId = null; await loadLearningNotes(); } };
$("resource-add").onclick = async () => { const result = await api.addLearningResources(); if (!result?.ok) alert(result?.error || "添加资源失败"); await loadLearningNotes(); };
$("practice-new").onclick = openPracticeModal; $("practice-modal-close").onclick = () => { $("practice-modal").hidden = true; };
$("practice-generate").onclick = async () => { const noteIds = [...$("practice-notes-picker").querySelectorAll("input:checked")].map((item) => item.value); const resourceIds = [...$("practice-resources-picker").querySelectorAll("input:checked")].map((item) => item.value); const button = $("practice-generate"); button.disabled = true; $("practice-generate-status").textContent = "正在生成…"; const result = await api.generatePractice({ noteIds, resourceIds, kind: $("practice-kind").value, subject: $("practice-subject").value, sourceMode: $("practice-source").value }); button.disabled = false; if (!result?.ok) { $("practice-generate-status").textContent = result?.error || "生成失败"; return; } $("practice-modal").hidden = true; await loadPractices(); openPracticeAnswer(result.practice); };
$("practice-answer-back").onclick = closePracticeAnswer; $("practice-submit-all").onclick = submitPracticeBatch;
$("jump-bottom").onclick = () => scrollToLatest("smooth"); $("chat-view").addEventListener("scroll", () => { updateJumpBottom(); updateConversationNavigator(); activateConversationNavigator(); }, { passive: true });
$("conversation-nav-track").addEventListener("pointerdown", (event) => { if (event.target.closest(".conversation-nav-marker")) return; navigatorDragging = true; $("conversation-navigator").classList.add("is-dragging"); event.currentTarget.setPointerCapture(event.pointerId); scrollNavigatorTo(event.clientY); activateConversationNavigator(); });
$("conversation-nav-track").addEventListener("pointermove", (event) => { if (navigatorDragging) scrollNavigatorTo(event.clientY); });
$("conversation-nav-track").addEventListener("pointerup", (event) => { navigatorDragging = false; $("conversation-navigator").classList.remove("is-dragging"); event.currentTarget.releasePointerCapture?.(event.pointerId); activateConversationNavigator(); });
$("conversation-nav-track").addEventListener("keydown", (event) => { const view = $("chat-view"); const amount = Math.max(40, view.clientHeight * .12); if (event.key === "ArrowDown" || event.key === "PageDown") { event.preventDefault(); view.scrollTop += amount; } else if (event.key === "ArrowUp" || event.key === "PageUp") { event.preventDefault(); view.scrollTop -= amount; } else if (event.key === "Home") { event.preventDefault(); view.scrollTop = 0; } else if (event.key === "End") { event.preventDefault(); scrollToLatest("smooth"); } });
$("diary-save").onclick = async () => { if (!selectedDiary) return; const result = await api.saveDiary(selectedDiary, $("diary-editor").value); if (result.ok) { diaryOriginal = $("diary-editor").value; $("diary-status").textContent = "已保存"; } };
$("diary-generate").onclick = async () => { if (!selectedDiary || !confirm("重新生成会覆盖当前日记，确定吗？")) return; const result = await api.generateDiary(selectedDiary); if (result.ok) await loadDiary(selectedDiary); };
$("diary-folder").onclick = () => api.openDiaryFolder();

api.onSession(scheduleSessionRender);
api.onCodingQaDelta((payload) => {
  if (!activeCodingQa || payload?.problemId !== activeCodingQa.id) return;
  const message = payload.assistant;
  if (!message) return;
  const messages = activeCodingQa.messages || (activeCodingQa.messages = []);
  const existing = messages.findIndex((item) => item.id === message.id || (item.role === "assistant" && item.streaming));
  if (existing >= 0) messages[existing] = { ...message }; else messages.push({ ...message });
  codingQaGenerating = payload.generating === true;
  if (payload.complete) { codingQaGenerating = false; void openCodingQa(activeCodingQa.id, false); }
  renderCodingQa();
});
setupCodingEditor(); setupCodingSplitter(); setupCodingProblemActions(); setupComposer(); setupCodingQaComposer(); api.getSession().then(renderSession); renderView();
api.getLearningSearchStatus().then((status) => { webSearchAvailable = !!status?.available; const button = $("web-search"); button.disabled = !webSearchAvailable; button.title = webSearchAvailable ? `为本轮回答启用网络搜索（${status.provider || "已配置"}）` : "请先在设置 - 学习检索与联网资料中配置搜索服务"; });
api.getConnectionStatus().then((status) => setConnectionState(status && status.state, status && status.configured));
function setConnectionState(state, configured = true) { const dot = document.querySelector(".connection-dot"); const safe = !configured ? "unconfigured" : (["available", "error", "configured"].includes(state) ? state : "configured"); dot.dataset.state = safe; }
const emotionNames = { calm: "平静", focused: "专注", happy: "开心", shy: "害羞", surprised: "惊讶", sleepy: "困倦", sad: "难过", annoyed: "轻微不满" };
window.electronAPI.onChatEmotion((value) => { const blend = value && value.display ? value.display : value; const p = blend && blend.primary || "calm"; const s = blend && blend.secondary; $("emotion-pill").textContent = s ? `${emotionNames[p] || p} · ${emotionNames[s] || s}` : emotionNames[p] || p; });
function live2dIsMounted() { return !!document.querySelector("#pet-container.live2d-active, #live2d-stage canvas"); }
function updateLive2dFeedback() { const pane = document.querySelector(".live2d-pane"); const feedback = $("live2d-feedback"); if (live2dIsMounted()) live2dHasVisibleFrame = true; const failed = !live2dHasVisibleFrame && (live2dPhase === "error" || live2dPhase === "disabled"); const visible = failed || (!live2dHasVisibleFrame && ["loading", "recovering"].includes(live2dPhase)); pane.classList.toggle("live2d-ready", live2dHasVisibleFrame); pane.classList.toggle("live2d-error", failed); feedback.hidden = !visible; $("live2d-feedback-text").textContent = live2dPhase === "error" ? "Live2D 加载失败，可以尝试重新加载。" : live2dPhase === "disabled" ? "当前没有可用的 Live2D 模型。" : live2dPhase === "recovering" ? "正在恢复 Live2D 画布…" : "正在加载 Live2D…"; $("live2d-retry").hidden = !failed; }
function detectLive2dFrame() { const canvas = document.querySelector("#live2d-stage canvas"); const bounds = canvas?.getBoundingClientRect(); if (live2dIsMounted() && (!canvas || (canvas.width > 0 && canvas.height > 0 && bounds.width > 0 && bounds.height > 0))) { live2dHasVisibleFrame = true; if (["loading", "recovering"].includes(live2dPhase)) live2dPhase = "ready"; updateLive2dFeedback(); } }
window.electronAPI.onLive2dStatus((status) => { live2dPhase = String(status && status.phase || "loading"); if (live2dPhase === "ready") live2dHasVisibleFrame = true; if (["error", "disabled"].includes(live2dPhase)) live2dHasVisibleFrame = false; updateLive2dFeedback(); });
$("live2d-retry").onclick = () => api.reloadLive2d();
new MutationObserver(detectLive2dFrame).observe($("live2d-stage"), { childList: true, subtree: true });
window.addEventListener("resize", () => { updateConversationNavigator(); detectLive2dFrame(); });
if (window.ResizeObserver) new ResizeObserver(updateConversationNavigator).observe($("messages"));
requestAnimationFrame(detectLive2dFrame);
setTimeout(detectLive2dFrame, 50);
setTimeout(detectLive2dFrame, 250);
setInterval(detectLive2dFrame, 750);
window.addEventListener("beforeunload", (event) => { void flushCodingRunnerSave(); discardPendingAttachments(); cleanupCards(); if (viewState.content === "diary" && $("diary-editor").value !== diaryOriginal) { event.preventDefault(); event.returnValue = ""; } });
