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
if (window.TsukuMateRichContent) window.TsukuMateRichContent.onInput = (value) => { const prompt = $("prompt"); prompt.value = String(value || ""); prompt.focus(); };

function cleanupCards() { while (cardCleanups.length) { try { cardCleanups.pop()(); } catch {} } while (a2uiCleanups.length) { try { a2uiCleanups.pop()(); } catch {} } }
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
  chip.textContent = `${attachment.kind === "image" ? "🖼" : "📄"} ${attachment.name}`;
  if (interactive) {
    const remove = document.createElement("span"); remove.textContent = " ×"; chip.append(remove);
    chip.onclick = async () => {
      await api.discardAttachment(attachment.id);
      pendingAttachments = pendingAttachments.filter((item) => item.id !== attachment.id);
      renderPendingAttachments();
    };
  } else chip.onclick = () => api.openAttachment(attachment.id);
  return chip;
}
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
  for (const line of String(value || "").split("\n")) {
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
function clearMessageNode(row) { for (const cleanup of row._tmCleanups || []) { try { cleanup(); } catch {} } row._tmCleanups = []; delete row._tmVisualText; delete row._tmCompletedAssistantBlocks; }
function appendCompletedAssistantBlocks(row, message) {
  if (row._tmCompletedAssistantBlocks) return;
  row._tmCompletedAssistantBlocks = true;
  if (Array.isArray(message.richCards) && window.TsukuMateRichContent) { const cards = document.createElement("div"); cards.className = "study-card-list"; row.append(cards); for (const card of message.richCards.slice(0, 3)) row._tmCleanups.push(window.TsukuMateRichContent.renderCard(cards, card)); }
  if (Array.isArray(message.a2uiSurfaces) && window.TsukuMateA2UI) { const surfaces = document.createElement("div"); surfaces.className = "a2ui-surface-list"; row.append(surfaces); for (const surface of message.a2uiSurfaces.slice(0, 2)) row._tmCleanups.push(window.TsukuMateA2UI.renderSurface(surfaces, surface)); }
  if (message.id) { const actions = document.createElement("div"); actions.className = "message-learning-actions"; const note = document.createElement("button"); note.type = "button"; note.textContent = "记入笔记"; note.onclick = async () => { const result = await api.noteFromMessage(message.id); if (!result?.ok) { $("send-status").textContent = result?.error || "创建笔记失败"; return; } selectedNoteId = result.note.id; await openLearning("notes"); }; actions.append(note); row.append(actions); }
}
function renderMessageNode(row, message) {
  const signature = JSON.stringify({ content: message.content || "", streaming: !!message.streaming, error: !!message.error, attachments: message.attachments || [], richCards: message.richCards || [], a2ui: message.a2uiSurfaces || [] });
  if (row.dataset.signature === signature) return;
  // UniStudy's streaming renderer never replaces a message row per token: it
  // keeps the bubble and only morphs its unfinished tail.  Apart from looking
  // smoother, that preserves visual cards, focus and future interactive state.
  if (message.role === "assistant" && row._tmVisualText && window.TsukuMateRichContent?.renderVisualMessage) {
    row.dataset.signature = signature;
    // Do not reassign className on every delta: Chromium may restart the
    // descendant glass entry animation when its selector is recalculated.
    row.classList.add("message", "assistant");
    row.classList.toggle("streaming", !!message.streaming);
    row.classList.toggle("error", !!message.error);
    window.TsukuMateRichContent.renderVisualMessage(row._tmVisualText, message.content || "", { streaming: !!message.streaming, messageId: message.id });
    // Crucially, finalising a stream must not rebuild the message row.  The
    // previous code did so, replaying the glass animation and recalculating a
    // different theme from the completed text — seen as a whole-bubble flash.
    if (!message.streaming) appendCompletedAssistantBlocks(row, message);
    return;
  }
  clearMessageNode(row); row.replaceChildren(); row.dataset.signature = signature; row.className = `message ${message.role}${message.streaming ? " streaming" : ""}${message.error ? " error" : ""}`; row.dataset.messageId = message.id || "";
  if (message.role === "user") row.dataset.messageIndex = String([...$("messages").querySelectorAll(".message.user")].length + 1);
  const text = document.createElement("div"); text.className = "message-text";
  text.dataset.bubbleTheme = message.role === "assistant" ? bubbleTheme(message) : "user";
  if (message.role === "assistant" && window.TsukuMateRichContent?.renderVisualMessage) {
    row._tmVisualText = text;
    row._tmCleanups.push(() => window.TsukuMateRichContent.cleanupVisualMessage?.(text));
    window.TsukuMateRichContent.renderVisualMessage(text, message.content || "", { streaming: !!message.streaming, messageId: message.id });
  } else {
    const preparedContent = message.content || "";
    const parts = splitStreamingContent(preparedContent, !!message.streaming); const stable = document.createElement("div"); stable.className = "visual-bubble-stable"; stable.append(renderSafeMarkdown(parts.stable)); const tail = document.createElement("div"); tail.className = "visual-bubble-tail"; tail.append(renderSafeMarkdown(parts.tail)); text.append(stable, tail);
  }
  row.append(text);
  if (Array.isArray(message.attachments) && message.attachments.length) { const list = document.createElement("div"); list.className = "message-attachments"; for (const attachment of message.attachments) list.append(renderAttachment(attachment)); row.append(list); }
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
  const editingDiary = diary && !!selectedDiary;
  $("diary-view").hidden = !diary; $("notes-view").hidden = viewState.content !== "notes"; $("practice-view").hidden = viewState.content !== "practice";
  $("chat-reading-area").hidden = diary || learning; $("composer").hidden = diary || learning; $("jump-bottom").hidden = diary || learning || nearBottom(); $("conversation-navigator").hidden = diary || learning;
  $("diary-empty-state").hidden = editingDiary; $("diary-editor").hidden = !editingDiary; $("diary-view").querySelector("footer").hidden = !editingDiary;
  $("back-button").hidden = !(diary || learning); $("back-button").textContent = "‹ 返回对话"; $("drawer").setAttribute("aria-hidden", String(!viewState.drawer));
  document.querySelector(".workspace").classList.toggle("drawer-open", !!viewState.drawer);
  document.querySelectorAll(".tool").forEach((node) => node.classList.remove("active"));
  $(viewState.content === "diary" ? "diary-tool" : viewState.content === "notes" ? "notes-tool" : viewState.content === "practice" ? "practice-tool" : "chat-tool").classList.add("active");
  document.querySelector(".header-actions").hidden = diary || learning;
  const learningTitle = viewState.content === "notes" ? (learningTab === "resources" ? "学习资源" : "我的笔记") : viewState.content === "practice" ? "学习练习" : "";
  if (learningTitle) { $("page-title").textContent = learningTitle; $("title-edit").hidden = true; }
  $("page-subtitle").textContent = viewState.content === "notes" ? (learningTab === "resources" ? "上传、转写并检索你的学习资料" : "从 AI 回复保存、整理并用于生成练习") : viewState.content === "practice" ? "从选中的笔记与学习资源生成练习" : "对话和学习附件会保存在本地";
  if (!diary) requestAnimationFrame(updateConversationNavigator);
}
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
  const result = await api.listConversations(); root.replaceChildren();
  if (!result || !result.ok) { root.innerHTML = '<div class="drawer-status error">读取失败</div>'; return; }
  for (const item of result.conversations || []) {
    const row = document.createElement("div"); row.className = "conversation-list-row";
    const button = document.createElement("button"); button.className = "date-item"; button.dataset.conversationId = item.id; button.disabled = !!session.generating;
    button.classList.toggle("active", item.id === session.conversationId); button.innerHTML = `<strong></strong><small></small>`;
    button.querySelector("strong").textContent = item.title; button.querySelector("small").textContent = item.legacy ? "旧版记录" : new Date(item.updatedAt).toLocaleString();
    button.onclick = async () => { await discardPendingAttachments(); const loaded = await api.loadConversation(item.id); if (!loaded.ok) { $("send-status").textContent = loaded.error || "切换失败"; return; } session = loaded.session || session; syncConversationSelection(); };
    row.append(button);
    if (!item.legacy) {
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "conversation-delete"; remove.title = `删除对话：${item.title}`; remove.setAttribute("aria-label", `删除对话：${item.title}`); remove.textContent = "×"; remove.disabled = !!session.generating;
      remove.onclick = async (event) => { event.stopPropagation(); if (!confirm(`删除对话“${item.title}”？其中的消息和已发送附件将被永久删除。`)) return; const deleted = await api.deleteConversation(item.id); if (!deleted?.ok) { $("send-status").textContent = deleted?.error || "删除失败"; return; } if (deleted.session) session = deleted.session; await showConversationDrawer(); };
      row.append(remove);
    }
    root.append(row);
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

$("send").onclick = send; $("cancel").onclick = () => api.cancel();
$("attachment-button").onclick = async () => { const result = await api.selectAttachments(); if (result && result.ok) { pendingAttachments.push(...(result.attachments || [])); renderPendingAttachments(); } else $("send-status").textContent = result && result.error || "附件读取失败"; };
$("a2ui-model-button").onclick = async () => { const result = await api.addA2uiModels(); $("send-status").textContent = result?.ok ? (result.models?.length ? `已添加 ${result.models.length} 个 3D 模型，可在下一次请求中让 AI 展示。` : "未添加 3D 模型") : (result?.error || "添加 3D 模型失败"); };
$("web-search").onclick = () => { if (!webSearchAvailable || session.generating) return; webSearchEnabled = !webSearchEnabled; $("web-search").classList.toggle("active", webSearchEnabled); $("web-search").setAttribute("aria-pressed", String(webSearchEnabled)); $("send-status").textContent = webSearchEnabled ? "本轮将使用网络搜索" : "准备就绪"; };
$("new-conversation").onclick = async () => { if (session.generating) return; if (($("prompt").value.trim() || pendingAttachments.length) && !confirm("放弃尚未发送的内容并新建对话吗？")) return; await discardPendingAttachments(); await api.createConversation(); viewState = { content: "chat", drawer: null }; renderView(); };
$("clear-context").onclick = async () => { if (!session.generating && confirm("保留记录，但让后续回复不再使用此处之前的对话？")) await api.clearContext(); };
$("title-edit").onclick = editTitle; $("title-input").onblur = () => finishTitle(true); $("title-input").onkeydown = (event) => { if (event.key === "Enter") { event.preventDefault(); finishTitle(true); } if (event.key === "Escape") { event.preventDefault(); finishTitle(false); } };
$("prompt").addEventListener("keydown", (event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); send(); } });
$("prompt").addEventListener("paste", async (event) => {
  if (session.generating) return;
  const items = [...(event.clipboardData?.items || [])].filter((item) => /^image\/(png|jpe?g|webp)$/i.test(item.type));
  if (!items.length) return; // Preserve the browser's ordinary text paste.
  event.preventDefault();
  let added = 0;
  for (const item of items.slice(0, 5)) {
    const file = item.getAsFile();
    if (!file) continue;
    try {
      const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error("无法读取剪贴板图片")); reader.onload = () => resolve(reader.result); reader.readAsDataURL(file); });
      const result = await api.pasteImage({ dataUrl, mimeType: item.type });
      if (!result?.ok) { $("send-status").textContent = result?.error || "无法添加剪贴板图片"; continue; }
      if (result.attachment) { pendingAttachments.push(result.attachment); added += 1; }
    } catch (error) { $("send-status").textContent = String(error?.message || "无法读取剪贴板图片"); }
  }
  if (added) { renderPendingAttachments(); $("send-status").textContent = `已从剪贴板添加 ${added} 张图片`; }
});
$("chat-tool").onclick = () => viewState.content === "chat" && viewState.drawer === "history" ? (viewState.drawer = null, renderView()) : showConversationDrawer(); $("diary-tool").onclick = showDiaryDrawer; $("drawer-close").onclick = () => { viewState.drawer = null; renderView(); }; $("back-button").onclick = returnToChat;
function bindTool(id, action) {
  const node = $(id); let lastPointerAt = 0;
  node.addEventListener("pointerdown", (event) => { if (event.button !== 0) return; lastPointerAt = Date.now(); event.preventDefault(); void action(); });
  node.addEventListener("click", () => { if (Date.now() - lastPointerAt > 500) void action(); });
}
bindTool("notes-tool", () => openLearning("notes")); bindTool("practice-tool", () => openLearning("practice"));
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

api.onSession(scheduleSessionRender); api.getSession().then(renderSession); renderView();
api.getLearningSearchStatus().then((status) => { webSearchAvailable = !!status?.available; const button = $("web-search"); button.disabled = !webSearchAvailable; button.title = webSearchAvailable ? `为本轮回答启用网络搜索（${status.provider || "已配置"}）` : "请先在设置 - 学习检索与联网资料中配置搜索服务"; });
api.getConnectionStatus().then((status) => setConnectionState(status && status.state, status && status.configured));
function setConnectionState(state, configured = true) { const dot = document.querySelector(".connection-dot"); const safe = !configured ? "unconfigured" : (["available", "error", "configured"].includes(state) ? state : "configured"); dot.dataset.state = safe; }
const emotionNames = { calm: "平静", focused: "专注", happy: "开心", shy: "害羞", surprised: "惊讶", sleepy: "困倦", sad: "难过", annoyed: "轻微不满" };
window.electronAPI.onChatEmotion((value) => { const blend = value && value.display ? value.display : value; const p = blend && blend.primary || "calm"; const s = blend && blend.secondary; $("emotion-pill").textContent = s ? `${emotionNames[p] || p} · ${emotionNames[s] || s}` : emotionNames[p] || p; });
function updateLive2dFeedback() { const pane = document.querySelector(".live2d-pane"); const feedback = $("live2d-feedback"); const failed = live2dPhase === "error" || live2dPhase === "disabled"; const visible = failed || (!live2dHasVisibleFrame && ["loading", "recovering"].includes(live2dPhase)); pane.classList.toggle("live2d-ready", live2dHasVisibleFrame); pane.classList.toggle("live2d-error", failed); feedback.hidden = !visible; $("live2d-feedback-text").textContent = live2dPhase === "error" ? "Live2D 加载失败，可以尝试重新加载。" : live2dPhase === "disabled" ? "当前没有可用的 Live2D 模型。" : live2dPhase === "recovering" ? "正在恢复 Live2D 画布…" : "正在加载 Live2D…"; $("live2d-retry").hidden = !failed; }
function detectLive2dFrame() { const canvas = document.querySelector("#live2d-stage canvas"); if (canvas && canvas.width > 0 && canvas.height > 0 && canvas.getBoundingClientRect().width > 0) { live2dHasVisibleFrame = true; updateLive2dFeedback(); } }
window.electronAPI.onLive2dStatus((status) => { live2dPhase = String(status && status.phase || "loading"); if (live2dPhase === "ready") live2dHasVisibleFrame = true; if (["error", "disabled"].includes(live2dPhase)) live2dHasVisibleFrame = false; updateLive2dFeedback(); });
$("live2d-retry").onclick = () => api.reloadLive2d();
new MutationObserver(detectLive2dFrame).observe($("live2d-stage"), { childList: true, subtree: true });
window.addEventListener("resize", () => { updateConversationNavigator(); detectLive2dFrame(); });
if (window.ResizeObserver) new ResizeObserver(updateConversationNavigator).observe($("messages"));
setInterval(detectLive2dFrame, 750);
window.addEventListener("beforeunload", (event) => { discardPendingAttachments(); cleanupCards(); if (viewState.content === "diary" && $("diary-editor").value !== diaryOriginal) { event.preventDefault(); event.returnValue = ""; } });
